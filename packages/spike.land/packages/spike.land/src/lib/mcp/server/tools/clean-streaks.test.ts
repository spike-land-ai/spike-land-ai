import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  cleaningSession: {
    findFirst: vi.fn(),
  },
  cleaningStreak: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { registerCleanStreaksTools } from "./clean-streaks";

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

describe("Clean Streaks MCP Tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCleanStreaksTools(
      registry as unknown as Parameters<typeof registerCleanStreaksTools>[0],
      "user123",
    );
  });

  it("registers 3 streak tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.tools.has("clean_streaks_get")).toBe(true);
    expect(registry.tools.has("clean_streaks_record_session")).toBe(true);
    expect(registry.tools.has("clean_streaks_get_stats")).toBe(true);
  });

  describe("clean_streaks_get", () => {
    it("returns streak data via upsert", async () => {
      mockPrisma.cleaningStreak.upsert.mockResolvedValueOnce({
        currentStreak: 5,
        bestStreak: 10,
        level: 3,
        totalPoints: 350,
        totalSessions: 15,
        totalTasks: 80,
        lastSessionDate: new Date("2026-02-14T12:00:00Z"),
      } as never);

      const handler = registry.tools.get("clean_streaks_get")!.handler;
      const result = await handler({});

      expect(result.content[0]!.text).toContain("Current streak:** 5");
      expect(result.content[0]!.text).toContain("Best streak:** 10");
      expect(result.content[0]!.text).toContain("Level:** 3");
      expect(result.content[0]!.text).toContain("Total points:** 350");
      expect(result.content[0]!.text).toContain("Total sessions:** 15");
      expect(result.content[0]!.text).toContain("Total tasks:** 80");
      expect(result.content[0]!.text).toContain("2026-02-14");
    });

    it("handles no lastSessionDate", async () => {
      mockPrisma.cleaningStreak.upsert.mockResolvedValueOnce({
        currentStreak: 0,
        bestStreak: 0,
        level: 1,
        totalPoints: 0,
        totalSessions: 0,
        totalTasks: 0,
        lastSessionDate: null,
      } as never);

      const handler = registry.tools.get("clean_streaks_get")!.handler;
      const result = await handler({});

      expect(result.content[0]!.text).toContain("Current streak:** 0");
      expect(result.content[0]!.text).not.toContain("Last session:");
    });

    it("handles database error", async () => {
      mockPrisma.cleaningStreak.upsert.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_streaks_get")!.handler;
      const result = await handler({});

      expect(result.isError).toBe(true);
    });
  });

  describe("clean_streaks_record_session", () => {
    it("updates streak on consecutive day", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        status: "COMPLETED",
      } as never);
      mockPrisma.cleaningStreak.upsert.mockResolvedValueOnce({
        currentStreak: 3,
        bestStreak: 5,
        totalPoints: 200,
        totalSessions: 10,
        totalTasks: 50,
        level: 2,
        lastSessionDate: yesterday,
      } as never);
      mockPrisma.cleaningStreak.update.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_streaks_record_session")!.handler;
      const result = await handler({
        session_id: "sess-1",
        points_earned: 50,
        tasks_completed: 5,
      });

      expect(result.content[0]!.text).toContain("Streak Updated");
      expect(result.content[0]!.text).toContain("Current streak:** 4");
      expect(result.content[0]!.text).toContain("+1!");
      expect(result.content[0]!.text).toContain("+50");
    });

    it("resets streak on non-consecutive day", async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        status: "COMPLETED",
      } as never);
      mockPrisma.cleaningStreak.upsert.mockResolvedValueOnce({
        currentStreak: 5,
        bestStreak: 10,
        totalPoints: 500,
        totalSessions: 20,
        totalTasks: 100,
        level: 4,
        lastSessionDate: threeDaysAgo,
      } as never);
      mockPrisma.cleaningStreak.update.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_streaks_record_session")!.handler;
      const result = await handler({
        session_id: "sess-1",
        points_earned: 30,
        tasks_completed: 3,
      });

      expect(result.content[0]!.text).toContain("Current streak:** 1");
    });

    it("does not increment streak on same day", async () => {
      const today = new Date();

      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        status: "COMPLETED",
      } as never);
      mockPrisma.cleaningStreak.upsert.mockResolvedValueOnce({
        currentStreak: 3,
        bestStreak: 5,
        totalPoints: 200,
        totalSessions: 10,
        totalTasks: 50,
        level: 2,
        lastSessionDate: today,
      } as never);
      mockPrisma.cleaningStreak.update.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_streaks_record_session")!.handler;
      const result = await handler({
        session_id: "sess-1",
        points_earned: 25,
        tasks_completed: 2,
      });

      // Streak stays at 3 (same day)
      expect(result.content[0]!.text).toContain("Current streak:** 3");
      expect(result.content[0]!.text).not.toContain("+1!");
    });

    it("sets streak to 1 on first session ever", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        status: "COMPLETED",
      } as never);
      mockPrisma.cleaningStreak.upsert.mockResolvedValueOnce({
        currentStreak: 0,
        bestStreak: 0,
        totalPoints: 0,
        totalSessions: 0,
        totalTasks: 0,
        level: 1,
        lastSessionDate: null,
      } as never);
      mockPrisma.cleaningStreak.update.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_streaks_record_session")!.handler;
      const result = await handler({
        session_id: "sess-1",
        points_earned: 100,
        tasks_completed: 5,
      });

      expect(result.content[0]!.text).toContain("Current streak:** 1");
    });

    it("returns error for non-completed session", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_streaks_record_session")!.handler;
      const result = await handler({
        session_id: "active-sess",
        points_earned: 50,
        tasks_completed: 5,
      });

      expect(result.content[0]!.text).toContain("not found");
    });

    it("handles database error", async () => {
      mockPrisma.cleaningSession.findFirst.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_streaks_record_session")!.handler;
      const result = await handler({
        session_id: "sess-1",
        points_earned: 50,
        tasks_completed: 5,
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("clean_streaks_get_stats", () => {
    it("returns full stats with level progress", async () => {
      mockPrisma.cleaningStreak.upsert.mockResolvedValueOnce({
        currentStreak: 7,
        bestStreak: 14,
        level: 3,
        totalPoints: 350,
        totalSessions: 20,
        totalTasks: 100,
        lastSessionDate: new Date("2026-02-15T12:00:00Z"),
      } as never);

      const handler = registry.tools.get("clean_streaks_get_stats")!.handler;
      const result = await handler({});

      expect(result.content[0]!.text).toContain("CleanSweep Stats");
      expect(result.content[0]!.text).toContain("Current:** 7");
      expect(result.content[0]!.text).toContain("Best:** 14");
      expect(result.content[0]!.text).toContain("Level:** 3");
      expect(result.content[0]!.text).toContain("Progress:**");
      expect(result.content[0]!.text).toContain("Total sessions:** 20");
      expect(result.content[0]!.text).toContain("Total tasks:** 100");
    });

    it("returns stats without last session date when null", async () => {
      mockPrisma.cleaningStreak.upsert.mockResolvedValueOnce({
        currentStreak: 0,
        bestStreak: 0,
        level: 1,
        totalPoints: 0,
        totalSessions: 0,
        totalTasks: 0,
        lastSessionDate: null,
      } as never);

      const handler = registry.tools.get("clean_streaks_get_stats")!.handler;
      const result = await handler({});

      expect(result.content[0]!.text).toContain("CleanSweep Stats");
      expect(result.content[0]!.text).not.toContain("Last session:");
    });

    it("handles database error", async () => {
      mockPrisma.cleaningStreak.upsert.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_streaks_get_stats")!.handler;
      const result = await handler({});

      expect(result.isError).toBe(true);
    });
  });
});
