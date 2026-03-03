import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
    toolInvocation: {
      aggregate: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: { ping: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/upstash/client", () => ({ redis: mockRedis }));

import { createMockRegistry, getText } from "../__test-utils__";
import { getJsonData } from "../__test-utils__/assertions";
import { registerMcpObservabilityTools } from "./mcp-observability";

describe("mcp-observability tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    registry = createMockRegistry();
    registerMcpObservabilityTools(registry, userId);
  });

  it("should register 3 observability tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.handlers.has("admin_tool_metrics")).toBe(true);
    expect(registry.handlers.has("admin_system_health")).toBe(true);
    expect(registry.handlers.has("admin_user_analytics")).toBe(true);
  });

  describe("admin_tool_metrics", () => {
    it("should return per-tool metrics with latency percentiles", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          tool: "gallery_generate",
          call_count: BigInt(150),
          error_count: BigInt(3),
          avg_duration: 245.5,
          p50_duration: 200.0,
          p95_duration: 450.0,
          p99_duration: 800.0,
          total_tokens: BigInt(50000),
        },
        {
          tool: "chat_send",
          call_count: BigInt(80),
          error_count: BigInt(0),
          avg_duration: 120.3,
          p50_duration: 100.0,
          p95_duration: 250.0,
          p99_duration: 400.0,
          total_tokens: BigInt(30000),
        },
      ]);

      const handler = registry.handlers.get("admin_tool_metrics")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("MCP Tool Metrics");
      expect(text).toContain("gallery_generate");
      expect(text).toContain("chat_send");
      expect(text).toContain("150");
      expect(text).toContain("80");

      const data = getJsonData<
        Array<{ tool: string; calls: number; errorRate: number; }>
      >(result);
      expect(data).toHaveLength(2);
      expect(data[0]!.tool).toBe("gallery_generate");
      expect(data[0]!.calls).toBe(150);
      expect(data[0]!.errorRate).toBe(2.0);
      expect(data[1]!.tool).toBe("chat_send");
      expect(data[1]!.errorRate).toBe(0);
    });

    it("should return empty message when no invocations", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const handler = registry.handlers.get("admin_tool_metrics")!;
      const result = await handler({});
      expect(getText(result)).toContain("No tool invocations found");
    });

    it("should pass custom period and limit", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const handler = registry.handlers.get("admin_tool_metrics")!;
      const result = await handler({ period_hours: 48, limit: 10 });
      // With $queryRaw tagged template, we just verify no errors and the mock was called
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(getText(result)).toContain("No tool invocations found");
    });

    it("should filter by tool name", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const handler = registry.handlers.get("admin_tool_metrics")!;
      const result = await handler({ tool_name: "gallery_generate" });
      // With $queryRaw tagged template, parameters are safely interpolated
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(getText(result)).toContain("No tool invocations found");
    });

    it("should deny non-admin users", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      const handler = registry.handlers.get("admin_tool_metrics")!;
      const result = await handler({});
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });
  });

  describe("admin_system_health", () => {
    it("should return system health with infrastructure status", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
      mockRedis.ping.mockResolvedValue("PONG");
      mockPrisma.toolInvocation.aggregate.mockResolvedValue({
        _count: 500,
        _sum: { tokensConsumed: 100000, durationMs: 125000 },
        _avg: { durationMs: 250 },
      });
      mockPrisma.toolInvocation.count.mockResolvedValue(10);
      mockPrisma.toolInvocation.groupBy.mockResolvedValue([
        { tool: "gallery_generate", _count: 30 },
        { tool: "chat_send", _count: 20 },
      ]);

      const handler = registry.handlers.get("admin_system_health")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("MCP System Health");
      expect(text).toContain("Database: HEALTHY");
      expect(text).toContain("Redis: HEALTHY");
      expect(text).toContain("Total Invocations: 500");
      expect(text).toContain("Errors: 10");
      expect(text).toContain("Active Tools (1h): 2");
    });

    it("should include tool breakdown when requested", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
      mockRedis.ping.mockResolvedValue("PONG");
      mockPrisma.toolInvocation.aggregate.mockResolvedValue({
        _count: 100,
        _sum: { tokensConsumed: 5000, durationMs: 50000 },
        _avg: { durationMs: 500 },
      });
      mockPrisma.toolInvocation.count.mockResolvedValue(2);
      mockPrisma.toolInvocation.groupBy.mockResolvedValue([
        { tool: "dash_overview", _count: 15 },
      ]);

      const handler = registry.handlers.get("admin_system_health")!;
      const result = await handler({ include_tool_breakdown: true });
      const text = getText(result);
      expect(text).toContain("Active Tools (last 1h)");
      expect(text).toContain("dash_overview: 15 calls");
    });

    it("should handle database failure gracefully", async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error("Connection refused"));
      mockRedis.ping.mockResolvedValue("PONG");
      mockPrisma.toolInvocation.aggregate.mockResolvedValue({
        _count: 0,
        _sum: { tokensConsumed: null, durationMs: null },
        _avg: { durationMs: null },
      });
      mockPrisma.toolInvocation.count.mockResolvedValue(0);
      mockPrisma.toolInvocation.groupBy.mockResolvedValue([]);

      const handler = registry.handlers.get("admin_system_health")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Database: DOWN");
      expect(text).toContain("Redis: HEALTHY");
    });

    it("should handle Redis failure gracefully", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
      mockRedis.ping.mockRejectedValue(new Error("Connection refused"));
      mockPrisma.toolInvocation.aggregate.mockResolvedValue({
        _count: 0,
        _sum: { tokensConsumed: null, durationMs: null },
        _avg: { durationMs: null },
      });
      mockPrisma.toolInvocation.count.mockResolvedValue(0);
      mockPrisma.toolInvocation.groupBy.mockResolvedValue([]);

      const handler = registry.handlers.get("admin_system_health")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Database: HEALTHY");
      expect(text).toContain("Redis: DOWN");
    });

    it("should handle null aggregate results", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
      mockRedis.ping.mockResolvedValue("PONG");
      mockPrisma.toolInvocation.aggregate.mockResolvedValue({
        _count: 0,
        _sum: { tokensConsumed: null, durationMs: null },
        _avg: { durationMs: null },
      });
      mockPrisma.toolInvocation.count.mockResolvedValue(0);
      mockPrisma.toolInvocation.groupBy.mockResolvedValue([]);

      const handler = registry.handlers.get("admin_system_health")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Total Invocations: 0");
      expect(text).toContain("Total Tokens: 0");
      expect(text).toContain("Avg Latency: 0ms");
    });

    it("should handle aggregate/count/groupBy failures gracefully", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
      mockRedis.ping.mockResolvedValue("PONG");
      // All three Prisma calls reject — the .catch() fallbacks should handle them
      mockPrisma.toolInvocation.aggregate.mockRejectedValue(
        new Error("aggregate failed"),
      );
      mockPrisma.toolInvocation.count.mockRejectedValue(
        new Error("count failed"),
      );
      mockPrisma.toolInvocation.groupBy.mockRejectedValue(
        new Error("groupBy failed"),
      );

      const handler = registry.handlers.get("admin_system_health")!;
      const result = await handler({});
      const text = getText(result);
      // Should still produce output with fallback values
      expect(text).toContain("MCP System Health");
      expect(text).toContain("Database: HEALTHY");
      expect(text).toContain("Redis: HEALTHY");
      expect(text).toContain("Total Invocations: 0");
      expect(text).toContain("Errors: 0");
      expect(text).toContain("Active Tools (1h): 0");
    });

    it("should deny non-admin users", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      const handler = registry.handlers.get("admin_system_health")!;
      const result = await handler({});
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });
  });

  describe("admin_user_analytics", () => {
    it("should return per-user summary analytics", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          userId: "user-1",
          call_count: BigInt(200),
          total_tokens: BigInt(80000),
          error_count: BigInt(5),
          unique_tools: BigInt(12),
        },
        {
          userId: "user-2",
          call_count: BigInt(50),
          total_tokens: BigInt(10000),
          error_count: BigInt(1),
          unique_tools: BigInt(4),
        },
      ]);

      const handler = registry.handlers.get("admin_user_analytics")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("User Analytics");
      expect(text).toContain("user-1");
      expect(text).toContain("user-2");

      const data = getJsonData<
        Array<{ userId: string; calls: number; tokens: number; }>
      >(result);
      expect(data).toHaveLength(2);
      expect(data[0]!.userId).toBe("user-1");
      expect(data[0]!.calls).toBe(200);
      expect(data[0]!.tokens).toBe(80000);
    });

    it("should return cost attribution for a specific user", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          userId: "user-1",
          tool: "gallery_generate",
          day: new Date("2026-02-20"),
          call_count: BigInt(50),
          total_tokens: BigInt(25000),
          total_duration: BigInt(12500),
          error_count: BigInt(2),
        },
        {
          userId: "user-1",
          tool: "chat_send",
          day: new Date("2026-02-20"),
          call_count: BigInt(30),
          total_tokens: BigInt(15000),
          total_duration: BigInt(3600),
          error_count: BigInt(0),
        },
      ]);

      const handler = registry.handlers.get("admin_user_analytics")!;
      const result = await handler({ user_id: "user-1" });
      const text = getText(result);
      expect(text).toContain("User Cost Attribution: user-1");
      expect(text).toContain("gallery_generate");
      expect(text).toContain("chat_send");

      const data = getJsonData<Array<{ tool: string; tokens: number; }>>(result);
      expect(data).toHaveLength(2);
      expect(data[0]!.tokens).toBe(25000);
    });

    it("should return empty message for no data", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const handler = registry.handlers.get("admin_user_analytics")!;
      const result = await handler({});
      expect(getText(result)).toContain("No invocations");
    });

    it("should return empty message for specific user with no data", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const handler = registry.handlers.get("admin_user_analytics")!;
      const result = await handler({ user_id: "nonexistent" });
      expect(getText(result)).toContain("No invocations for user nonexistent");
    });

    it("should deny non-admin users", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      const handler = registry.handlers.get("admin_user_analytics")!;
      const result = await handler({});
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });

    it("should deny null users", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("admin_user_analytics")!;
      const result = await handler({});
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });
  });

  describe("admin role checks across all tools", () => {
    it("should allow SUPER_ADMIN role on all tools", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "SUPER_ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockRedis.ping.mockResolvedValue("PONG");
      mockPrisma.toolInvocation.aggregate.mockResolvedValue({
        _count: 0,
        _sum: { tokensConsumed: null, durationMs: null },
        _avg: { durationMs: null },
      });
      mockPrisma.toolInvocation.count.mockResolvedValue(0);
      mockPrisma.toolInvocation.groupBy.mockResolvedValue([]);

      const toolNames = [
        "admin_tool_metrics",
        "admin_system_health",
        "admin_user_analytics",
      ];
      for (const toolName of toolNames) {
        const handler = registry.handlers.get(toolName)!;
        const result = await handler({});
        expect(getText(result)).not.toContain("PERMISSION_DENIED");
      }
    });
  });
});
