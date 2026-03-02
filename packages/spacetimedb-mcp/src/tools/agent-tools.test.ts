import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockClient, createMockServer } from "../__test-utils__/index.js";
import type { MockMcpServer } from "../__test-utils__/index.js";
import { registerAgentTools } from "./agent-tools.js";

describe("agent-tools", () => {
  let server: MockMcpServer;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    client = createMockClient({ connected: true });
    registerAgentTools(server as unknown as McpServer, client);
  });

  // ─── Tool Registration ───

  it("registers all agent tools", () => {
    const toolNames = [...server.handlers.keys()];
    expect(toolNames).toContain("stdb_connect");
    expect(toolNames).toContain("stdb_disconnect");
    expect(toolNames).toContain("stdb_register_agent");
    expect(toolNames).toContain("stdb_list_agents");
    expect(toolNames).toContain("stdb_send_message");
    expect(toolNames).toContain("stdb_get_messages");
    expect(toolNames).toContain("stdb_mark_delivered");
    expect(server.tool).toHaveBeenCalledTimes(7);
  });

  // ─── stdb_connect ───

  describe("stdb_connect", () => {
    it("connects successfully", async () => {
      const freshClient = createMockClient();
      const freshServer = createMockServer();
      registerAgentTools(freshServer as unknown as McpServer, freshClient);

      const result = await freshServer.call("stdb_connect", {
        uri: "wss://maincloud.spacetimedb.com",
        moduleName: "agent-coordination",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.connected).toBe(true);
      expect(parsed.identity).toBe("mock-identity-abc123");
      expect(parsed.token).toBeDefined();
    });

    it("returns error when already connected", async () => {
      const result = await server.call("stdb_connect", {
        uri: "wss://maincloud.spacetimedb.com",
        moduleName: "agent-coordination",
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("ALREADY_CONNECTED");
    });

    it("returns error on connection failure", async () => {
      const failClient = createMockClient({ failConnect: true });
      const failServer = createMockServer();
      registerAgentTools(failServer as unknown as McpServer, failClient);

      const result = await failServer.call("stdb_connect", {
        uri: "wss://bad.host",
        moduleName: "bad",
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("CONNECTION_FAILED");
      expect(parsed.retryable).toBe(true);
    });

    it("passes token when provided", async () => {
      const freshClient = createMockClient();
      const freshServer = createMockServer();
      registerAgentTools(freshServer as unknown as McpServer, freshClient);

      await freshServer.call("stdb_connect", {
        uri: "wss://maincloud.spacetimedb.com",
        moduleName: "agent-coordination",
        token: "saved-token",
      });

      expect(freshClient.connect).toHaveBeenCalledWith(
        "wss://maincloud.spacetimedb.com",
        "agent-coordination",
        "saved-token",
      );
    });
  });

  // ─── stdb_disconnect ───

  describe("stdb_disconnect", () => {
    it("disconnects successfully", async () => {
      const result = await server.call("stdb_disconnect", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.disconnected).toBe(true);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it("returns error when disconnect throws", async () => {
      client.disconnect = vi.fn(() => {
        throw new Error("Socket error");
      });
      const result = await server.call("stdb_disconnect", {});
      expect(result.isError).toBe(true);
    });

    it("handles non-Error thrown in disconnect", async () => {
      client.disconnect = vi.fn(() => {
        throw "unexpected";
      });
      const result = await server.call("stdb_disconnect", {});
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.message).toBe("unexpected");
    });
  });

  // ─── stdb_register_agent ───

  describe("stdb_register_agent", () => {
    it("registers an agent", async () => {
      const result = await server.call("stdb_register_agent", {
        displayName: "CodeReviewer",
        capabilities: ["code-review", "testing"],
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.registered).toBe(true);
      expect(parsed.displayName).toBe("CodeReviewer");
      expect(parsed.capabilities).toEqual(["code-review", "testing"]);
      expect(client.registerAgent).toHaveBeenCalledWith("CodeReviewer", ["code-review", "testing"]);
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockClient({ connected: false });
      const dcServer = createMockServer();
      registerAgentTools(dcServer as unknown as McpServer, dcClient);

      const result = await dcServer.call("stdb_register_agent", {
        displayName: "Test",
        capabilities: [],
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NOT_CONNECTED");
    });
  });

  // ─── stdb_list_agents ───

  describe("stdb_list_agents", () => {
    it("lists all agents", async () => {
      client._agents.push(
        {
          identity: "agent-1",
          displayName: "Agent1",
          capabilities: ["a"],
          online: true,
          lastSeen: BigInt(1000),
        },
        {
          identity: "agent-2",
          displayName: "Agent2",
          capabilities: ["b"],
          online: false,
          lastSeen: BigInt(900),
        },
      );

      const result = await server.call("stdb_list_agents", { onlineOnly: false });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(2);
      expect(parsed.agents[0].displayName).toBe("Agent1");
    });

    it("filters to online-only agents", async () => {
      client._agents.push(
        {
          identity: "agent-1",
          displayName: "Agent1",
          capabilities: [],
          online: true,
          lastSeen: BigInt(1000),
        },
        {
          identity: "agent-2",
          displayName: "Agent2",
          capabilities: [],
          online: false,
          lastSeen: BigInt(900),
        },
      );

      const result = await server.call("stdb_list_agents", { onlineOnly: true });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.agents[0].displayName).toBe("Agent1");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockClient({ connected: false });
      const dcServer = createMockServer();
      registerAgentTools(dcServer as unknown as McpServer, dcClient);

      const result = await dcServer.call("stdb_list_agents", {});
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_send_message ───

  describe("stdb_send_message", () => {
    it("sends a message", async () => {
      const result = await server.call("stdb_send_message", {
        toAgent: "agent-2",
        content: "Hello from tests!",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.sent).toBe(true);
      expect(parsed.toAgent).toBe("agent-2");
      expect(parsed.contentLength).toBe(17);
      expect(client.sendMessage).toHaveBeenCalledWith("agent-2", "Hello from tests!");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockClient({ connected: false });
      const dcServer = createMockServer();
      registerAgentTools(dcServer as unknown as McpServer, dcClient);

      const result = await dcServer.call("stdb_send_message", {
        toAgent: "agent-2",
        content: "test",
      });
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_get_messages ───

  describe("stdb_get_messages", () => {
    it("gets undelivered messages", async () => {
      client._messages.push({
        id: BigInt(1),
        fromAgent: "agent-2",
        toAgent: "mock-identity-abc123",
        content: "Hi!",
        timestamp: BigInt(1000),
        delivered: false,
      });

      const result = await server.call("stdb_get_messages", { includeDelivered: false });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.messages[0].content).toBe("Hi!");
      expect(parsed.messages[0].id).toBe("1");
    });

    it("includes delivered when requested", async () => {
      client._messages.push(
        {
          id: BigInt(1),
          fromAgent: "a",
          toAgent: "mock-identity-abc123",
          content: "old",
          timestamp: BigInt(100),
          delivered: true,
        },
        {
          id: BigInt(2),
          fromAgent: "b",
          toAgent: "mock-identity-abc123",
          content: "new",
          timestamp: BigInt(200),
          delivered: false,
        },
      );

      const result = await server.call("stdb_get_messages", { includeDelivered: true });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(2);
    });
  });

  // ─── stdb_get_messages (error paths) ───

  describe("stdb_get_messages error paths", () => {
    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockClient({ connected: false });
      const dcServer = createMockServer();
      registerAgentTools(dcServer as unknown as McpServer, dcClient);

      const result = await dcServer.call("stdb_get_messages", {});
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NOT_CONNECTED");
    });

    it("returns QUERY_FAILED on non-connection errors", async () => {
      client.getMessages = vi.fn(() => {
        throw new Error("Subscription expired");
      });
      const result = await server.call("stdb_get_messages", { includeDelivered: false });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("QUERY_FAILED");
    });
  });

  // ─── stdb_mark_delivered ───

  describe("stdb_mark_delivered", () => {
    it("marks message as delivered", async () => {
      const result = await server.call("stdb_mark_delivered", { messageId: "42" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.marked).toBe(true);
      expect(parsed.messageId).toBe("42");
      expect(client.markDelivered).toHaveBeenCalledWith(BigInt(42));
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockClient({ connected: false });
      const dcServer = createMockServer();
      registerAgentTools(dcServer as unknown as McpServer, dcClient);

      const result = await dcServer.call("stdb_mark_delivered", { messageId: "1" });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NOT_CONNECTED");
    });

    it("returns REDUCER_FAILED on other errors", async () => {
      client.markDelivered = vi.fn(async () => {
        throw new Error("Permission denied");
      });
      const result = await server.call("stdb_mark_delivered", { messageId: "1" });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("REDUCER_FAILED");
      expect(parsed.retryable).toBe(true);
    });
  });

  // ─── stdb_send_message (error paths) ───

  describe("stdb_send_message error paths", () => {
    it("returns REDUCER_FAILED on non-connection errors", async () => {
      client.sendMessage = vi.fn(async () => {
        throw new Error("Reducer panicked");
      });
      const result = await server.call("stdb_send_message", {
        toAgent: "agent-2",
        content: "test",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("REDUCER_FAILED");
    });
  });

  // ─── stdb_register_agent (non-Error thrown) ───

  describe("stdb_register_agent edge cases", () => {
    it("handles non-Error thrown values", async () => {
      client.registerAgent = vi.fn(async () => {
        throw "string error";
      });
      const result = await server.call("stdb_register_agent", {
        displayName: "Test",
        capabilities: [],
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("REDUCER_FAILED");
    });
  });

  // ─── stdb_list_agents (QUERY_FAILED) ───

  describe("stdb_list_agents error paths", () => {
    it("returns QUERY_FAILED on non-connection errors", async () => {
      client.listAgents = vi.fn(() => {
        throw new Error("DB corrupt");
      });
      const result = await server.call("stdb_list_agents", { onlineOnly: false });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("QUERY_FAILED");
    });
  });
});
