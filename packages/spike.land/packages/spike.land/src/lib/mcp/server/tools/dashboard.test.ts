import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), count: vi.fn() },
    $queryRaw: vi.fn(),
    claudeCodeAgent: { findMany: vi.fn(), count: vi.fn() },
    mcpGenerationJob: { findMany: vi.fn(), count: vi.fn() },
    agentAuditLog: { findMany: vi.fn(), count: vi.fn() },
    toolInvocation: { aggregate: vi.fn() },
  },
}));

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: { ping: vi.fn() },
}));

const { mockCheckAllEnvironments } = vi.hoisted(() => ({
  mockCheckAllEnvironments: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/upstash/client", () => ({ redis: mockRedis }));
vi.mock("@/lib/dashboard/environments", () => ({
  checkAllEnvironments: mockCheckAllEnvironments,
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerDashboardTools } from "./dashboard";

describe("dashboard tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    registry = createMockRegistry();
    registerDashboardTools(registry, userId);
  });

  it("should register 5 dashboard tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("dash_overview")).toBe(true);
    expect(registry.handlers.has("dash_health")).toBe(true);
    expect(registry.handlers.has("dash_errors")).toBe(true);
    expect(registry.handlers.has("dash_activity_feed")).toBe(true);
    expect(registry.handlers.has("dash_widget_data")).toBe(true);
  });

  describe("dash_overview", () => {
    it("should return platform metrics", async () => {
      mockPrisma.user.count.mockResolvedValue(42);
      mockPrisma.claudeCodeAgent.count.mockResolvedValue(5);
      mockPrisma.mcpGenerationJob.count.mockResolvedValue(3);
      mockPrisma.agentAuditLog.count.mockResolvedValue(7);
      mockPrisma.toolInvocation.aggregate.mockResolvedValue({
        _sum: { tokensConsumed: 50000 },
      });

      const handler = registry.handlers.get("dash_overview")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Users: 42");
      expect(text).toContain("Active Agents: 5");
      expect(text).toContain("Pending Jobs: 3");
      expect(text).toContain("Errors (24h): 7");
      expect(text).toContain("Total Credits Used: 50000");
    });

    it("should handle null token sum", async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.claudeCodeAgent.count.mockResolvedValue(0);
      mockPrisma.mcpGenerationJob.count.mockResolvedValue(0);
      mockPrisma.agentAuditLog.count.mockResolvedValue(0);
      mockPrisma.toolInvocation.aggregate.mockResolvedValue({
        _sum: { tokensConsumed: null },
      });

      const handler = registry.handlers.get("dash_overview")!;
      const result = await handler({});
      expect(getText(result)).toContain("Total Credits Used: 0");
    });
  });

  describe("dash_health", () => {
    it("should report healthy services", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
      mockRedis.ping.mockResolvedValue("PONG");

      const handler = registry.handlers.get("dash_health")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Database");
      expect(text).toContain("Redis");
      expect(text).toContain("HEALTHY");
    });

    it("should report DOWN when database fails", async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error("Connection refused"));
      mockRedis.ping.mockResolvedValue("PONG");

      const handler = registry.handlers.get("dash_health")!;
      const result = await handler({});
      expect(getText(result)).toContain("DOWN");
    });

    it("should report DOWN when Redis fails", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
      mockRedis.ping.mockRejectedValue(new Error("Connection refused"));

      const handler = registry.handlers.get("dash_health")!;
      const result = await handler({});
      expect(getText(result)).toContain("DOWN");
    });

    it("should check external service configs", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
      mockRedis.ping.mockResolvedValue("PONG");

      const handler = registry.handlers.get("dash_health")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("GitHub");
    });
  });

  describe("dash_errors", () => {
    it("should list recent errors", async () => {
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([
        {
          id: "err-1",
          action: "compile_fail",
          actionType: "BUILD",
          createdAt: new Date(),
          agentId: "agent-1",
        },
      ]);
      const handler = registry.handlers.get("dash_errors")!;
      const result = await handler({});
      expect(getText(result)).toContain("compile_fail");
      expect(getText(result)).toContain("BUILD");
    });

    it("should return message when no errors", async () => {
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("dash_errors")!;
      const result = await handler({});
      expect(getText(result)).toContain("No errors");
    });

    it("should respect custom hours parameter", async () => {
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("dash_errors")!;
      const result = await handler({ hours: 48 });
      expect(getText(result)).toContain("48h");
    });
  });

  describe("dash_activity_feed", () => {
    it("should combine agents and jobs into activity feed", async () => {
      const now = new Date();
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        { id: "a1", displayName: "Worker-1", lastSeenAt: now },
      ]);
      mockPrisma.mcpGenerationJob.findMany.mockResolvedValue([
        { id: "j1", type: "GENERATE", status: "COMPLETED", createdAt: now },
      ]);
      const handler = registry.handlers.get("dash_activity_feed")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("[agent]");
      expect(text).toContain("[job]");
      expect(text).toContain("Worker-1");
    });

    it("should return message when no activity", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([]);
      mockPrisma.mcpGenerationJob.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("dash_activity_feed")!;
      const result = await handler({});
      expect(getText(result)).toContain("No recent activity");
    });
  });

  describe("dash_widget_data", () => {
    it("should return metrics widget data", async () => {
      mockPrisma.user.count.mockResolvedValue(10);
      mockPrisma.claudeCodeAgent.count.mockResolvedValue(3);
      mockPrisma.mcpGenerationJob.count.mockResolvedValue(5);

      const handler = registry.handlers.get("dash_widget_data")!;
      const result = await handler({ widget_id: "metrics" });
      const text = getText(result);
      expect(text).toContain("Metrics Widget");
      expect(text).toContain("Users: 10");
    });

    it("should return agents widget data", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        { id: "a1", displayName: "Worker-1", lastSeenAt: new Date() },
      ]);
      const handler = registry.handlers.get("dash_widget_data")!;
      const result = await handler({ widget_id: "agents" });
      expect(getText(result)).toContain("Worker-1");
    });

    it("should return empty agents widget message", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("dash_widget_data")!;
      const result = await handler({ widget_id: "agents" });
      expect(getText(result)).toContain("No active agents");
    });

    it("should return alerts widget data", async () => {
      mockPrisma.agentAuditLog.count.mockResolvedValue(12);
      const handler = registry.handlers.get("dash_widget_data")!;
      const result = await handler({ widget_id: "alerts" });
      expect(getText(result)).toContain("Errors (24h): 12");
    });

    it("should return environments widget data", async () => {
      mockCheckAllEnvironments.mockResolvedValue([
        { name: "prod", status: "healthy", url: "https://spike.land" },
      ]);
      const handler = registry.handlers.get("dash_widget_data")!;
      const result = await handler({ widget_id: "environments" });
      expect(getText(result)).toContain("prod");
      expect(getText(result)).toContain("healthy");
    });

    it("should return deployments widget data", async () => {
      const handler = registry.handlers.get("dash_widget_data")!;
      const result = await handler({ widget_id: "deployments" });
      expect(getText(result)).toContain("AWS ECS");
    });
  });

  describe("dash_health - edge cases", () => {
    it("should report DEGRADED when database latency > 3000ms", async () => {
      vi.useFakeTimers();
      mockPrisma.$queryRaw.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 3100));
        return [{ "?column?": 1 }];
      });
      mockRedis.ping.mockResolvedValue("PONG");

      const handler = registry.handlers.get("dash_health")!;
      const promise = handler({});
      await vi.advanceTimersByTimeAsync(3200);
      const result = await promise;
      expect(getText(result)).toContain("DEGRADED");
      vi.useRealTimers();
    });

    it("should report DEGRADED when Redis latency > 3000ms", async () => {
      vi.useFakeTimers();
      mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
      mockRedis.ping.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 3100));
        return "PONG";
      });

      const handler = registry.handlers.get("dash_health")!;
      const promise = handler({});
      await vi.advanceTimersByTimeAsync(3200);
      const result = await promise;
      expect(getText(result)).toContain("DEGRADED");
      vi.useRealTimers();
    });
  });

  describe("dash_activity_feed - edge cases", () => {
    it("should skip agents with null lastSeenAt in activity feed", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        { id: "a1", displayName: "Idle-Agent", lastSeenAt: null },
      ]);
      mockPrisma.mcpGenerationJob.findMany.mockResolvedValue([
        { id: "j1", type: "BUILD", status: "PENDING", createdAt: new Date() },
      ]);
      const handler = registry.handlers.get("dash_activity_feed")!;
      const result = await handler({});
      const text = getText(result);
      // Agent with null lastSeenAt should be skipped
      expect(text).not.toContain("Idle-Agent");
      expect(text).toContain("[job]");
    });
  });

  describe("dash_widget_data - edge cases", () => {
    it("should display 'never' for agent with null lastSeenAt", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        { id: "a1", displayName: "New-Agent", lastSeenAt: null },
      ]);
      const handler = registry.handlers.get("dash_widget_data")!;
      const result = await handler({ widget_id: "agents" });
      const text = getText(result);
      expect(text).toContain("New-Agent");
      expect(text).toContain("never");
    });

    it("should return unknown widget message for unrecognized widget_id", async () => {
      const handler = registry.handlers.get("dash_widget_data")!;
      // Bypass enum validation to exercise the default switch branch
      const result = await handler({ widget_id: "nonexistent_widget" });
      expect(getText(result)).toContain("Unknown widget");
      expect(getText(result)).toContain("nonexistent_widget");
    });
  });

  describe("requireAdminRole", () => {
    it("should deny access when user has USER role", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      const handler = registry.handlers.get("dash_overview")!;
      const result = await handler({});
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });

    it("should deny access when user is not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("dash_overview")!;
      const result = await handler({});
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });

    it("should allow SUPER_ADMIN role", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "SUPER_ADMIN" });
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.claudeCodeAgent.count.mockResolvedValue(0);
      mockPrisma.mcpGenerationJob.count.mockResolvedValue(0);
      mockPrisma.agentAuditLog.count.mockResolvedValue(0);
      mockPrisma.toolInvocation.aggregate.mockResolvedValue({
        _sum: { tokensConsumed: 0 },
      });
      const handler = registry.handlers.get("dash_overview")!;
      const result = await handler({});
      expect(getText(result)).toContain("Platform Overview");
    });

    it("should check admin role on every dashboard tool handler", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      const toolNames = [
        "dash_overview",
        "dash_health",
        "dash_errors",
        "dash_activity_feed",
        "dash_widget_data",
      ];
      for (const toolName of toolNames) {
        const handler = registry.handlers.get(toolName)!;
        const result = await handler({});
        expect(getText(result)).toContain("PERMISSION_DENIED");
      }
    });
  });
});
