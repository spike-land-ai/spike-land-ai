import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    skillUsageEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    workflowTransition: {
      findMany: vi.fn(),
    },
    bazdmegMemory: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerBazdmegTelemetryTools } from "./bazdmeg-telemetry";

describe("bazdmeg-telemetry tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerBazdmegTelemetryTools(registry, userId);
  });

  it("should register 3 telemetry tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
  });

  describe("bazdmeg_skill_invoke", () => {
    it("should record a skill invocation", async () => {
      mockPrisma.skillUsageEvent.create.mockResolvedValue({
        id: "evt-1",
        skillName: "brainstorming",
        outcome: "in_progress",
      });
      const handler = registry.handlers.get("bazdmeg_skill_invoke")!;
      const result = await handler({
        skillName: "brainstorming",
        sessionId: "sess-1",
      });
      expect(getText(result)).toContain("evt-1");
      expect(getText(result)).toContain("brainstorming");
      expect(mockPrisma.skillUsageEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          skillName: "brainstorming",
          sessionId: "sess-1",
          outcome: "in_progress",
        }),
      });
    });

    it("should work without optional sessionId", async () => {
      mockPrisma.skillUsageEvent.create.mockResolvedValue({
        id: "evt-2",
        skillName: "debugging",
      });
      const handler = registry.handlers.get("bazdmeg_skill_invoke")!;
      const result = await handler({ skillName: "debugging" });
      expect(getText(result)).toContain("evt-2");
    });
  });

  describe("bazdmeg_skill_complete", () => {
    it("should update skill event with outcome", async () => {
      mockPrisma.skillUsageEvent.findUnique.mockResolvedValue({
        id: "evt-1",
        skillName: "brainstorming",
        createdAt: new Date(Date.now() - 5000),
      });
      mockPrisma.skillUsageEvent.update.mockResolvedValue({});

      const handler = registry.handlers.get("bazdmeg_skill_complete")!;
      const result = await handler({
        eventId: "evt-1",
        outcome: "success",
        durationMs: 5000,
      });
      expect(getText(result)).toContain("success");
      expect(getText(result)).toContain("brainstorming");
      expect(mockPrisma.skillUsageEvent.update).toHaveBeenCalledWith({
        where: { id: "evt-1" },
        data: { outcome: "success", durationMs: 5000 },
      });
    });

    it("should return not found for missing event", async () => {
      mockPrisma.skillUsageEvent.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("bazdmeg_skill_complete")!;
      const result = await handler({ eventId: "missing", outcome: "success" });
      expect(getText(result)).toContain("not found");
    });
  });

  describe("bazdmeg_telemetry_insights", () => {
    it("should aggregate skill usage data", async () => {
      mockPrisma.skillUsageEvent.findMany.mockResolvedValue([
        {
          skillName: "brainstorming",
          outcome: "success",
          sessionId: "s1",
          createdAt: new Date(),
        },
        {
          skillName: "brainstorming",
          outcome: "success",
          sessionId: "s2",
          createdAt: new Date(),
        },
        {
          skillName: "tdd",
          outcome: "success",
          sessionId: "s1",
          createdAt: new Date(),
        },
        {
          skillName: "debugging",
          outcome: "failure",
          sessionId: "s1",
          createdAt: new Date(),
        },
      ]);
      mockPrisma.workflowTransition.findMany.mockResolvedValue([
        { fromPhase: "BRAINSTORMING", durationMs: 30000 },
        { fromPhase: "PLANNING", durationMs: 60000 },
      ]);

      const handler = registry.handlers.get("bazdmeg_telemetry_insights")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("brainstorming");
      expect(text).toContain("Most Used Skills");
      expect(text).toContain("Average Phase Duration");
    });

    it("should return empty message when no events", async () => {
      mockPrisma.skillUsageEvent.findMany.mockResolvedValue([]);
      mockPrisma.workflowTransition.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("bazdmeg_telemetry_insights")!;
      const result = await handler({});
      expect(getText(result)).toContain("No skill usage events");
    });

    it("should detect TDD skip pattern and create memory", async () => {
      // 5 sessions, only 1 with TDD
      const events = [
        {
          skillName: "brainstorming",
          outcome: "success",
          sessionId: "s1",
          createdAt: new Date(),
        },
        {
          skillName: "brainstorming",
          outcome: "success",
          sessionId: "s2",
          createdAt: new Date(),
        },
        {
          skillName: "brainstorming",
          outcome: "success",
          sessionId: "s3",
          createdAt: new Date(),
        },
        {
          skillName: "brainstorming",
          outcome: "success",
          sessionId: "s4",
          createdAt: new Date(),
        },
        {
          skillName: "brainstorming",
          outcome: "success",
          sessionId: "s5",
          createdAt: new Date(),
        },
        {
          skillName: "tdd",
          outcome: "success",
          sessionId: "s1",
          createdAt: new Date(),
        },
      ];
      mockPrisma.skillUsageEvent.findMany.mockResolvedValue(events);
      mockPrisma.workflowTransition.findMany.mockResolvedValue([]);
      mockPrisma.bazdmegMemory.create.mockResolvedValue({});

      const handler = registry.handlers.get("bazdmeg_telemetry_insights")!;
      const result = await handler({});
      expect(getText(result)).toContain("Detected Patterns");
      expect(getText(result)).toContain("TDD");
      expect(mockPrisma.bazdmegMemory.create).toHaveBeenCalled();
    });

    it("should count skipped skill outcomes", async () => {
      mockPrisma.skillUsageEvent.findMany.mockResolvedValue([
        {
          skillName: "brainstorming",
          outcome: "success",
          sessionId: "s1",
          createdAt: new Date(),
        },
        {
          skillName: "brainstorming",
          outcome: "skipped",
          sessionId: "s2",
          createdAt: new Date(),
        },
        {
          skillName: "brainstorming",
          outcome: "skipped",
          sessionId: "s3",
          createdAt: new Date(),
        },
      ]);
      mockPrisma.workflowTransition.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("bazdmeg_telemetry_insights")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("brainstorming");
      expect(text).toContain("Most Used Skills");
    });

    it("should detect high failure rate and create memory", async () => {
      // Skill "buggy-skill" has 4 events, 3 failures = 75% failure rate
      const events = [
        {
          skillName: "buggy-skill",
          outcome: "failure",
          sessionId: "s1",
          createdAt: new Date(),
        },
        {
          skillName: "buggy-skill",
          outcome: "failure",
          sessionId: "s2",
          createdAt: new Date(),
        },
        {
          skillName: "buggy-skill",
          outcome: "failure",
          sessionId: "s3",
          createdAt: new Date(),
        },
        {
          skillName: "buggy-skill",
          outcome: "success",
          sessionId: "s4",
          createdAt: new Date(),
        },
        // Need 5+ sessions for TDD check, but we're testing failure rate here
        {
          skillName: "brainstorming",
          outcome: "success",
          sessionId: "s1",
          createdAt: new Date(),
        },
      ];
      mockPrisma.skillUsageEvent.findMany.mockResolvedValue(events);
      mockPrisma.workflowTransition.findMany.mockResolvedValue([]);
      mockPrisma.bazdmegMemory.create.mockResolvedValue({});

      const handler = registry.handlers.get("bazdmeg_telemetry_insights")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Detected Patterns");
      expect(text).toContain("buggy-skill");
      expect(text).toContain("75% failure rate");
    });

    it("should handle bazdmegMemory.create failure gracefully", async () => {
      const events = [
        {
          skillName: "brainstorming",
          outcome: "success",
          sessionId: "s1",
          createdAt: new Date(),
        },
        {
          skillName: "brainstorming",
          outcome: "success",
          sessionId: "s2",
          createdAt: new Date(),
        },
        {
          skillName: "brainstorming",
          outcome: "success",
          sessionId: "s3",
          createdAt: new Date(),
        },
        {
          skillName: "brainstorming",
          outcome: "success",
          sessionId: "s4",
          createdAt: new Date(),
        },
        {
          skillName: "brainstorming",
          outcome: "success",
          sessionId: "s5",
          createdAt: new Date(),
        },
        {
          skillName: "tdd",
          outcome: "failure",
          sessionId: "s2",
          createdAt: new Date(),
        }, // 1/5 = 20% < 30%
      ];
      mockPrisma.skillUsageEvent.findMany.mockResolvedValue(events);
      mockPrisma.workflowTransition.findMany.mockResolvedValue([]);
      mockPrisma.bazdmegMemory.create.mockRejectedValue(new Error("DB error"));

      const handler = registry.handlers.get("bazdmeg_telemetry_insights")!;
      const result = await handler({});
      expect(getText(result)).toContain("Failed to save");
    });
  });
});
