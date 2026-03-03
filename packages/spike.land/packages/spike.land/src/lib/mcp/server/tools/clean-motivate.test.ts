import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  cleaningSession: {
    findFirst: vi.fn(),
  },
  cleaningStreak: {
    findUnique: vi.fn(),
  },
  cleaningAchievement: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { registerCleanMotivateTools } from "./clean-motivate";

interface ToolResult {
  content: Array<{ text: string; }>;
  isError?: boolean;
}

function createMockRegistry() {
  const tools = new Map<
    string,
    {
      handler: (...args: unknown[]) => Promise<ToolResult>;
      inputSchema: Record<string, unknown>;
    }
  >();
  return {
    tools,
    register: vi.fn(
      (
        { name, handler, inputSchema }: {
          name: string;
          handler: (...args: unknown[]) => Promise<ToolResult>;
          inputSchema: Record<string, unknown>;
        },
      ) => {
        tools.set(name, { handler, inputSchema });
      },
    ),
  };
}

describe("Clean Motivate MCP Tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCleanMotivateTools(
      registry as unknown as Parameters<typeof registerCleanMotivateTools>[0],
      "user123",
    );
  });

  it("registers 4 motivate tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.tools.has("clean_motivate_get_encouragement")).toBe(true);
    expect(registry.tools.has("clean_motivate_check_achievements")).toBe(true);
    expect(registry.tools.has("clean_motivate_get_achievements")).toBe(true);
    expect(registry.tools.has("clean_motivate_celebrate")).toBe(true);
  });

  describe("clean_motivate_get_encouragement", () => {
    it("returns message for 'starting' context", async () => {
      const handler = registry.tools.get("clean_motivate_get_encouragement")!.handler;
      const result = await handler({ context: "starting" });

      // Should return one of the STARTING_MESSAGES
      expect(result.content[0]!.text.length).toBeGreaterThan(0);
      expect(result.isError).toBeUndefined();
    });

    it("returns message for 'task_complete' context", async () => {
      const handler = registry.tools.get("clean_motivate_get_encouragement")!.handler;
      const result = await handler({ context: "task_complete" });

      expect(result.content[0]!.text.length).toBeGreaterThan(0);
    });

    it("returns message for 'skip' context", async () => {
      const handler = registry.tools.get("clean_motivate_get_encouragement")!.handler;
      const result = await handler({ context: "skip" });

      expect(result.content[0]!.text.length).toBeGreaterThan(0);
    });

    it("returns message for 'session_complete' context", async () => {
      const handler = registry.tools.get("clean_motivate_get_encouragement")!.handler;
      const result = await handler({ context: "session_complete" });

      expect(result.content[0]!.text.length).toBeGreaterThan(0);
    });

    it("returns message for 'comeback' context", async () => {
      const handler = registry.tools.get("clean_motivate_get_encouragement")!.handler;
      const result = await handler({ context: "comeback" });

      expect(result.content[0]!.text.length).toBeGreaterThan(0);
    });

    it("returns fallback message when messages array is empty", async () => {
      // Temporarily replace CONTEXT_MESSAGES by providing a context not in the map
      // The code checks `if (!messages || messages.length === 0)` — line 67-68
      // We need to test with a context whose messages array is empty or undefined.
      // Since the handler uses a strict enum, we test by manipulating the imported module.
      // Actually, the CONTEXT_MESSAGES map always has entries for valid contexts.
      // The fallback triggers if messages is falsy (not in map) — but enum prevents invalid contexts.
      // We can test by directly calling with a context that somehow bypasses the enum at runtime.
      const handler = registry.tools.get("clean_motivate_get_encouragement")!.handler;
      // Force a context not in CONTEXT_MESSAGES to trigger the fallback branch
      const result = await handler({ context: "nonexistent_context" as never });

      expect(result.content[0]!.text).toBe("You're doing great! Keep going!");
    });
  });

  describe("clean_motivate_check_achievements", () => {
    it("finds new achievements", async () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes ago

      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        status: "COMPLETED",
        skippedTasks: 0,
        totalTasks: 5,
        completedAt: now,
        startedAt,
        tasks: [
          { id: "t1", status: "COMPLETED" },
          { id: "t2", status: "COMPLETED" },
        ],
      } as never);

      mockPrisma.cleaningStreak.findUnique.mockResolvedValueOnce({
        totalSessions: 1,
        currentStreak: 1,
        bestStreak: 1,
        totalTasks: 5,
        level: 1,
        lastSessionDate: null,
      } as never);

      mockPrisma.cleaningAchievement.findMany.mockResolvedValueOnce([]);
      mockPrisma.cleaningAchievement.createMany.mockResolvedValueOnce(
        { count: 1 } as never,
      );

      const handler = registry.tools.get("clean_motivate_check_achievements")!.handler;
      const result = await handler({ session_id: "sess-1" });

      // FIRST_SESSION should be unlocked (totalSessions >= 1)
      expect(result.content[0]!.text).toContain("Achievement");
      expect(result.content[0]!.text).toContain("First Steps");
    });

    it("returns no achievements message when none are new", async () => {
      const now = new Date();
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        status: "COMPLETED",
        skippedTasks: 1,
        totalTasks: 3,
        completedAt: now,
        startedAt: new Date(now.getTime() - 30 * 60 * 1000),
        tasks: [],
      } as never);

      mockPrisma.cleaningStreak.findUnique.mockResolvedValueOnce({
        totalSessions: 1,
        currentStreak: 1,
        bestStreak: 1,
        totalTasks: 3,
        level: 1,
        lastSessionDate: new Date(now.getTime() - 1000), // recent session to avoid COMEBACK_KID
      } as never);

      // Mark all time-dependent achievements as already unlocked to prevent flakiness
      // (FIRST_SESSION from totalSessions, NIGHT_OWL/EARLY_BIRD from local hour,
      //  COMEBACK_KID from real clock vs mocked lastSessionDate)
      const alreadyUnlocked = [
        { achievementType: "FIRST_SESSION" },
        { achievementType: "NIGHT_OWL" },
        { achievementType: "EARLY_BIRD" },
        { achievementType: "COMEBACK_KID" },
      ];
      mockPrisma.cleaningAchievement.findMany.mockResolvedValueOnce(
        alreadyUnlocked as never,
      );

      const handler = registry.tools.get("clean_motivate_check_achievements")!.handler;
      const result = await handler({ session_id: "sess-1" });

      expect(result.content[0]!.text).toContain("No new achievements");
    });

    it("returns error when session not found", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_motivate_check_achievements")!.handler;
      const result = await handler({ session_id: "bad" });

      expect(result.content[0]!.text).toContain("Session not found");
    });

    it("returns error when no streak data", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        tasks: [],
      } as never);
      mockPrisma.cleaningStreak.findUnique.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_motivate_check_achievements")!.handler;
      const result = await handler({ session_id: "sess-1" });

      expect(result.content[0]!.text).toContain("No streak data");
    });

    it("handles database error", async () => {
      mockPrisma.cleaningSession.findFirst.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_motivate_check_achievements")!.handler;
      const result = await handler({ session_id: "sess-1" });

      expect(result.isError).toBe(true);
    });
  });

  describe("clean_motivate_get_achievements", () => {
    it("returns all achievements with unlock status", async () => {
      mockPrisma.cleaningAchievement.findMany.mockResolvedValueOnce([
        {
          achievementType: "FIRST_SESSION",
          unlockedAt: new Date("2026-02-10T12:00:00Z"),
        },
        {
          achievementType: "THREE_DAY_STREAK",
          unlockedAt: new Date("2026-02-13T12:00:00Z"),
        },
      ] as never);

      const handler = registry.tools.get("clean_motivate_get_achievements")!.handler;
      const result = await handler({});

      expect(result.content[0]!.text).toContain("Your Achievements (2/15)");
      expect(result.content[0]!.text).toContain("[x] **First Steps**");
      expect(result.content[0]!.text).toContain("[x] **Getting Started**");
      expect(result.content[0]!.text).toContain("[ ] **Week Warrior**");
      expect(result.content[0]!.text).toContain("2026-02-10");
    });

    it("handles no unlocked achievements", async () => {
      mockPrisma.cleaningAchievement.findMany.mockResolvedValueOnce([]);

      const handler = registry.tools.get("clean_motivate_get_achievements")!.handler;
      const result = await handler({});

      expect(result.content[0]!.text).toContain("0/15");
      expect(result.content[0]!.text).not.toContain("[x]");
    });

    it("handles database error", async () => {
      mockPrisma.cleaningAchievement.findMany.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_motivate_get_achievements")!.handler;
      const result = await handler({});

      expect(result.isError).toBe(true);
    });
  });

  describe("clean_motivate_celebrate", () => {
    it("returns celebration message for valid achievement", async () => {
      const handler = registry.tools.get("clean_motivate_celebrate")!.handler;
      const result = await handler({ achievement_type: "FIRST_SESSION" });

      expect(result.content[0]!.text).toContain("First Steps");
      expect(result.content[0]!.text).toContain("cleaning journey begins");
    });

    it("returns celebration message for streak achievement", async () => {
      const handler = registry.tools.get("clean_motivate_celebrate")!.handler;
      const result = await handler({ achievement_type: "SEVEN_DAY_STREAK" });

      expect(result.content[0]!.text).toContain("Week Warrior");
      expect(result.content[0]!.text).toContain("whole week");
    });

    it("returns error for unknown achievement type", async () => {
      const handler = registry.tools.get("clean_motivate_celebrate")!.handler;
      const result = await handler({ achievement_type: "NONEXISTENT" });

      expect(result.content[0]!.text).toContain("not found");
    });
  });
});
