import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockPlatformClient, createMockServer } from "../__test-utils__/index.js";
import type { MockMcpServer, MockPlatformClient } from "../__test-utils__/index.js";
import { registerAppTools } from "./app-tools.js";

describe("app-tools", () => {
  let server: MockMcpServer;
  let client: MockPlatformClient;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    client = createMockPlatformClient({ connected: true });
    registerAppTools(server as unknown as McpServer, client);
  });

  it("registers all app tools", () => {
    const toolNames = [...server.handlers.keys()];
    expect(toolNames).toContain("stdb_create_app");
    expect(toolNames).toContain("stdb_list_apps");
    expect(toolNames).toContain("stdb_get_app");
    expect(toolNames).toContain("stdb_app_chat");
    expect(toolNames).toContain("stdb_list_app_versions");
    expect(toolNames).toContain("stdb_update_app_status");
    expect(toolNames).toContain("stdb_delete_app");
    expect(toolNames).toContain("stdb_restore_app");
    expect(server.tool).toHaveBeenCalledTimes(8);
  });

  // ─── stdb_create_app ───

  describe("stdb_create_app", () => {
    it("creates an app", async () => {
      const result = await server.call("stdb_create_app", {
        slug: "my-app", name: "My App", description: "A test app", r2CodeKey: "apps/my-app/v1.js",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.created).toBe(true);
      expect(parsed.slug).toBe("my-app");
      expect(client.createApp).toHaveBeenCalledWith("my-app", "My App", "A test app", "apps/my-app/v1.js");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerAppTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_create_app", {
        slug: "x", name: "X", description: "", r2CodeKey: "k",
      });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("NOT_CONNECTED");
    });

    it("returns REDUCER_FAILED on other errors", async () => {
      client.createApp = vi.fn(async () => { throw new Error("Reducer panicked"); });
      const result = await server.call("stdb_create_app", {
        slug: "x", name: "X", description: "", r2CodeKey: "k",
      });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("REDUCER_FAILED");
    });
  });

  // ─── stdb_list_apps ───

  describe("stdb_list_apps", () => {
    it("lists all apps", async () => {
      client._apps.push({
        id: 1n, ownerIdentity: "owner-1", slug: "app-1", name: "App 1",
        description: "First app", r2CodeKey: "k1", status: "active",
        createdAt: 1000n, updatedAt: 1000n,
      });
      const result = await server.call("stdb_list_apps", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.apps[0].slug).toBe("app-1");
    });

    it("filters by owner", async () => {
      client._apps.push(
        { id: 1n, ownerIdentity: "o1", slug: "a1", name: "A1", description: "", r2CodeKey: "k", status: "active", createdAt: 1000n, updatedAt: 1000n },
        { id: 2n, ownerIdentity: "o2", slug: "a2", name: "A2", description: "", r2CodeKey: "k", status: "active", createdAt: 1000n, updatedAt: 1000n },
      );
      const result = await server.call("stdb_list_apps", { ownerIdentity: "o1" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.apps[0].slug).toBe("a1");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerAppTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_list_apps", {});
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_get_app ───

  describe("stdb_get_app", () => {
    it("gets an existing app", async () => {
      client._apps.push({
        id: 1n, ownerIdentity: "o1", slug: "my-app", name: "My App",
        description: "Desc", r2CodeKey: "k", status: "active",
        createdAt: 1000n, updatedAt: 2000n,
      });
      const result = await server.call("stdb_get_app", { slug: "my-app" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.slug).toBe("my-app");
      expect(parsed.name).toBe("My App");
    });

    it("returns NOT_FOUND for missing app", async () => {
      const result = await server.call("stdb_get_app", { slug: "missing" });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("NOT_FOUND");
    });
  });

  // ─── stdb_app_chat ───

  describe("stdb_app_chat", () => {
    it("sends a chat message", async () => {
      const result = await server.call("stdb_app_chat", {
        appId: "1", role: "user", content: "Hello",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.sent).toBe(true);
      expect(client.sendAppMessage).toHaveBeenCalledWith(1n, "user", "Hello");
    });

    it("returns REDUCER_FAILED on error", async () => {
      client.sendAppMessage = vi.fn(async () => { throw new Error("App not found"); });
      const result = await server.call("stdb_app_chat", {
        appId: "1", role: "user", content: "Hi",
      });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("REDUCER_FAILED");
    });
  });

  // ─── stdb_list_app_versions ───

  describe("stdb_list_app_versions", () => {
    it("lists versions", async () => {
      client._appVersions.push({
        id: 1n, appId: 10n, version: "1.0.0", codeHash: "abc123",
        changeDescription: "Initial", createdAt: 1000n,
      });
      const result = await server.call("stdb_list_app_versions", { appId: "10" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.versions[0].version).toBe("1.0.0");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerAppTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_list_app_versions", { appId: "1" });
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_update_app_status ───

  describe("stdb_update_app_status", () => {
    it("updates app status", async () => {
      client._apps.push({
        id: 1n, ownerIdentity: "o1", slug: "app", name: "App",
        description: "", r2CodeKey: "k", status: "active",
        createdAt: 1000n, updatedAt: 1000n,
      });
      const result = await server.call("stdb_update_app_status", { appId: "1", status: "paused" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.updated).toBe(true);
      expect(parsed.status).toBe("paused");
    });

    it("returns REDUCER_FAILED for missing app", async () => {
      const result = await server.call("stdb_update_app_status", { appId: "999", status: "paused" });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("REDUCER_FAILED");
    });
  });

  // ─── stdb_delete_app ───

  describe("stdb_delete_app", () => {
    it("deletes an app", async () => {
      client._apps.push({
        id: 1n, ownerIdentity: "o1", slug: "app", name: "App",
        description: "", r2CodeKey: "k", status: "active",
        createdAt: 1000n, updatedAt: 1000n,
      });
      const result = await server.call("stdb_delete_app", { appId: "1" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.deleted).toBe(true);
      expect(client.deleteApp).toHaveBeenCalledWith(1n);
    });

    it("returns REDUCER_FAILED for missing app", async () => {
      const result = await server.call("stdb_delete_app", { appId: "999" });
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_restore_app ───

  describe("stdb_restore_app", () => {
    it("restores an app", async () => {
      client._apps.push({
        id: 1n, ownerIdentity: "o1", slug: "app", name: "App",
        description: "", r2CodeKey: "k", status: "deleted",
        createdAt: 1000n, updatedAt: 1000n,
      });
      const result = await server.call("stdb_restore_app", { appId: "1" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.restored).toBe(true);
      expect(client.restoreApp).toHaveBeenCalledWith(1n);
    });

    it("returns REDUCER_FAILED for missing app", async () => {
      const result = await server.call("stdb_restore_app", { appId: "999" });
      expect(result.isError).toBe(true);
    });
  });
});
