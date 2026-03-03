import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockIsAdminByUserId, mockPrisma } = vi.hoisted(() => {
  const gateCheckResult = {
    create: vi.fn(),
    deleteMany: vi.fn(),
  };
  const prisma = {
    superpowersSession: {
      findFirst: vi.fn(),
    },
    workflowTransition: {
      findMany: vi.fn(),
    },
    skillUsageEvent: {
      findMany: vi.fn(),
    },
    gateCheckResult,
    // $transaction executes the callback with a tx proxy that delegates to the same mocks
    $transaction: vi.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
  };
  return {
    mockIsAdminByUserId: vi.fn<(userId: string) => Promise<boolean>>(),
    mockPrisma: prisma,
  };
});

vi.mock("@/lib/auth/admin-middleware", () => ({
  isAdminByUserId: mockIsAdminByUserId,
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerBazdmegGatesTools } from "./bazdmeg-gates";

describe("bazdmeg-gates tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdminByUserId.mockResolvedValue(true);
    mockPrisma.gateCheckResult.deleteMany.mockResolvedValue({ count: 0 });
    registry = createMockRegistry();
    registerBazdmegGatesTools(registry, userId);
  });

  it("should register 2 gate tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(2);
  });

  describe("bazdmeg_superpowers_gate_check", () => {
    it("should return all GREEN when workflow fully followed", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
        currentPhase: "FINISHING",
      });
      mockPrisma.workflowTransition.findMany.mockResolvedValue([
        {
          fromPhase: "BRAINSTORMING",
          toPhase: "PLANNING",
          createdAt: new Date(),
        },
        {
          fromPhase: "PLANNING",
          toPhase: "IMPLEMENTING",
          createdAt: new Date(),
        },
        {
          fromPhase: "IMPLEMENTING",
          toPhase: "REVIEWING",
          createdAt: new Date(),
        },
        { fromPhase: "REVIEWING", toPhase: "FINISHING", createdAt: new Date() },
      ]);
      mockPrisma.skillUsageEvent.findMany.mockResolvedValue([
        {
          skillName: "brainstorming",
          outcome: "success",
          createdAt: new Date(),
        },
        { skillName: "planning", outcome: "success", createdAt: new Date() },
        { skillName: "tdd", outcome: "success", createdAt: new Date() },
        { skillName: "code-review", outcome: "success", createdAt: new Date() },
        {
          skillName: "verification-before-completion",
          outcome: "success",
          createdAt: new Date(),
        },
      ]);
      mockPrisma.gateCheckResult.create.mockResolvedValue({});

      const handler = registry.handlers.get("bazdmeg_superpowers_gate_check")!;
      const result = await handler({ sessionId: "sess-1" });
      const text = getText(result);
      expect(text).toContain("[GREEN]");
      expect(text).not.toContain("[RED]");
      expect(text).toContain("All workflow gates passing");
    });

    it("should return RED when brainstorming skipped", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
        currentPhase: "IMPLEMENTING",
      });
      mockPrisma.workflowTransition.findMany.mockResolvedValue([
        {
          fromPhase: "PLANNING",
          toPhase: "IMPLEMENTING",
          createdAt: new Date(),
        },
      ]);
      mockPrisma.skillUsageEvent.findMany.mockResolvedValue([]);
      mockPrisma.gateCheckResult.create.mockResolvedValue({});

      const handler = registry.handlers.get("bazdmeg_superpowers_gate_check")!;
      const result = await handler({ sessionId: "sess-1" });
      const text = getText(result);
      expect(text).toContain("[RED]");
      expect(text).toContain("Workflow gaps");
    });

    it("should return YELLOW for phase without skill invocation", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
        currentPhase: "IMPLEMENTING",
      });
      mockPrisma.workflowTransition.findMany.mockResolvedValue([
        {
          fromPhase: "BRAINSTORMING",
          toPhase: "PLANNING",
          createdAt: new Date(),
        },
        {
          fromPhase: "PLANNING",
          toPhase: "IMPLEMENTING",
          createdAt: new Date(),
        },
      ]);
      // No skill events — phases exist but skills weren't invoked
      mockPrisma.skillUsageEvent.findMany.mockResolvedValue([]);
      mockPrisma.gateCheckResult.create.mockResolvedValue({});

      const handler = registry.handlers.get("bazdmeg_superpowers_gate_check")!;
      const result = await handler({ sessionId: "sess-1" });
      const text = getText(result);
      expect(text).toContain("[YELLOW]");
    });

    it("should return not found for missing session", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("bazdmeg_superpowers_gate_check")!;
      const result = await handler({ sessionId: "missing" });
      expect(getText(result)).toContain("not found");
    });

    it("should save gate results to database", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
        currentPhase: "BRAINSTORMING",
      });
      mockPrisma.workflowTransition.findMany.mockResolvedValue([]);
      mockPrisma.skillUsageEvent.findMany.mockResolvedValue([]);
      mockPrisma.gateCheckResult.create.mockResolvedValue({});

      const handler = registry.handlers.get("bazdmeg_superpowers_gate_check")!;
      await handler({ sessionId: "sess-1" });
      // Clears previous results then creates 5 new ones
      expect(mockPrisma.gateCheckResult.deleteMany).toHaveBeenCalledWith({
        where: { sessionId: "sess-1" },
      });
      expect(mockPrisma.gateCheckResult.create).toHaveBeenCalledTimes(5);
    });
  });

  describe("bazdmeg_superpowers_gate_override", () => {
    it("should override gate for admin", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
      });
      mockPrisma.gateCheckResult.create.mockResolvedValue({});

      const handler = registry.handlers.get(
        "bazdmeg_superpowers_gate_override",
      )!;
      const result = await handler({
        sessionId: "sess-1",
        gateName: "TDD",
        reason: "Hotfix — no time for tests",
      });
      expect(getText(result)).toContain("GREEN");
      expect(getText(result)).toContain("Hotfix");
      expect(mockPrisma.gateCheckResult.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: "sess-1",
          gateName: "TDD",
          status: "GREEN",
        }),
      });
    });

    it("should reject non-admin users", async () => {
      mockIsAdminByUserId.mockResolvedValue(false);
      const handler = registry.handlers.get(
        "bazdmeg_superpowers_gate_override",
      )!;
      const result = await handler({
        sessionId: "sess-1",
        gateName: "TDD",
        reason: "I want to skip it",
      });
      expect(getText(result)).toContain("Forbidden");
    });

    it("should reject invalid gate name", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
      });
      const handler = registry.handlers.get(
        "bazdmeg_superpowers_gate_override",
      )!;
      const result = await handler({
        sessionId: "sess-1",
        gateName: "InvalidGate",
        reason: "test",
      });
      expect(getText(result)).toContain("Invalid gate name");
    });

    it("should return not found for missing session in override", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get(
        "bazdmeg_superpowers_gate_override",
      )!;
      const result = await handler({
        sessionId: "missing-sess",
        gateName: "TDD",
        reason: "testing",
      });
      expect(getText(result)).toContain("not found");
    });
  });

  describe("bazdmeg_superpowers_gate_check edge cases", () => {
    it("should return YELLOW for review phase without review skill", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
        currentPhase: "FINISHING",
      });
      mockPrisma.workflowTransition.findMany.mockResolvedValue([
        {
          fromPhase: "BRAINSTORMING",
          toPhase: "PLANNING",
          createdAt: new Date(),
        },
        {
          fromPhase: "PLANNING",
          toPhase: "IMPLEMENTING",
          createdAt: new Date(),
        },
        {
          fromPhase: "IMPLEMENTING",
          toPhase: "REVIEWING",
          createdAt: new Date(),
        },
        { fromPhase: "REVIEWING", toPhase: "FINISHING", createdAt: new Date() },
      ]);
      // Skills for other phases, but no review skill
      mockPrisma.skillUsageEvent.findMany.mockResolvedValue([
        {
          skillName: "brainstorming",
          outcome: "success",
          createdAt: new Date(),
        },
        { skillName: "planning", outcome: "success", createdAt: new Date() },
        { skillName: "tdd", outcome: "success", createdAt: new Date() },
        {
          skillName: "verification-before-completion",
          outcome: "success",
          createdAt: new Date(),
        },
      ]);
      mockPrisma.gateCheckResult.create.mockResolvedValue({});

      const handler = registry.handlers.get("bazdmeg_superpowers_gate_check")!;
      const result = await handler({ sessionId: "sess-1" });
      const text = getText(result);
      expect(text).toContain("[YELLOW]");
      expect(text).toContain(
        "Review phase recorded but no review skill invoked",
      );
    });

    it("should return YELLOW overall when minor gaps exist", async () => {
      mockPrisma.superpowersSession.findFirst.mockResolvedValue({
        id: "sess-1",
        currentPhase: "FINISHING",
      });
      mockPrisma.workflowTransition.findMany.mockResolvedValue([
        {
          fromPhase: "BRAINSTORMING",
          toPhase: "PLANNING",
          createdAt: new Date(),
        },
        {
          fromPhase: "PLANNING",
          toPhase: "IMPLEMENTING",
          createdAt: new Date(),
        },
        {
          fromPhase: "IMPLEMENTING",
          toPhase: "REVIEWING",
          createdAt: new Date(),
        },
        { fromPhase: "REVIEWING", toPhase: "FINISHING", createdAt: new Date() },
      ]);
      // All skills except review — results in YELLOW for review gate, rest GREEN
      mockPrisma.skillUsageEvent.findMany.mockResolvedValue([
        {
          skillName: "brainstorming",
          outcome: "success",
          createdAt: new Date(),
        },
        { skillName: "planning", outcome: "success", createdAt: new Date() },
        { skillName: "tdd", outcome: "success", createdAt: new Date() },
        { skillName: "finishing", outcome: "success", createdAt: new Date() },
      ]);
      mockPrisma.gateCheckResult.create.mockResolvedValue({});

      const handler = registry.handlers.get("bazdmeg_superpowers_gate_check")!;
      const result = await handler({ sessionId: "sess-1" });
      const text = getText(result);
      expect(text).toContain("Minor gaps noted. Proceed with caution.");
    });
  });
});
