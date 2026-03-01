import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockPlatformClient, createMockServer } from "../__test-utils__/index.js";
import type { MockMcpServer, MockPlatformClient } from "../__test-utils__/index.js";
import { registerMessageTools } from "./message-tools.js";

describe("message-tools", () => {
  let server: MockMcpServer;
  let client: MockPlatformClient;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    client = createMockPlatformClient({ connected: true });
    registerMessageTools(server as unknown as McpServer, client);
  });

  it("registers all message tools", () => {
    const toolNames = [...server.handlers.keys()];
    expect(toolNames).toContain("stdb_send_dm");
    expect(toolNames).toContain("stdb_list_dms");
    expect(toolNames).toContain("stdb_mark_dm_read");
    expect(server.tool).toHaveBeenCalledTimes(3);
  });

  // ─── stdb_send_dm ───

  describe("stdb_send_dm", () => {
    it("sends a DM", async () => {
      const result = await server.call("stdb_send_dm", {
        toIdentity: "user-2", content: "Hello!",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.sent).toBe(true);
      expect(parsed.toIdentity).toBe("user-2");
      expect(parsed.contentLength).toBe(6);
      expect(client.sendDM).toHaveBeenCalledWith("user-2", "Hello!");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerMessageTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_send_dm", {
        toIdentity: "x", content: "hi",
      });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("NOT_CONNECTED");
    });

    it("returns REDUCER_FAILED on error", async () => {
      client.sendDM = vi.fn(async () => { throw new Error("User not found"); });
      const result = await server.call("stdb_send_dm", {
        toIdentity: "x", content: "hi",
      });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("REDUCER_FAILED");
    });

    it("handles non-Error thrown values", async () => {
      client.sendDM = vi.fn(async () => { throw "string error"; });
      const result = await server.call("stdb_send_dm", {
        toIdentity: "x", content: "hi",
      });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("REDUCER_FAILED");
    });
  });

  // ─── stdb_list_dms ───

  describe("stdb_list_dms", () => {
    it("lists all DMs", async () => {
      client._directMessages.push(
        { id: 1n, fromIdentity: "mock-identity-abc123", toIdentity: "user-2", content: "Hi", read: false, timestamp: 1000n },
        { id: 2n, fromIdentity: "user-2", toIdentity: "mock-identity-abc123", content: "Hey", read: true, timestamp: 2000n },
      );
      const result = await server.call("stdb_list_dms", { unreadOnly: false });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(2);
    });

    it("filters to unread only", async () => {
      client._directMessages.push(
        { id: 1n, fromIdentity: "mock-identity-abc123", toIdentity: "user-2", content: "Hi", read: false, timestamp: 1000n },
        { id: 2n, fromIdentity: "user-2", toIdentity: "mock-identity-abc123", content: "Hey", read: true, timestamp: 2000n },
      );
      const result = await server.call("stdb_list_dms", { unreadOnly: true });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.messages[0].content).toBe("Hi");
    });

    it("filters by conversation partner", async () => {
      client._directMessages.push(
        { id: 1n, fromIdentity: "mock-identity-abc123", toIdentity: "user-2", content: "A", read: false, timestamp: 1000n },
        { id: 2n, fromIdentity: "user-3", toIdentity: "mock-identity-abc123", content: "B", read: false, timestamp: 2000n },
      );
      const result = await server.call("stdb_list_dms", { withIdentity: "user-2" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.messages[0].content).toBe("A");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerMessageTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_list_dms", {});
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_mark_dm_read ───

  describe("stdb_mark_dm_read", () => {
    it("marks a DM as read", async () => {
      client._directMessages.push({
        id: 42n, fromIdentity: "user-2", toIdentity: "mock-identity-abc123",
        content: "Hello", read: false, timestamp: 1000n,
      });
      const result = await server.call("stdb_mark_dm_read", { messageId: "42" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.marked).toBe(true);
      expect(parsed.messageId).toBe("42");
      expect(client.markDMRead).toHaveBeenCalledWith(42n);
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerMessageTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_mark_dm_read", { messageId: "1" });
      expect(result.isError).toBe(true);
    });

    it("returns REDUCER_FAILED on error", async () => {
      client.markDMRead = vi.fn(async () => { throw new Error("Permission denied"); });
      const result = await server.call("stdb_mark_dm_read", { messageId: "1" });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("REDUCER_FAILED");
    });
  });
});
