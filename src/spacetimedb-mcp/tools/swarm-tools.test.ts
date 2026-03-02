import { describe, expect, it, vi, beforeEach } from "vitest";
import { registerSwarmTools } from "./swarm-tools.js";
import { createMockClient } from "../__test-utils__/index.js";

class MockMcpServer {
  tools = new Map<string, any>();
  tool(name: string, description: string, schema: any, handler: any) {
    this.tools.set(name, { description, schema, handler });
  }
}

describe("swarm tools", () => {
  let server: MockMcpServer;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    server = new MockMcpServer();
    client = createMockClient();
    registerSwarmTools(server as any, client as any);
  });

  it("registers all swarm tools", () => {
    expect(server.tools.has("stdb_connect")).toBe(true);
    expect(server.tools.has("stdb_disconnect")).toBe(true);
    expect(server.tools.has("stdb_list_tools")).toBe(true);
    expect(server.tools.has("stdb_invoke_tool")).toBe(true);
    expect(server.tools.has("stdb_list_tasks")).toBe(true);
  });

  it("stdb_connect successful connection", async () => {
    const handler = server.tools.get("stdb_connect").handler;
    const result = await handler({ uri: "wss://test", moduleName: "mod" });
    expect(result.content[0].text).toContain('"connected": true');
  });

  it("stdb_connect already connected error", async () => {
    const handler = server.tools.get("stdb_connect").handler;
    await client.connect("wss://test", "mod");
    const result = await handler({ uri: "wss://test", moduleName: "mod" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("ALREADY_CONNECTED");
  });

  it("stdb_list_tools returns tools", async () => {
    await client.connect("wss://test", "mod");
    await client.registerTool("test_tool", "desc", "{}", "cat");
    const handler = server.tools.get("stdb_list_tools").handler;
    const result = await handler({ category: "cat" });
    expect(result.content[0].text).toContain("test_tool");
  });

  it("stdb_invoke_tool dispatches task", async () => {
    await client.connect("wss://test", "mod");
    const handler = server.tools.get("stdb_invoke_tool").handler;
    const result = await handler({ toolName: "t", argumentsJson: "{}" });
    expect(result.content[0].text).toContain('"status": "pending"');
  });

  it("stdb_list_tasks returns tasks", async () => {
    await client.connect("wss://test", "mod");
    // @ts-ignore - assuming client has this for mock
    if (client.createMcpTask) {
       await (client as any).createMcpTask("tool", "{}");
    }
    const handler = server.tools.get("stdb_list_tasks").handler;
    const result = await handler({});
    expect(result.content[0].text).toContain('"count":');
  });

  describe("swarm tools error paths", () => {
    it("stdb_list_tools handles disconnected state", async () => {
      const handler = server.tools.get("stdb_list_tools").handler;
      // client starts disconnected
      const result = await handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("NOT_CONNECTED");
    });

    it("stdb_list_tools handles query failure", async () => {
      await client.connect("wss://test", "mod");
      vi.spyOn(client, "listRegisteredTools").mockRejectedValue(new Error("Query failed"));
      const handler = server.tools.get("stdb_list_tools").handler;
      const result = await handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("QUERY_FAILED");
    });

    it("stdb_invoke_tool handles disconnected state", async () => {
      const handler = server.tools.get("stdb_invoke_tool").handler;
      const result = await handler({ toolName: "t", argumentsJson: "{}" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("NOT_CONNECTED");
    });

    it("stdb_disconnect handles not connected error", async () => {
      const handler = server.tools.get("stdb_disconnect").handler;
      // client starts disconnected, but mock disconnect doesn't throw.
      // Let's force it to throw.
      vi.spyOn(client, "disconnect").mockImplementation(() => {
        throw new Error("Not connected");
      });
      const result = await handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("NOT_CONNECTED");
    });

    it("stdb_invoke_tool handles reducer failure", async () => {
      await client.connect("wss://test", "mod");
      vi.spyOn(client, "invokeToolRequest").mockRejectedValue(new Error("Reducer crash"));
      const handler = server.tools.get("stdb_invoke_tool").handler;
      const result = await handler({ toolName: "t", argumentsJson: "{}" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("REDUCER_FAILED");
    });
  });
});
