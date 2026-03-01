/**
 * Tests for mcp/search.ts (ToolSearch class)
 *
 * Covers keyword search and semantic search over registered tools.
 */

import { describe, it, expect, vi } from "vitest";
import { ToolSearch } from "./search";
import type { RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDefinition } from "./registry";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRegisteredTool(enabled = false): RegisteredTool {
  let _enabled = enabled;
  return {
    enable: () => { _enabled = true; },
    disable: () => { _enabled = false; },
    get enabled() { return _enabled; },
    update: vi.fn(),
    remove: vi.fn(),
    handler: vi.fn(),
  };
}

function makeToolMap(
  tools: Array<{
    name: string;
    category: string;
    description: string;
    tier?: "free" | "workspace";
    enabled?: boolean;
  }>,
): Map<string, { definition: ToolDefinition; registered: RegisteredTool }> {
  const map = new Map<string, { definition: ToolDefinition; registered: RegisteredTool }>();
  for (const t of tools) {
    map.set(t.name, {
      definition: {
        name: t.name,
        category: t.category,
        description: t.description,
        tier: t.tier ?? "free",
        handler: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
      },
      registered: makeRegisteredTool(t.enabled ?? false),
    });
  }
  return map;
}

// ─── ToolSearch.search (keyword) ──────────────────────────────────────────────

describe("ToolSearch.search", () => {
  it("returns empty array for empty query", () => {
    const search = new ToolSearch();
    const tools = makeToolMap([
      { name: "upload_file", category: "storage", description: "Upload a file" },
    ]);

    const results = search.search(tools, "");
    expect(results).toEqual([]);
  });

  it("returns empty array for whitespace-only query", () => {
    const search = new ToolSearch();
    const tools = makeToolMap([
      { name: "upload_file", category: "storage", description: "Upload a file" },
    ]);

    const results = search.search(tools, "   ");
    expect(results).toEqual([]);
  });

  it("finds tool by name keyword", () => {
    const search = new ToolSearch();
    search.index("upload_file", "storage", "Upload a file to cloud storage");
    search.index("send_message", "chat", "Send a chat message");

    const tools = makeToolMap([
      { name: "upload_file", category: "storage", description: "Upload a file to cloud storage" },
      { name: "send_message", category: "chat", description: "Send a chat message" },
    ]);

    const results = search.search(tools, "upload");
    expect(results.some(r => r.name === "upload_file")).toBe(true);
  });

  it("finds tool by category keyword", () => {
    const search = new ToolSearch();
    search.index("upload_file", "storage", "Upload a file");
    search.index("send_message", "chat", "Send a message");

    const tools = makeToolMap([
      { name: "upload_file", category: "storage", description: "Upload a file" },
      { name: "send_message", category: "chat", description: "Send a message" },
    ]);

    const results = search.search(tools, "chat");
    expect(results.some(r => r.name === "send_message")).toBe(true);
    expect(results.some(r => r.name === "upload_file")).toBe(false);
  });

  it("finds tool by description keyword", () => {
    const search = new ToolSearch();
    search.index("bulk_export", "data", "Export all records to CSV format");
    search.index("upload_file", "storage", "Upload a file to cloud");

    const tools = makeToolMap([
      { name: "bulk_export", category: "data", description: "Export all records to CSV format" },
      { name: "upload_file", category: "storage", description: "Upload a file to cloud" },
    ]);

    const results = search.search(tools, "csv");
    expect(results.some(r => r.name === "bulk_export")).toBe(true);
  });

  it("excludes gateway-meta tools from results", () => {
    const search = new ToolSearch();
    search.index("search_tools", "gateway-meta", "Search for available tools");
    search.index("upload_file", "storage", "Upload a file");

    const tools = makeToolMap([
      { name: "search_tools", category: "gateway-meta", description: "Search for available tools" },
      { name: "upload_file", category: "storage", description: "Upload a file" },
    ]);

    const results = search.search(tools, "search");
    expect(results.some(r => r.name === "search_tools")).toBe(false);
  });

  it("respects limit parameter", () => {
    const search = new ToolSearch();
    const tools: Array<{ name: string; category: string; description: string }> = [];

    for (let i = 0; i < 20; i++) {
      search.index(`file_tool_${i}`, "storage", `Upload and manage file number ${i}`);
      tools.push({
        name: `file_tool_${i}`,
        category: "storage",
        description: `Upload and manage file number ${i}`,
      });
    }

    const results = search.search(makeToolMap(tools), "file", 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("returns results sorted by score descending", () => {
    const search = new ToolSearch();
    // "upload" is in name (score 3) vs just in description (score 1)
    search.index("upload_tool", "general", "Generic tool");
    search.index("generic_tool", "general", "Tool that uploads files");

    const tools = makeToolMap([
      { name: "upload_tool", category: "general", description: "Generic tool" },
      { name: "generic_tool", category: "general", description: "Tool that uploads files" },
    ]);

    const results = search.search(tools, "upload");
    // upload_tool has "upload" in name (score +3), generic_tool has "upload" in desc (score +1)
    expect(results[0]!.name).toBe("upload_tool");
  });

  it("includes enabled status in results", () => {
    const search = new ToolSearch();
    search.index("enabled_tool", "test", "An enabled test tool");
    search.index("disabled_tool", "test", "A disabled test tool");

    const tools = makeToolMap([
      { name: "enabled_tool", category: "test", description: "An enabled test tool", enabled: true },
      { name: "disabled_tool", category: "test", description: "A disabled test tool", enabled: false },
    ]);

    const results = search.search(tools, "test tool");
    const enabledResult = results.find(r => r.name === "enabled_tool");
    const disabledResult = results.find(r => r.name === "disabled_tool");

    expect(enabledResult?.enabled).toBe(true);
    expect(disabledResult?.enabled).toBe(false);
  });

  it("truncates description to 200 chars", () => {
    const longDesc = "A".repeat(300);
    const search = new ToolSearch();
    search.index("long_desc_tool", "test", longDesc);

    const tools = makeToolMap([
      { name: "long_desc_tool", category: "test", description: longDesc },
    ]);

    const results = search.search(tools, "test");
    if (results.length > 0) {
      expect(results[0]!.description.length).toBeLessThanOrEqual(200);
    }
  });
});

// ─── ToolSearch.searchSemantic ────────────────────────────────────────────────

describe("ToolSearch.searchSemantic", () => {
  it("returns empty array when no tools indexed", () => {
    const search = new ToolSearch();
    const tools = makeToolMap([]);

    const results = search.searchSemantic(tools, "upload file");
    expect(results).toEqual([]);
  });

  it("finds semantically relevant tool", () => {
    const search = new ToolSearch();
    search.index("store_document", "storage", "Save a document to cloud storage");
    search.index("send_chat", "chat", "Send a message to a user");

    const tools = makeToolMap([
      { name: "store_document", category: "storage", description: "Save a document to cloud storage" },
      { name: "send_chat", category: "chat", description: "Send a message to a user" },
    ]);

    const results = search.searchSemantic(tools, "save file to storage");
    expect(results.some(r => r.name === "store_document")).toBe(true);
  });

  it("excludes gateway-meta tools", () => {
    const search = new ToolSearch();
    search.index("search_tools", "gateway-meta", "Search for tools");
    search.index("find_files", "storage", "Find files in storage");

    const tools = makeToolMap([
      { name: "search_tools", category: "gateway-meta", description: "Search for tools" },
      { name: "find_files", category: "storage", description: "Find files in storage" },
    ]);

    const results = search.searchSemantic(tools, "search find");
    expect(results.some(r => r.name === "search_tools")).toBe(false);
  });

  it("includes score in results", () => {
    const search = new ToolSearch();
    search.index("upload_file", "storage", "Upload a file to storage");

    const tools = makeToolMap([
      { name: "upload_file", category: "storage", description: "Upload a file to storage" },
    ]);

    const results = search.searchSemantic(tools, "upload file");
    if (results.length > 0) {
      expect(typeof results[0]!.score).toBe("number");
      expect(results[0]!.score).toBeGreaterThan(0);
    }
  });

  it("respects limit in semantic search", () => {
    const search = new ToolSearch();
    const tools: Array<{ name: string; category: string; description: string }> = [];

    for (let i = 0; i < 20; i++) {
      search.index(`file_${i}`, "storage", `Upload file number ${i} to storage`);
      tools.push({ name: `file_${i}`, category: "storage", description: `Upload file number ${i} to storage` });
    }

    const results = search.searchSemantic(makeToolMap(tools), "file storage", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });
});
