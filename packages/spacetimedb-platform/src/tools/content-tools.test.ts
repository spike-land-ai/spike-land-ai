import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockPlatformClient, createMockServer } from "../__test-utils__/index.js";
import type { MockMcpServer, MockPlatformClient } from "../__test-utils__/index.js";
import { registerContentTools } from "./content-tools.js";

describe("content-tools", () => {
  let server: MockMcpServer;
  let client: MockPlatformClient;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    client = createMockPlatformClient({ connected: true });
    registerContentTools(server as unknown as McpServer, client);
  });

  it("registers all content tools", () => {
    const toolNames = [...server.handlers.keys()];
    expect(toolNames).toContain("stdb_create_page");
    expect(toolNames).toContain("stdb_get_page");
    expect(toolNames).toContain("stdb_update_page");
    expect(toolNames).toContain("stdb_delete_page");
    expect(toolNames).toContain("stdb_create_block");
    expect(toolNames).toContain("stdb_update_block");
    expect(toolNames).toContain("stdb_delete_block");
    expect(toolNames).toContain("stdb_reorder_blocks");
    expect(server.tool).toHaveBeenCalledTimes(8);
  });

  // ─── stdb_create_page ───

  describe("stdb_create_page", () => {
    it("creates a page", async () => {
      const result = await server.call("stdb_create_page", {
        slug: "hello-world", title: "Hello World", description: "A test page",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.created).toBe(true);
      expect(parsed.slug).toBe("hello-world");
      expect(client.createPage).toHaveBeenCalledWith("hello-world", "Hello World", "A test page");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerContentTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_create_page", {
        slug: "x", title: "X", description: "",
      });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("NOT_CONNECTED");
    });

    it("returns REDUCER_FAILED on error", async () => {
      client.createPage = vi.fn(async () => { throw new Error("Duplicate slug"); });
      const result = await server.call("stdb_create_page", {
        slug: "x", title: "X", description: "",
      });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("REDUCER_FAILED");
    });
  });

  // ─── stdb_get_page ───

  describe("stdb_get_page", () => {
    it("gets an existing page", async () => {
      client._pages.push({
        id: 1n, slug: "hello", title: "Hello", description: "Desc",
        ownerIdentity: "o1", createdAt: 1000n, updatedAt: 2000n,
      });
      const result = await server.call("stdb_get_page", { slug: "hello" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.slug).toBe("hello");
      expect(parsed.title).toBe("Hello");
    });

    it("returns NOT_FOUND for missing page", async () => {
      const result = await server.call("stdb_get_page", { slug: "missing" });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("NOT_FOUND");
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerContentTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_get_page", { slug: "x" });
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_update_page ───

  describe("stdb_update_page", () => {
    it("updates a page", async () => {
      client._pages.push({
        id: 1n, slug: "hello", title: "Hello", description: "Old",
        ownerIdentity: "o1", createdAt: 1000n, updatedAt: 1000n,
      });
      const result = await server.call("stdb_update_page", {
        slug: "hello", title: "Updated",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.updated).toBe(true);
    });

    it("returns REDUCER_FAILED for missing page", async () => {
      const result = await server.call("stdb_update_page", {
        slug: "missing", title: "X",
      });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("REDUCER_FAILED");
    });
  });

  // ─── stdb_delete_page ───

  describe("stdb_delete_page", () => {
    it("deletes a page", async () => {
      client._pages.push({
        id: 1n, slug: "hello", title: "Hello", description: "",
        ownerIdentity: "o1", createdAt: 1000n, updatedAt: 1000n,
      });
      const result = await server.call("stdb_delete_page", { slug: "hello" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.deleted).toBe(true);
    });

    it("returns REDUCER_FAILED for missing page", async () => {
      const result = await server.call("stdb_delete_page", { slug: "missing" });
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_create_block ───

  describe("stdb_create_block", () => {
    it("creates a block", async () => {
      const result = await server.call("stdb_create_block", {
        pageId: "1", blockType: "text", contentJson: '{"text":"Hello"}', sortOrder: 0,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.created).toBe(true);
      expect(parsed.blockType).toBe("text");
      expect(client.createBlock).toHaveBeenCalledWith(1n, "text", '{"text":"Hello"}', 0);
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerContentTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_create_block", {
        pageId: "1", blockType: "text", contentJson: "{}", sortOrder: 0,
      });
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_update_block ───

  describe("stdb_update_block", () => {
    it("updates a block", async () => {
      client._pageBlocks.push({
        id: 1n, pageId: 1n, blockType: "text", contentJson: '{"old":true}',
        sortOrder: 0, createdAt: 1000n, updatedAt: 1000n,
      });
      const result = await server.call("stdb_update_block", {
        blockId: "1", contentJson: '{"new":true}',
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.updated).toBe(true);
    });

    it("returns REDUCER_FAILED for missing block", async () => {
      const result = await server.call("stdb_update_block", {
        blockId: "999", contentJson: "{}",
      });
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_delete_block ───

  describe("stdb_delete_block", () => {
    it("deletes a block", async () => {
      client._pageBlocks.push({
        id: 1n, pageId: 1n, blockType: "text", contentJson: "{}",
        sortOrder: 0, createdAt: 1000n, updatedAt: 1000n,
      });
      const result = await server.call("stdb_delete_block", { blockId: "1" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.deleted).toBe(true);
    });

    it("returns REDUCER_FAILED for missing block", async () => {
      const result = await server.call("stdb_delete_block", { blockId: "999" });
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_reorder_blocks ───

  describe("stdb_reorder_blocks", () => {
    it("reorders blocks", async () => {
      client._pageBlocks.push(
        { id: 1n, pageId: 1n, blockType: "text", contentJson: "{}", sortOrder: 0, createdAt: 1000n, updatedAt: 1000n },
        { id: 2n, pageId: 1n, blockType: "code", contentJson: "{}", sortOrder: 1, createdAt: 1000n, updatedAt: 1000n },
      );
      const result = await server.call("stdb_reorder_blocks", {
        pageId: "1", blockIds: ["2", "1"],
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.reordered).toBe(true);
      expect(parsed.count).toBe(2);
      expect(client.reorderBlocks).toHaveBeenCalledWith(1n, [2n, 1n]);
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerContentTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_reorder_blocks", {
        pageId: "1", blockIds: ["1"],
      });
      expect(result.isError).toBe(true);
    });
  });
});
