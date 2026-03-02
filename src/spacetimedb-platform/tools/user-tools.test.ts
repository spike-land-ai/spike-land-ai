import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockPlatformClient, createMockServer } from "../__test-utils__/index.js";
import type { MockMcpServer } from "../__test-utils__/index.js";
import type { MockPlatformClient } from "../__test-utils__/index.js";
import { registerUserTools } from "./user-tools.js";

describe("user-tools", () => {
  let server: MockMcpServer;
  let client: MockPlatformClient;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    client = createMockPlatformClient({ connected: true });
    registerUserTools(server as unknown as McpServer, client);
  });

  it("registers all user tools", () => {
    const toolNames = [...server.handlers.keys()];
    expect(toolNames).toContain("stdb_register_user");
    expect(toolNames).toContain("stdb_get_user");
    expect(toolNames).toContain("stdb_list_users");
    expect(toolNames).toContain("stdb_update_profile");
    expect(server.tool).toHaveBeenCalledTimes(4);
  });

  // ─── stdb_register_user ───

  describe("stdb_register_user", () => {
    it("registers a user", async () => {
      const result = await server.call("stdb_register_user", {
        handle: "alice",
        displayName: "Alice",
        email: "alice@example.com",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.handle).toBe("alice");
      expect(client.registerUser).toHaveBeenCalledWith("alice", "Alice", "alice@example.com");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerUserTools(dcServer as unknown as McpServer, dcClient);

      const result = await dcServer.call("stdb_register_user", {
        handle: "test",
        displayName: "Test",
        email: "t@t.com",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NOT_CONNECTED");
    });

    it("returns REDUCER_FAILED on other errors", async () => {
      client.registerUser = vi.fn(async () => {
        throw new Error("Reducer panicked");
      });
      const result = await server.call("stdb_register_user", {
        handle: "test",
        displayName: "Test",
        email: "t@t.com",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("REDUCER_FAILED");
      expect(parsed.retryable).toBe(true);
    });

    it("handles non-Error thrown values", async () => {
      client.registerUser = vi.fn(async () => {
        throw "string error";
      });
      const result = await server.call("stdb_register_user", {
        handle: "test",
        displayName: "Test",
        email: "t@t.com",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("REDUCER_FAILED");
    });
  });

  // ─── stdb_get_user ───

  describe("stdb_get_user", () => {
    it("gets an existing user", async () => {
      client._users.push({
        identity: "user-1",
        handle: "alice",
        displayName: "Alice",
        email: "alice@example.com",
        online: true,
        createdAt: BigInt(1000),
        lastSeen: BigInt(2000),
      });

      const result = await server.call("stdb_get_user", { identity: "user-1" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.identity).toBe("user-1");
      expect(parsed.handle).toBe("alice");
      expect(parsed.displayName).toBe("Alice");
    });

    it("returns NOT_FOUND for missing user", async () => {
      const result = await server.call("stdb_get_user", { identity: "nonexistent" });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NOT_FOUND");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerUserTools(dcServer as unknown as McpServer, dcClient);

      const result = await dcServer.call("stdb_get_user", { identity: "user-1" });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NOT_CONNECTED");
    });
  });

  // ─── stdb_list_users ───

  describe("stdb_list_users", () => {
    it("lists all users", async () => {
      client._users.push(
        {
          identity: "u1",
          handle: "alice",
          displayName: "Alice",
          email: "a@a.com",
          online: true,
          createdAt: 1000n,
          lastSeen: 2000n,
        },
        {
          identity: "u2",
          handle: "bob",
          displayName: "Bob",
          email: "b@b.com",
          online: false,
          createdAt: 1000n,
          lastSeen: 1500n,
        },
      );

      const result = await server.call("stdb_list_users", { onlineOnly: false });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(2);
    });

    it("filters to online-only users", async () => {
      client._users.push(
        {
          identity: "u1",
          handle: "alice",
          displayName: "Alice",
          email: "a@a.com",
          online: true,
          createdAt: 1000n,
          lastSeen: 2000n,
        },
        {
          identity: "u2",
          handle: "bob",
          displayName: "Bob",
          email: "b@b.com",
          online: false,
          createdAt: 1000n,
          lastSeen: 1500n,
        },
      );

      const result = await server.call("stdb_list_users", { onlineOnly: true });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.users[0].handle).toBe("alice");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerUserTools(dcServer as unknown as McpServer, dcClient);

      const result = await dcServer.call("stdb_list_users", {});
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_update_profile ───

  describe("stdb_update_profile", () => {
    it("updates profile fields", async () => {
      const result = await server.call("stdb_update_profile", {
        displayName: "New Name",
        email: "new@example.com",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.updated).toBe(true);
      expect(client.updateProfile).toHaveBeenCalledWith({
        displayName: "New Name",
        email: "new@example.com",
      });
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerUserTools(dcServer as unknown as McpServer, dcClient);

      const result = await dcServer.call("stdb_update_profile", { displayName: "X" });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NOT_CONNECTED");
    });

    it("returns REDUCER_FAILED on other errors", async () => {
      client.updateProfile = vi.fn(async () => {
        throw new Error("Permission denied");
      });
      const result = await server.call("stdb_update_profile", { displayName: "X" });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("REDUCER_FAILED");
    });
  });
});
