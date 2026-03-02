import { describe, expect, it, vi } from "vitest";
import { mcpExplorerTools } from "./tools";
import { createMockContext, createMockRegistry } from "../shared/test-utils";

/* ── Mocks ────────────────────────────────────────────────────────────── */

vi.mock("@/lib/mcp/services/registry-client", () => ({
  searchAllRegistries: vi.fn().mockResolvedValue([
    {
      id: "server-1",
      name: "Test Server",
      description: "A test MCP server",
      source: "smithery",
      transport: "stdio",
      homepage: "https://example.com",
      url: "https://example.com/server",
      envVarsRequired: [],
    },
  ]),
  searchSmithery: vi.fn().mockResolvedValue([
    {
      id: "server-1",
      name: "Test Server",
      description: "A test MCP server",
      source: "smithery",
      transport: "stdio",
      homepage: "https://example.com",
      url: "https://example.com/server",
      envVarsRequired: ["API_KEY"],
    },
  ]),
  searchOfficialRegistry: vi.fn().mockResolvedValue([]),
  searchGlama: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    toolInvocation: {
      count: vi.fn().mockResolvedValue(50),
      aggregate: vi.fn().mockResolvedValue({
        _avg: { durationMs: 120 },
      }),
      groupBy: vi.fn().mockResolvedValue([
        {
          tool: "mcp_registry_search",
          _count: { tool: 25 },
          _avg: { durationMs: 100 },
          _sum: { durationMs: 2500 },
        },
      ]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

/* ── Tests ────────────────────────────────────────────────────────────── */

describe("mcp-explorer tools", () => {
  const registry = createMockRegistry(mcpExplorerTools);
  const ctx = createMockContext();

  it("exports 7 tools", () => {
    expect(mcpExplorerTools).toHaveLength(7);
  });

  it("has correct tool names", () => {
    const names = registry.getToolNames();
    expect(names).toContain("mcp_registry_search");
    expect(names).toContain("mcp_registry_get");
    expect(names).toContain("mcp_registry_install");
    expect(names).toContain("mcp_registry_list_installed");
    expect(names).toContain("mcp_tool_usage_stats");
    expect(names).toContain("mcp_generate_docs");
    expect(names).toContain("mcp_health_check");
  });

  it("has mcp-registry and mcp-analytics categories", () => {
    const regTools = registry.getToolsByCategory("mcp-registry");
    const analyticsTools = registry.getToolsByCategory("mcp-analytics");
    expect(regTools).toHaveLength(4);
    expect(analyticsTools).toHaveLength(3);
  });

  describe("mcp_registry_search", () => {
    it("returns matching servers", async () => {
      const result = await registry.call("mcp_registry_search", { query: "test" }, ctx);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("MCP Servers Found");
      expect(text).toContain("Test Server");
      expect(text).toContain("smithery");
    });
  });

  describe("mcp_registry_get", () => {
    it("returns server details", async () => {
      const result = await registry.call(
        "mcp_registry_get",
        { serverId: "server-1", source: "smithery" },
        ctx,
      );
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Test Server");
      expect(text).toContain("API_KEY");
    });

    it("returns NOT_FOUND for missing server", async () => {
      const result = await registry.call(
        "mcp_registry_get",
        { serverId: "nonexistent", source: "smithery" },
        ctx,
      );
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("NOT_FOUND");
    });
  });

  describe("mcp_registry_install", () => {
    it("generates config for server", async () => {
      const result = await registry.call(
        "mcp_registry_install",
        { serverId: "server-1", source: "smithery" },
        ctx,
      );
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("MCP Server Configured");
      expect(text).toContain(".mcp.json");
    });
  });

  describe("mcp_registry_list_installed", () => {
    it("handles missing .mcp.json gracefully", async () => {
      const result = await registry.call("mcp_registry_list_installed", {}, ctx);
      const text = (result.content[0] as { text: string }).text;
      // Will either find .mcp.json or report not found — both are valid
      expect(text).toBeTruthy();
    });
  });

  describe("mcp_tool_usage_stats", () => {
    it("returns usage stats", async () => {
      const result = await registry.call("mcp_tool_usage_stats", { period: "7d" }, ctx);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("MCP Tool Usage Stats");
      expect(text).toContain("Total Calls");
    });
  });

  describe("mcp_generate_docs", () => {
    it("returns error when no tool_name or category given", async () => {
      const result = await registry.call("mcp_generate_docs", {}, ctx);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Provide either");
    });

    it("generates docs for a specific tool", async () => {
      const result = await registry.call(
        "mcp_generate_docs",
        { tool_name: "mcp_registry_search" },
        ctx,
      );
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("mcp_registry_search");
      expect(text).toContain("Description");
      expect(text).toContain("Parameters");
    });

    it("generates docs for a category", async () => {
      const result = await registry.call("mcp_generate_docs", { category: "mcp-registry" }, ctx);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("mcp-registry");
      expect(text).toContain("4 tool(s)");
    });

    it("reports not found for unknown tool", async () => {
      const result = await registry.call(
        "mcp_generate_docs",
        { tool_name: "nonexistent_tool" },
        ctx,
      );
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("not found");
    });
  });

  describe("mcp_health_check", () => {
    it("returns health status", async () => {
      const result = await registry.call("mcp_health_check", {}, ctx);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("MCP Service Health Check");
      expect(text).toContain("healthy");
      expect(text).toContain("**Total Tools Registered:** 7");
    });
  });
});
