import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    superpowersSession: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    workflowTransition: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerBazdmegWorkflowTools } from "./bazdmeg-workflow";

describe("bazdmeg-workflow tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerBazdmegWorkflowTools(registry, userId);
  });

  it("should register 6 workflow tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(6);
  });

  describe("bazdmeg_workflow_start", () => {
    it("should create a new session", async () => {
      mockPrisma.superpowersSession.create.mockResolvedValue({
        id: "sess-1",
        userId,
        currentPhase: "BRAINSTORMING",
        startedAt: new Date(),
      });
      const handler = registry.handlers.get("bazdmeg_workflow_start")!;
      const result = await handler({
        projectName: "my-project",
        branchName: "feat/x",
      });
      expect(getText(result)).toContain("sess-1");
      expect(getText(result)).toContain("BRAINSTORMING");
      expect(getText(result)).toContain("my-project");
      expect(mockPrisma.superpowersSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          projectName: "my-project",
          branchName: "feat/x",
          currentPhase: "BRAINSTORMING",
        }),
      });
    });

    it("should work without optional params", async () => {
      mockPrisma.superpowersSession.create.mockResolvedValue({
        id: "sess-2",
        userId,
        currentPhase: "BRAINSTORMING",
        startedAt: new Date(),
      });
      const handler = registry.handlers.get("bazdmeg_workflow_start")!;
      const result = await handler({});
      expect(getText(result)).toContain("sess-2");
    });
  });

  describe("bazdmeg_workflow_transition", () => {
    it("should allow valid forward transition", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
        currentPhase: "BRAINSTORMING",
        startedAt: new Date(Date.now() - 60000),
      });
      mockPrisma.workflowTransition.findFirst.mockResolvedValue(null);
      mockPrisma.workflowTransition.create.mockResolvedValue({});
      mockPrisma.superpowersSession.update.mockResolvedValue({});

      const handler = registry.handlers.get("bazdmeg_workflow_transition")!;
      const result = await handler({
        sessionId: "sess-1",
        toPhase: "PLANNING",
      });
      expect(getText(result)).toContain("PLANNING");
      expect(getText(result)).toContain("forward");
    });

    it("should reject invalid transition", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
        currentPhase: "BRAINSTORMING",
        startedAt: new Date(),
      });

      const handler = registry.handlers.get("bazdmeg_workflow_transition")!;
      const result = await handler({
        sessionId: "sess-1",
        toPhase: "REVIEWING",
      });
      expect(getText(result)).toContain("Invalid transition");
    });

    it("should always allow back-to-brainstorming", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
        currentPhase: "IMPLEMENTING",
        startedAt: new Date(Date.now() - 60000),
      });
      mockPrisma.workflowTransition.findFirst.mockResolvedValue(null);
      mockPrisma.workflowTransition.create.mockResolvedValue({});
      mockPrisma.superpowersSession.update.mockResolvedValue({});

      const handler = registry.handlers.get("bazdmeg_workflow_transition")!;
      const result = await handler({
        sessionId: "sess-1",
        toPhase: "BRAINSTORMING",
      });
      expect(getText(result)).toContain("BRAINSTORMING");
      expect(getText(result)).toContain("iteration");
    });

    it("should reject transition on completed session", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
        currentPhase: "COMPLETED",
      });

      const handler = registry.handlers.get("bazdmeg_workflow_transition")!;
      const result = await handler({
        sessionId: "sess-1",
        toPhase: "BRAINSTORMING",
      });
      expect(getText(result)).toContain("COMPLETED");
    });

    it("should return not found for missing session", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("bazdmeg_workflow_transition")!;
      const result = await handler({
        sessionId: "missing",
        toPhase: "PLANNING",
      });
      expect(getText(result)).toContain("not found");
    });
  });

  describe("bazdmeg_workflow_status", () => {
    it("should return session with transitions", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
        currentPhase: "IMPLEMENTING",
        startedAt: new Date("2024-01-01"),
        projectName: "test-project",
        branchName: null,
        completedAt: null,
        transitions: [
          {
            fromPhase: "BRAINSTORMING",
            toPhase: "PLANNING",
            durationMs: 30000,
            createdAt: new Date(),
          },
          {
            fromPhase: "PLANNING",
            toPhase: "IMPLEMENTING",
            durationMs: 60000,
            createdAt: new Date(),
          },
        ],
      });

      const handler = registry.handlers.get("bazdmeg_workflow_status")!;
      const result = await handler({ sessionId: "sess-1" });
      expect(getText(result)).toContain("IMPLEMENTING");
      expect(getText(result)).toContain("BRAINSTORMING");
      expect(getText(result)).toContain("PLANNING");
    });

    it("should return not found for missing session", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("bazdmeg_workflow_status")!;
      const result = await handler({ sessionId: "missing" });
      expect(getText(result)).toContain("not found");
    });

    it("should show 'no transitions yet' for session with empty transitions", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
        currentPhase: "BRAINSTORMING",
        startedAt: new Date("2024-01-01"),
        projectName: "new-project",
        branchName: null,
        completedAt: null,
        transitions: [],
      });

      const handler = registry.handlers.get("bazdmeg_workflow_status")!;
      const result = await handler({ sessionId: "sess-1" });
      expect(getText(result)).toContain("No transitions yet");
    });
  });

  describe("bazdmeg_workflow_list", () => {
    it("should return active sessions", async () => {
      mockPrisma.superpowersSession.findMany.mockResolvedValue([
        {
          id: "sess-1",
          currentPhase: "IMPLEMENTING",
          projectName: "proj-a",
          startedAt: new Date(),
        },
        {
          id: "sess-2",
          currentPhase: "BRAINSTORMING",
          projectName: null,
          startedAt: new Date(),
        },
      ]);

      const handler = registry.handlers.get("bazdmeg_workflow_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("2");
      expect(getText(result)).toContain("IMPLEMENTING");
    });

    it("should return empty message when no sessions", async () => {
      mockPrisma.superpowersSession.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("bazdmeg_workflow_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("No active workflow sessions");
    });

    it("should respect limit param", async () => {
      mockPrisma.superpowersSession.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("bazdmeg_workflow_list")!;
      await handler({ limit: 5 });
      expect(mockPrisma.superpowersSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  describe("bazdmeg_workflow_complete", () => {
    it("should mark session as completed", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
        currentPhase: "FINISHING",
        startedAt: new Date(Date.now() - 300000),
      });
      mockPrisma.workflowTransition.findFirst.mockResolvedValue(null);
      mockPrisma.workflowTransition.create.mockResolvedValue({});
      mockPrisma.superpowersSession.update.mockResolvedValue({});

      const handler = registry.handlers.get("bazdmeg_workflow_complete")!;
      const result = await handler({ sessionId: "sess-1" });
      expect(getText(result)).toContain("COMPLETED");
      expect(getText(result)).toContain("FINISHING");
      expect(mockPrisma.superpowersSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentPhase: "COMPLETED" }),
        }),
      );
    });

    it("should handle already completed session", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
        currentPhase: "COMPLETED",
      });
      const handler = registry.handlers.get("bazdmeg_workflow_complete")!;
      const result = await handler({ sessionId: "sess-1" });
      expect(getText(result)).toContain("already completed");
    });

    it("should return not found for missing session", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("bazdmeg_workflow_complete")!;
      const result = await handler({ sessionId: "missing" });
      expect(getText(result)).toContain("not found");
    });
  });

  describe("bazdmeg_workflow_abandon", () => {
    it("should mark session as abandoned with reason", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
        currentPhase: "IMPLEMENTING",
        startedAt: new Date(),
      });
      mockPrisma.workflowTransition.create.mockResolvedValue({});
      mockPrisma.superpowersSession.update.mockResolvedValue({});

      const handler = registry.handlers.get("bazdmeg_workflow_abandon")!;
      const result = await handler({
        sessionId: "sess-1",
        reason: "requirements changed",
      });
      expect(getText(result)).toContain("ABANDONED");
      expect(getText(result)).toContain("requirements changed");
      expect(mockPrisma.superpowersSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentPhase: "ABANDONED",
            metadata: { abandonReason: "requirements changed" },
          }),
        }),
      );
    });

    it("should handle already abandoned session", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
        currentPhase: "ABANDONED",
      });
      const handler = registry.handlers.get("bazdmeg_workflow_abandon")!;
      const result = await handler({
        sessionId: "sess-1",
        reason: "duplicate",
      });
      expect(getText(result)).toContain("already abandoned");
    });

    it("should return not found for missing session", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("bazdmeg_workflow_abandon")!;
      const result = await handler({ sessionId: "missing", reason: "gone" });
      expect(getText(result)).toContain("not found");
    });
  });
});
