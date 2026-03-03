import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  toolInvocation: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerMcpAnalyticsTools } from "./mcp-analytics";

describe("mcp-analytics MCP tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    // Attach registry introspection helpers used by docs/health tools
    const mockToolDefs = [
      {
        name: "chess_move",
        description: "Make a chess move",
        category: "chess",
        tier: "free",
        inputSchema: { game_id: { description: "Game ID", _def: { typeName: "ZodString" } } },
        enabled: true,
      },
      {
        name: "chess_new_game",
        description: "Start a new chess game",
        category: "chess",
        tier: "free",
        inputSchema: {},
        enabled: true,
      },
      {
        name: "netsim_tick",
        description: "Advance the simulation",
        category: "netsim",
        tier: "free",
        inputSchema: {
          enabled: false,
          rounds: { description: "Rounds to advance", _def: { typeName: "ZodNumber" } },
        },
      },
    ];
    (registry as unknown as Record<string, unknown>).getToolDefinitions = vi.fn()
      .mockReturnValue(mockToolDefs);
    (registry as unknown as Record<string, unknown>).getToolCount = vi.fn().mockReturnValue(42);
    (registry as unknown as Record<string, unknown>).getEnabledCount = vi.fn().mockReturnValue(
      15,
    );
    registerMcpAnalyticsTools(registry, userId);
  });

  it("should register 3 mcp-analytics tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.handlers.has("mcp_tool_usage_stats")).toBe(true);
    expect(registry.handlers.has("mcp_generate_docs")).toBe(true);
    expect(registry.handlers.has("mcp_health_check")).toBe(true);
  });

  describe("mcp_tool_usage_stats", () => {
    it("should return stats for multiple tool invocations", async () => {
      mockPrisma.toolInvocation.count
        .mockResolvedValueOnce(4) // totalAgg
        .mockResolvedValueOnce(1); // errorAgg
      mockPrisma.toolInvocation.aggregate.mockResolvedValue({
        _avg: { durationMs: 65 },
      });
      mockPrisma.toolInvocation.groupBy
        .mockResolvedValueOnce([
          {
            tool: "chess_move",
            _count: { tool: 2 },
            _avg: { durationMs: 65 },
            _sum: { durationMs: 130 },
          },
          {
            tool: "netsim_tick",
            _count: { tool: 1 },
            _avg: { durationMs: 100 },
            _sum: { durationMs: 100 },
          },
          {
            tool: "chess_new_game",
            _count: { tool: 1 },
            _avg: { durationMs: 30 },
            _sum: { durationMs: 30 },
          },
        ])
        .mockResolvedValueOnce([
          { tool: "netsim_tick", _count: { tool: 1 } },
        ]);

      const handler = registry.handlers.get("mcp_tool_usage_stats")!;
      const result = await handler({});
      const text = getText(result);

      expect(text).toContain("MCP Tool Usage Stats");
      expect(text).toContain("**Total Calls:** 4");
      expect(text).toContain("chess_move");
      expect(text).toContain("Error Rate:");
    });

    it("should return empty message when no invocations exist", async () => {
      mockPrisma.toolInvocation.count
        .mockResolvedValueOnce(0) // totalAgg
        .mockResolvedValueOnce(0); // errorAgg
      mockPrisma.toolInvocation.aggregate.mockResolvedValue({
        _avg: { durationMs: null },
      });
      mockPrisma.toolInvocation.groupBy.mockResolvedValue([]);

      const handler = registry.handlers.get("mcp_tool_usage_stats")!;
      const result = await handler({ period: "24h" });
      const text = getText(result);

      expect(text).toContain("No tool invocations found");
      expect(text).toContain("last 24 hours");
    });

    it("should include period label in output", async () => {
      mockPrisma.toolInvocation.count
        .mockResolvedValueOnce(1) // totalAgg
        .mockResolvedValueOnce(0); // errorAgg
      mockPrisma.toolInvocation.aggregate.mockResolvedValue({
        _avg: { durationMs: 40 },
      });
      mockPrisma.toolInvocation.groupBy
        .mockResolvedValueOnce([
          {
            tool: "test_tool",
            _count: { tool: 1 },
            _avg: { durationMs: 40 },
            _sum: { durationMs: 40 },
          },
        ])
        .mockResolvedValueOnce([]);

      const handler = registry.handlers.get("mcp_tool_usage_stats")!;
      const result = await handler({ period: "30d" });
      expect(getText(result)).toContain("last 30 days");
    });

    it("should filter by category in output label", async () => {
      mockPrisma.toolInvocation.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.toolInvocation.aggregate.mockResolvedValue({
        _avg: { durationMs: null },
      });
      mockPrisma.toolInvocation.groupBy.mockResolvedValue([]);

      const handler = registry.handlers.get("mcp_tool_usage_stats")!;
      const result = await handler({ category: "chess" });
      expect(getText(result)).toContain("category \"chess\"");
    });

    it("should calculate error rate correctly", async () => {
      mockPrisma.toolInvocation.count
        .mockResolvedValueOnce(4) // totalAgg
        .mockResolvedValueOnce(1); // errorAgg (1 out of 4 = 25%)
      mockPrisma.toolInvocation.aggregate.mockResolvedValue({
        _avg: { durationMs: 10 },
      });
      mockPrisma.toolInvocation.groupBy
        .mockResolvedValueOnce([
          {
            tool: "tool_a",
            _count: { tool: 4 },
            _avg: { durationMs: 10 },
            _sum: { durationMs: 40 },
          },
        ])
        .mockResolvedValueOnce([
          { tool: "tool_a", _count: { tool: 1 } },
        ]);

      const handler = registry.handlers.get("mcp_tool_usage_stats")!;
      const result = await handler({});
      // 1 error out of 4 = 25%
      expect(getText(result)).toContain("25.0%");
    });
  });

  describe("mcp_generate_docs", () => {
    it("should return error when neither tool_name nor category is provided", async () => {
      const handler = registry.handlers.get("mcp_generate_docs")!;
      const result = await handler({});
      expect(getText(result)).toContain("Provide either");
      expect(isError(result)).toBe(false);
    });

    it("should generate docs for a known tool", async () => {
      const handler = registry.handlers.get("mcp_generate_docs")!;
      const result = await handler({ tool_name: "chess_move" });
      const text = getText(result);

      expect(text).toContain("# chess_move");
      expect(text).toContain("Make a chess move");
      expect(text).toContain("Category:");
      expect(text).toContain("Parameters");
      expect(text).toContain("Example Usage");
      expect(text).toContain("Error Codes");
    });

    it("should return not-found message for unknown tool", async () => {
      const handler = registry.handlers.get("mcp_generate_docs")!;
      const result = await handler({ tool_name: "nonexistent_tool" });
      expect(getText(result)).toContain("not found");
    });

    it("should generate category docs for known category", async () => {
      const handler = registry.handlers.get("mcp_generate_docs")!;
      const result = await handler({ category: "chess" });
      const text = getText(result);

      expect(text).toContain("chess — Tool Category Documentation");
      expect(text).toContain("chess_move");
      expect(text).toContain("chess_new_game");
      expect(text).toContain("2 tool(s)");
    });

    it("should return not-found message for unknown category", async () => {
      const handler = registry.handlers.get("mcp_generate_docs")!;
      const result = await handler({ category: "unknown_category" });
      expect(getText(result)).toContain("No tools found for category");
    });
  });

  describe("mcp_health_check", () => {
    it("should return healthy status with tool counts", async () => {
      mockPrisma.toolInvocation.findFirst.mockResolvedValue(null);
      mockPrisma.toolInvocation.count.mockResolvedValue(150);

      const handler = registry.handlers.get("mcp_health_check")!;
      const result = await handler({});
      const text = getText(result);

      expect(text).toContain("MCP Service Health Check");
      expect(text).toContain("Status:** healthy");
      expect(text).toContain("**Total Tools Registered:** 42");
      expect(text).toContain("**Enabled Tools:** 15");
      expect(text).toContain("**Total Invocations (this user):** 150");
    });

    it("should show last error when one exists", async () => {
      mockPrisma.toolInvocation.findFirst.mockResolvedValue({
        tool: "chess_move",
        error: "Game not found",
        createdAt: new Date("2026-02-01T12:00:00Z"),
      });
      mockPrisma.toolInvocation.count.mockResolvedValue(42);

      const handler = registry.handlers.get("mcp_health_check")!;
      const result = await handler({});
      const text = getText(result);

      expect(text).toContain("Last Error:");
      expect(text).toContain("chess_move");
      expect(text).toContain("Game not found");
    });

    it("should show no errors when none recorded", async () => {
      mockPrisma.toolInvocation.findFirst.mockResolvedValue(null);
      mockPrisma.toolInvocation.count.mockResolvedValue(0);

      const handler = registry.handlers.get("mcp_health_check")!;
      const result = await handler({});
      const text = getText(result);

      expect(text).toContain("None recorded");
    });

    it("should include DB response time", async () => {
      mockPrisma.toolInvocation.findFirst.mockResolvedValue(null);
      mockPrisma.toolInvocation.count.mockResolvedValue(0);

      const handler = registry.handlers.get("mcp_health_check")!;
      const result = await handler({});
      expect(getText(result)).toContain("DB Response Time:");
      expect(getText(result)).toContain("ms");
    });
  });
});
