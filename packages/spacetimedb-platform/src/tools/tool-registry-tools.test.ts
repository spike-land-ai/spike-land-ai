import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockPlatformClient, createMockServer } from "../__test-utils__/index.js";
import type { MockMcpServer, MockPlatformClient } from "../__test-utils__/index.js";
import { registerToolRegistryTools } from "./tool-registry-tools.js";

describe("tool-registry-tools", () => {
  let server: MockMcpServer;
  let client: MockPlatformClient;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    client = createMockPlatformClient({ connected: true });
    registerToolRegistryTools(server as unknown as McpServer, client);
  });

  it("registers all tool registry tools", () => {
    const toolNames = [...server.handlers.keys()];
    expect(toolNames).toContain("stdb_search_tools");
    expect(toolNames).toContain("stdb_enable_tool");
    expect(toolNames).toContain("stdb_disable_tool");
    expect(toolNames).toContain("stdb_list_tool_categories");
    expect(toolNames).toContain("stdb_tool_usage_stats");
    expect(server.tool).toHaveBeenCalledTimes(5);
  });

  // ─── stdb_search_tools ───

  describe("stdb_search_tools", () => {
    it("searches by query", async () => {
      client._tools.push(
        { name: "code_review", description: "Review code", category: "dev", inputSchema: "{}", enabled: true, createdAt: 1000n },
        { name: "image_gen", description: "Generate images", category: "media", inputSchema: "{}", enabled: true, createdAt: 1000n },
      );
      const result = await server.call("stdb_search_tools", { query: "review" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.tools[0].name).toBe("code_review");
    });

    it("filters by category", async () => {
      client._tools.push(
        { name: "t1", description: "D1", category: "dev", inputSchema: "{}", enabled: true, createdAt: 1000n },
        { name: "t2", description: "D2", category: "media", inputSchema: "{}", enabled: true, createdAt: 1000n },
      );
      const result = await server.call("stdb_search_tools", { category: "media" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.tools[0].name).toBe("t2");
    });

    it("returns all tools with no filters", async () => {
      client._tools.push(
        { name: "t1", description: "D1", category: "dev", inputSchema: "{}", enabled: true, createdAt: 1000n },
      );
      const result = await server.call("stdb_search_tools", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerToolRegistryTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_search_tools", {});
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_enable_tool ───

  describe("stdb_enable_tool", () => {
    it("enables a tool", async () => {
      client._tools.push({ name: "my_tool", description: "D", category: "c", inputSchema: "{}", enabled: false, createdAt: 1000n });
      const result = await server.call("stdb_enable_tool", { name: "my_tool" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.enabled).toBe(true);
      expect(parsed.name).toBe("my_tool");
      expect(client.enableTool).toHaveBeenCalledWith("my_tool");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerToolRegistryTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_enable_tool", { name: "x" });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("NOT_CONNECTED");
    });
  });

  // ─── stdb_disable_tool ───

  describe("stdb_disable_tool", () => {
    it("disables a tool", async () => {
      const result = await server.call("stdb_disable_tool", { name: "my_tool" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.disabled).toBe(true);
      expect(client.disableTool).toHaveBeenCalledWith("my_tool");
    });

    it("returns REDUCER_FAILED on error", async () => {
      client.disableTool = vi.fn(async () => { throw new Error("Reducer panicked"); });
      const result = await server.call("stdb_disable_tool", { name: "x" });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("REDUCER_FAILED");
    });
  });

  // ─── stdb_list_tool_categories ───

  describe("stdb_list_tool_categories", () => {
    it("lists categories", async () => {
      client._tools.push(
        { name: "t1", description: "D", category: "dev", inputSchema: "{}", enabled: true, createdAt: 1000n },
        { name: "t2", description: "D", category: "media", inputSchema: "{}", enabled: true, createdAt: 1000n },
        { name: "t3", description: "D", category: "dev", inputSchema: "{}", enabled: true, createdAt: 1000n },
      );
      const result = await server.call("stdb_list_tool_categories", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(2);
      expect(parsed.categories).toContain("dev");
      expect(parsed.categories).toContain("media");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerToolRegistryTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_list_tool_categories", {});
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_tool_usage_stats ───

  describe("stdb_tool_usage_stats", () => {
    it("gets all stats", async () => {
      client._toolUsages.push(
        { id: 1n, toolName: "t1", userIdentity: "u1", durationMs: 100, success: true, timestamp: 1000n },
        { id: 2n, toolName: "t2", userIdentity: "u1", durationMs: 200, success: false, timestamp: 2000n },
      );
      const result = await server.call("stdb_tool_usage_stats", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(2);
    });

    it("filters by tool name", async () => {
      client._toolUsages.push(
        { id: 1n, toolName: "t1", userIdentity: "u1", durationMs: 100, success: true, timestamp: 1000n },
        { id: 2n, toolName: "t2", userIdentity: "u1", durationMs: 200, success: false, timestamp: 2000n },
      );
      const result = await server.call("stdb_tool_usage_stats", { toolName: "t1" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.stats[0].toolName).toBe("t1");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerToolRegistryTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_tool_usage_stats", {});
      expect(result.isError).toBe(true);
    });
  });
});
