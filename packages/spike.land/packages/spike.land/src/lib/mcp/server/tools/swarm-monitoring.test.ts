import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    claudeCodeAgent: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    agentAuditLog: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerSwarmMonitoringTools } from "./swarm-monitoring";

describe("swarm-monitoring tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    registry = createMockRegistry();
    registerSwarmMonitoringTools(registry, userId);
  });

  it("should register 4 swarm monitoring tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.handlers.has("swarm_get_metrics")).toBe(true);
    expect(registry.handlers.has("swarm_get_cost")).toBe(true);
    expect(registry.handlers.has("swarm_replay")).toBe(true);
    expect(registry.handlers.has("swarm_health")).toBe(true);
  });

  describe("swarm_get_metrics", () => {
    it("should return swarm metrics for default 24h period", async () => {
      const now = new Date();
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          totalTasksCompleted: 10,
          totalTokensUsed: 5000,
          totalSessionTime: 300,
          createdAt: now,
        },
      ]);
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([
        { durationMs: 200, isError: false, createdAt: now },
        { durationMs: 400, isError: false, createdAt: now },
        { durationMs: 100, isError: true, createdAt: now },
      ]);
      const handler = registry.handlers.get("swarm_get_metrics")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Swarm Metrics (24h)");
      expect(text).toContain("Tasks completed: 10");
      expect(text).toContain("Total tokens used: 5000");
      expect(text).toContain("Active agents: 1");
    });

    it("should return 100% success rate when there are no audit logs", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          totalTasksCompleted: 0,
          totalTokensUsed: 0,
          totalSessionTime: 0,
          createdAt: new Date(),
        },
      ]);
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("swarm_get_metrics")!;
      const result = await handler({});
      expect(getText(result)).toContain("Success rate: 100%");
    });

    it("should report 0ms avg duration when there are no completed logs", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([]);
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([
        { durationMs: 300, isError: true, createdAt: new Date() },
      ]);
      const handler = registry.handlers.get("swarm_get_metrics")!;
      const result = await handler({});
      expect(getText(result)).toContain("Avg task duration: 0ms");
    });

    it("should accept 7d period", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([]);
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("swarm_get_metrics")!;
      const result = await handler({ period: "7d" });
      expect(getText(result)).toContain("Swarm Metrics (7d)");
    });

    it("should deny access to non-admin users", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      const handler = registry.handlers.get("swarm_get_metrics")!;
      const result = await handler({});
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });
  });

  describe("swarm_get_cost", () => {
    it("should return cost breakdown for all agents", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "Worker-1",
          totalTokensUsed: 10000,
          totalTasksCompleted: 5,
        },
        {
          id: "a2",
          displayName: "Worker-2",
          totalTokensUsed: 20000,
          totalTasksCompleted: 10,
        },
      ]);
      const handler = registry.handlers.get("swarm_get_cost")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Total tokens");
      expect(text).toContain("Worker-1");
      expect(text).toContain("Worker-2");
      expect(text).toContain("tokens/task");
    });

    it("should filter by agent_id when provided", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "Worker-1",
          totalTokensUsed: 1000,
          totalTasksCompleted: 2,
        },
      ]);
      const handler = registry.handlers.get("swarm_get_cost")!;
      const result = await handler({ agent_id: "a1" });
      const text = getText(result);
      expect(text).toContain("agent: a1");
      expect(text).toContain("Worker-1");
    });

    it("should handle agents with zero tasks (avoid division by zero)", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "Idle",
          totalTokensUsed: 500,
          totalTasksCompleted: 0,
        },
      ]);
      const handler = registry.handlers.get("swarm_get_cost")!;
      const result = await handler({});
      expect(getText(result)).toContain("no tasks");
    });

    it("should return not found when no agents match agent_id filter", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("swarm_get_cost")!;
      const result = await handler({ agent_id: "missing-id" });
      expect(getText(result)).toContain("missing-id");
      expect(getText(result)).toContain("not found");
    });

    it("should deny access to non-admin users", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      const handler = registry.handlers.get("swarm_get_cost")!;
      const result = await handler({});
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });
  });

  describe("swarm_replay", () => {
    it("should replay all steps for an agent", async () => {
      const t0 = new Date("2024-01-01T10:00:00Z");
      const t1 = new Date("2024-01-01T10:00:05Z");
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "a1",
        displayName: "ReplayBot",
        deletedAt: null,
      });
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([
        {
          action: "read_file",
          actionType: "FILE_READ",
          createdAt: t0,
          durationMs: 50,
          isError: false,
          input: null,
        },
        {
          action: "write_file",
          actionType: "FILE_WRITE",
          createdAt: t1,
          durationMs: 80,
          isError: false,
          input: null,
        },
      ]);
      const handler = registry.handlers.get("swarm_replay")!;
      const result = await handler({ agent_id: "a1" });
      const text = getText(result);
      expect(text).toContain("Replay: ReplayBot");
      expect(text).toContain("Step 0");
      expect(text).toContain("read_file");
      expect(text).toContain("Step 1");
      expect(text).toContain("write_file");
    });

    it("should replay a slice using from_step and to_step", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "a1",
        displayName: "SliceBot",
        deletedAt: null,
      });
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([
        {
          action: "step_0",
          actionType: "T",
          createdAt: new Date(),
          durationMs: 10,
          isError: false,
          input: null,
        },
        {
          action: "step_1",
          actionType: "T",
          createdAt: new Date(),
          durationMs: 10,
          isError: false,
          input: null,
        },
        {
          action: "step_2",
          actionType: "T",
          createdAt: new Date(),
          durationMs: 10,
          isError: false,
          input: null,
        },
      ]);
      const handler = registry.handlers.get("swarm_replay")!;
      const result = await handler({ agent_id: "a1", from_step: 1, to_step: 1 });
      const text = getText(result);
      expect(text).toContain("step_1");
      expect(text).not.toContain("step_0");
      expect(text).not.toContain("step_2");
    });

    it("should mark error steps with [ERROR]", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "a1",
        displayName: "ErrBot",
        deletedAt: null,
      });
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([
        {
          action: "failing_op",
          actionType: "BUILD",
          createdAt: new Date(),
          durationMs: 200,
          isError: true,
          input: null,
        },
      ]);
      const handler = registry.handlers.get("swarm_replay")!;
      const result = await handler({ agent_id: "a1" });
      expect(getText(result)).toContain("[ERROR]");
    });

    it("should return not found for a missing agent", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("swarm_replay")!;
      const result = await handler({ agent_id: "missing" });
      expect(getText(result)).toContain("not found");
    });

    it("should return message when agent has no execution history", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "a1",
        displayName: "EmptyBot",
        deletedAt: null,
      });
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("swarm_replay")!;
      const result = await handler({ agent_id: "a1" });
      expect(getText(result)).toContain("No execution history");
    });

    it("should return message when step range is out of bounds", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "a1",
        displayName: "Bot",
        deletedAt: null,
      });
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([
        {
          action: "op",
          actionType: "T",
          createdAt: new Date(),
          durationMs: 10,
          isError: false,
          input: null,
        },
      ]);
      const handler = registry.handlers.get("swarm_replay")!;
      const result = await handler({ agent_id: "a1", from_step: 5, to_step: 10 });
      expect(getText(result)).toContain("No steps in range");
    });

    it("should truncate long metadata in replay output", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "a1",
        displayName: "MetaBot",
        deletedAt: null,
      });
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([
        {
          action: "op",
          actionType: "T",
          createdAt: new Date(),
          durationMs: 10,
          isError: false,
          input: { key: "x".repeat(200) },
        },
      ]);
      const handler = registry.handlers.get("swarm_replay")!;
      const result = await handler({ agent_id: "a1" });
      expect(getText(result)).toContain("...");
    });

    it("should deny access to non-admin users", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      const handler = registry.handlers.get("swarm_replay")!;
      const result = await handler({ agent_id: "a1" });
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });
  });

  describe("swarm_health", () => {
    it("should mark recently active agents as ALIVE", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "HealthyBot",
          lastSeenAt: new Date(),
          totalTokensUsed: 100,
          totalTasksCompleted: 3,
          projectPath: "/proj",
          _count: { messages: 2 },
        },
      ]);
      const handler = registry.handlers.get("swarm_health")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("HealthyBot");
      expect(text).toContain("ALIVE");
      expect(text).toContain("Working on: /proj");
    });

    it("should mark agents inactive 6–29 minutes as STUCK", async () => {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "StuckBot",
          lastSeenAt: tenMinAgo,
          totalTokensUsed: 50,
          totalTasksCompleted: 1,
          projectPath: null,
          _count: { messages: 0 },
        },
      ]);
      const handler = registry.handlers.get("swarm_health")!;
      const result = await handler({});
      expect(getText(result)).toContain("STUCK");
    });

    it("should mark agents inactive more than 30 minutes as ERRORED", async () => {
      const fortyMinAgo = new Date(Date.now() - 40 * 60 * 1000);
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "GhostBot",
          lastSeenAt: fortyMinAgo,
          totalTokensUsed: 0,
          totalTasksCompleted: 0,
          projectPath: null,
          _count: { messages: 0 },
        },
      ]);
      const handler = registry.handlers.get("swarm_health")!;
      const result = await handler({});
      expect(getText(result)).toContain("ERRORED");
    });

    it("should mark agents with null lastSeenAt as ERRORED", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "NullBot",
          lastSeenAt: null,
          totalTokensUsed: 0,
          totalTasksCompleted: 0,
          projectPath: null,
          _count: { messages: 0 },
        },
      ]);
      const handler = registry.handlers.get("swarm_health")!;
      const result = await handler({});
      expect(getText(result)).toContain("ERRORED");
      expect(getText(result)).toContain("never");
    });

    it("should return message when no agents are present", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("swarm_health")!;
      const result = await handler({});
      expect(getText(result)).toContain("No active agents");
    });

    it("should include a summary line with counts", async () => {
      const now = new Date();
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "Bot1",
          lastSeenAt: now,
          totalTokensUsed: 0,
          totalTasksCompleted: 0,
          projectPath: null,
          _count: { messages: 0 },
        },
      ]);
      const handler = registry.handlers.get("swarm_health")!;
      const result = await handler({});
      expect(getText(result)).toContain("Summary:");
      expect(getText(result)).toContain("alive");
      expect(getText(result)).toContain("stuck");
      expect(getText(result)).toContain("errored");
    });

    it("should show 'No active task' for agents without a projectPath", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "IdleBot",
          lastSeenAt: new Date(),
          totalTokensUsed: 0,
          totalTasksCompleted: 0,
          projectPath: null,
          _count: { messages: 0 },
        },
      ]);
      const handler = registry.handlers.get("swarm_health")!;
      const result = await handler({});
      expect(getText(result)).toContain("No active task");
    });

    it("should deny access to non-admin users", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      const handler = registry.handlers.get("swarm_health")!;
      const result = await handler({});
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });
  });
});
