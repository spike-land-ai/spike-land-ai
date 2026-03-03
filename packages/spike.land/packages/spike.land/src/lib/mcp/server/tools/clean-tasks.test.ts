import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  cleaningSession: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  cleaningTask: {
    createMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  cleaningStreak: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { registerCleanTasksTools } from "./clean-tasks";

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

describe("Clean Tasks MCP Tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCleanTasksTools(
      registry as unknown as Parameters<typeof registerCleanTasksTools>[0],
      "user123",
    );
  });

  it("registers 8 task tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(8);
    expect(registry.tools.has("clean_tasks_start_session")).toBe(true);
    expect(registry.tools.has("clean_tasks_add_tasks")).toBe(true);
    expect(registry.tools.has("clean_tasks_list")).toBe(true);
    expect(registry.tools.has("clean_tasks_get_current")).toBe(true);
    expect(registry.tools.has("clean_tasks_skip")).toBe(true);
    expect(registry.tools.has("clean_tasks_complete")).toBe(true);
    expect(registry.tools.has("clean_tasks_end_session")).toBe(true);
    expect(registry.tools.has("clean_tasks_requeue_skipped")).toBe(true);
  });

  describe("clean_tasks_start_session", () => {
    it("creates a new session", async () => {
      mockPrisma.cleaningSession.create.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        roomLabel: "kitchen",
      } as never);

      const handler = registry.tools.get("clean_tasks_start_session")!.handler;
      const result = await handler({ room_label: "kitchen" });

      expect(result.content[0]!.text).toContain("Session started");
      expect(result.content[0]!.text).toContain("sess-1");
      expect(result.content[0]!.text).toContain("kitchen");
    });

    it("creates session without room label", async () => {
      mockPrisma.cleaningSession.create.mockResolvedValueOnce({
        id: "sess-2",
        userId: "user123",
        roomLabel: undefined,
      } as never);

      const handler = registry.tools.get("clean_tasks_start_session")!.handler;
      const result = await handler({});

      expect(result.content[0]!.text).toContain("Session started");
      expect(result.content[0]!.text).not.toContain("Room:");
    });

    it("handles database error", async () => {
      mockPrisma.cleaningSession.create.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_tasks_start_session")!.handler;
      const result = await handler({});

      expect(result.isError).toBe(true);
    });
  });

  describe("clean_tasks_add_tasks", () => {
    it("creates task records", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(
        { id: "sess-1", userId: "user123" } as never,
      );
      mockPrisma.cleaningTask.findFirst.mockResolvedValueOnce(null); // no existing tasks
      mockPrisma.cleaningTask.createMany.mockResolvedValueOnce(
        { count: 2 } as never,
      );
      mockPrisma.cleaningSession.update.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_tasks_add_tasks")!.handler;
      const result = await handler({
        session_id: "sess-1",
        tasks: [
          {
            description: "Wash dishes",
            category: "DISHES",
            difficulty: "EASY",
          },
          {
            description: "Vacuum floor",
            category: "FLOORS",
            difficulty: "MEDIUM",
          },
        ],
      });

      expect(result.content[0]!.text).toContain("2 task(s) added");
      expect(mockPrisma.cleaningTask.createMany).toHaveBeenCalled();
    });

    it("returns error for unowned session", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_tasks_add_tasks")!.handler;
      const result = await handler({
        session_id: "bad-sess",
        tasks: [{ description: "task", category: "OTHER", difficulty: "EASY" }],
      });

      expect(result.content[0]!.text).toContain("Session not found");
    });

    it("handles database error", async () => {
      mockPrisma.cleaningSession.findFirst.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_tasks_add_tasks")!.handler;
      const result = await handler({
        session_id: "sess-1",
        tasks: [{ description: "task", category: "OTHER", difficulty: "EASY" }],
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("clean_tasks_list", () => {
    it("returns all tasks in session", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        completedTasks: 1,
        totalTasks: 3,
        tasks: [
          {
            id: "t1",
            description: "Wash dishes",
            difficulty: "EASY",
            category: "DISHES",
            status: "COMPLETED",
            pointsValue: 10,
          },
          {
            id: "t2",
            description: "Vacuum floor",
            difficulty: "MEDIUM",
            category: "FLOORS",
            status: "PENDING",
            pointsValue: 20,
          },
          {
            id: "t3",
            description: "Wipe table",
            difficulty: "QUICK",
            category: "SURFACES",
            status: "SKIPPED",
            pointsValue: 5,
          },
        ],
      } as never);

      const handler = registry.tools.get("clean_tasks_list")!.handler;
      const result = await handler({ session_id: "sess-1" });

      expect(result.content[0]!.text).toContain("Session Tasks");
      expect(result.content[0]!.text).toContain("1/3 done");
      expect(result.content[0]!.text).toContain("Wash dishes");
      expect(result.content[0]!.text).toContain("[x]"); // COMPLETED
      expect(result.content[0]!.text).toContain("[ ]"); // PENDING
      expect(result.content[0]!.text).toContain("[-]"); // SKIPPED
    });

    it("handles empty session", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        tasks: [],
      } as never);

      const handler = registry.tools.get("clean_tasks_list")!.handler;
      const result = await handler({ session_id: "sess-1" });

      expect(result.content[0]!.text).toContain("no tasks yet");
    });

    it("handles task with unknown status (fallback icon)", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        completedTasks: 0,
        totalTasks: 1,
        tasks: [
          {
            id: "t1",
            description: "Unknown status task",
            difficulty: "EASY",
            category: "OTHER",
            status: "UNKNOWN_STATUS",
            pointsValue: 10,
          },
        ],
      } as never);

      const handler = registry.tools.get("clean_tasks_list")!.handler;
      const result = await handler({ session_id: "sess-1" });

      // Unknown status should fall back to "[ ]"
      expect(result.content[0]!.text).toContain("[ ]");
      expect(result.content[0]!.text).toContain("Unknown status task");
    });

    it("truncates long task descriptions in list output", async () => {
      const longDesc = "B".repeat(100);
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        completedTasks: 0,
        totalTasks: 1,
        tasks: [
          {
            id: "t1",
            description: longDesc,
            difficulty: "EASY",
            category: "OTHER",
            status: "PENDING",
            pointsValue: 10,
          },
        ],
      } as never);

      const handler = registry.tools.get("clean_tasks_list")!.handler;
      const result = await handler({ session_id: "sess-1" });

      expect(result.content[0]!.text).toContain("...");
    });

    it("returns error for unowned session", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_tasks_list")!.handler;
      const result = await handler({ session_id: "bad" });

      expect(result.content[0]!.text).toContain("Session not found");
    });
  });

  describe("clean_tasks_get_current", () => {
    it("returns first PENDING task", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(
        { id: "sess-1", userId: "user123" } as never,
      );
      mockPrisma.cleaningTask.findFirst.mockResolvedValueOnce({
        id: "t2",
        description: "Vacuum the floor thoroughly",
        category: "FLOORS",
        difficulty: "MEDIUM",
        pointsValue: 20,
      } as never);

      const handler = registry.tools.get("clean_tasks_get_current")!.handler;
      const result = await handler({ session_id: "sess-1" });

      expect(result.content[0]!.text).toContain("Current Task");
      expect(result.content[0]!.text).toContain("t2");
      expect(result.content[0]!.text).toContain("Vacuum the floor");
      expect(result.content[0]!.text).toContain("FLOORS");
      expect(result.content[0]!.text).toContain("20");
    });

    it("returns message when no pending tasks", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        completedTasks: 3,
        totalTasks: 3,
      } as never);
      mockPrisma.cleaningTask.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_tasks_get_current")!.handler;
      const result = await handler({ session_id: "sess-1" });

      expect(result.content[0]!.text).toContain("No pending tasks");
      expect(result.content[0]!.text).toContain("3/3");
    });

    it("returns error for unowned session", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_tasks_get_current")!.handler;
      const result = await handler({ session_id: "bad" });

      expect(result.content[0]!.text).toContain("Session not found");
    });
  });

  describe("clean_tasks_skip", () => {
    it("updates task to SKIPPED and increments session skippedTasks", async () => {
      mockPrisma.cleaningTask.findUnique.mockResolvedValueOnce({
        id: "t1",
        session: { userId: "user123", id: "sess-1" },
      } as never);
      mockPrisma.cleaningTask.update.mockResolvedValueOnce(undefined as never);
      mockPrisma.cleaningSession.update.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_tasks_skip")!.handler;
      const result = await handler({ task_id: "t1", reason: "Too hard" });

      expect(result.content[0]!.text).toContain("Task skipped");
      expect(result.content[0]!.text).toContain("Too hard");
      expect(mockPrisma.cleaningTask.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { status: "SKIPPED", skippedReason: "Too hard" },
      });
      expect(mockPrisma.cleaningSession.update).toHaveBeenCalledWith({
        where: { id: "sess-1" },
        data: { skippedTasks: { increment: 1 } },
      });
    });

    it("returns error for unowned task", async () => {
      mockPrisma.cleaningTask.findUnique.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_tasks_skip")!.handler;
      const result = await handler({ task_id: "bad" });

      expect(result.content[0]!.text).toContain("Task not found");
    });

    it("skips task without a reason", async () => {
      mockPrisma.cleaningTask.findUnique.mockResolvedValueOnce({
        id: "t1",
        session: { userId: "user123", id: "sess-1" },
      } as never);
      mockPrisma.cleaningTask.update.mockResolvedValueOnce(undefined as never);
      mockPrisma.cleaningSession.update.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_tasks_skip")!.handler;
      const result = await handler({ task_id: "t1" });

      expect(result.content[0]!.text).toContain("Task skipped");
      expect(result.content[0]!.text).not.toContain("Reason:");
    });

    it("returns error for task owned by different user", async () => {
      mockPrisma.cleaningTask.findUnique.mockResolvedValueOnce({
        id: "t1",
        session: { userId: "other-user", id: "sess-1" },
      } as never);

      const handler = registry.tools.get("clean_tasks_skip")!.handler;
      const result = await handler({ task_id: "t1" });

      expect(result.content[0]!.text).toContain("Task not found");
    });
  });

  describe("clean_tasks_complete", () => {
    it("updates task to COMPLETED and increments session completedTasks", async () => {
      mockPrisma.cleaningTask.findUnique.mockResolvedValueOnce({
        id: "t1",
        status: "PENDING",
        pointsValue: 20,
        session: { userId: "user123", id: "sess-1" },
      } as never);
      mockPrisma.cleaningTask.update.mockResolvedValueOnce(undefined as never);
      mockPrisma.cleaningSession.update.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_tasks_complete")!.handler;
      const result = await handler({ task_id: "t1" });

      expect(result.content[0]!.text).toContain("Task completed");
      expect(result.content[0]!.text).toContain("+20 points");
      expect(mockPrisma.cleaningTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "t1" },
          data: expect.objectContaining({ status: "COMPLETED" }),
        }),
      );
    });

    it("rejects already completed task", async () => {
      mockPrisma.cleaningTask.findUnique.mockResolvedValueOnce({
        id: "t1",
        status: "COMPLETED",
        pointsValue: 10,
        session: { userId: "user123", id: "sess-1" },
      } as never);

      const handler = registry.tools.get("clean_tasks_complete")!.handler;
      const result = await handler({ task_id: "t1" });

      expect(result.content[0]!.text).toContain("already completed");
    });

    it("returns error for unowned task", async () => {
      mockPrisma.cleaningTask.findUnique.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_tasks_complete")!.handler;
      const result = await handler({ task_id: "bad" });

      expect(result.content[0]!.text).toContain("Task not found");
    });

    it("handles database error", async () => {
      mockPrisma.cleaningTask.findUnique.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_tasks_complete")!.handler;
      const result = await handler({ task_id: "t1" });

      expect(result.isError).toBe(true);
    });
  });

  describe("clean_tasks_end_session", () => {
    it("calculates points and sets COMPLETED", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        status: "ACTIVE",
        completedTasks: 3,
        totalTasks: 3,
        skippedTasks: 0,
        roomLabel: "kitchen",
        tasks: [
          { id: "t1", status: "COMPLETED", pointsValue: 10 },
          { id: "t2", status: "COMPLETED", pointsValue: 20 },
          { id: "t3", status: "COMPLETED", pointsValue: 5 },
        ],
      } as never);
      mockPrisma.cleaningStreak.findUnique.mockResolvedValueOnce({
        currentStreak: 5,
      } as never);
      mockPrisma.cleaningSession.update.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_tasks_end_session")!.handler;
      const result = await handler({ session_id: "sess-1" });

      expect(result.content[0]!.text).toContain("Session Complete");
      expect(result.content[0]!.text).toContain("3/3");
      expect(result.content[0]!.text).toContain("Base points:** 35");
      expect(result.content[0]!.text).toContain("kitchen");
      expect(mockPrisma.cleaningSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sess-1" },
          data: expect.objectContaining({ status: "COMPLETED" }),
        }),
      );
    });

    it("handles session with zero completed tasks (no zero-skip bonus)", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        status: "ACTIVE",
        completedTasks: 0,
        totalTasks: 2,
        skippedTasks: 0,
        roomLabel: null,
        tasks: [
          { id: "t1", status: "PENDING", pointsValue: 10 },
          { id: "t2", status: "PENDING", pointsValue: 5 },
        ],
      } as never);
      mockPrisma.cleaningStreak.findUnique.mockResolvedValueOnce(null);
      mockPrisma.cleaningSession.update.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_tasks_end_session")!.handler;
      const result = await handler({ session_id: "sess-1" });

      const text = result.content[0]!.text;
      expect(text).toContain("Session Complete");
      expect(text).toContain("0/2");
      // zeroSkips requires completedTasks > 0, so no zero-skip bonus
      expect(text).not.toContain("Zero-skip bonus");
      // allTasksDone requires totalTasks > 0 and completedTasks + verified = totalTasks
      expect(text).not.toContain("All-tasks bonus");
    });

    it("handles session with only VERIFIED tasks (not COMPLETED)", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        status: "ACTIVE",
        completedTasks: 0,
        totalTasks: 1,
        skippedTasks: 0,
        roomLabel: null,
        tasks: [
          { id: "t1", status: "VERIFIED", pointsValue: 15 },
        ],
      } as never);
      mockPrisma.cleaningStreak.findUnique.mockResolvedValueOnce(null);
      mockPrisma.cleaningSession.update.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_tasks_end_session")!.handler;
      const result = await handler({ session_id: "sess-1" });

      const text = result.content[0]!.text;
      expect(text).toContain("Session Complete");
      // VERIFIED task contributes to taskPoints
      expect(text).toContain("Base points:** 15");
      // hasVerificationPhoto should be true
      expect(text).toContain("Verification bonus");
    });

    it("handles session with totalTasks 0 (allTasksDone requires totalTasks > 0)", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        status: "ACTIVE",
        completedTasks: 0,
        totalTasks: 0,
        skippedTasks: 0,
        roomLabel: null,
        tasks: [],
      } as never);
      mockPrisma.cleaningStreak.findUnique.mockResolvedValueOnce(null);
      mockPrisma.cleaningSession.update.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_tasks_end_session")!.handler;
      const result = await handler({ session_id: "sess-1" });

      const text = result.content[0]!.text;
      expect(text).toContain("Session Complete");
      // With totalTasks = 0, allTasksDone should be false
      expect(text).not.toContain("All-tasks bonus");
    });

    it("rejects already completed session", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
        status: "COMPLETED",
        tasks: [],
      } as never);

      const handler = registry.tools.get("clean_tasks_end_session")!.handler;
      const result = await handler({ session_id: "sess-1" });

      expect(result.content[0]!.text).toContain("already completed");
    });

    it("returns error for unowned session", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_tasks_end_session")!.handler;
      const result = await handler({ session_id: "bad" });

      expect(result.content[0]!.text).toContain("Session not found");
    });

    it("handles database error", async () => {
      mockPrisma.cleaningSession.findFirst.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_tasks_end_session")!.handler;
      const result = await handler({ session_id: "sess-1" });

      expect(result.isError).toBe(true);
    });
  });

  describe("clean_tasks_requeue_skipped", () => {
    it("moves SKIPPED tasks back to PENDING", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(
        { id: "sess-1", userId: "user123" } as never,
      );
      mockPrisma.cleaningTask.updateMany.mockResolvedValueOnce(
        { count: 2 } as never,
      );
      mockPrisma.cleaningSession.update.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_tasks_requeue_skipped")!.handler;
      const result = await handler({ session_id: "sess-1" });

      expect(result.content[0]!.text).toContain("2 task(s) requeued");
      expect(mockPrisma.cleaningTask.updateMany).toHaveBeenCalledWith({
        where: { sessionId: "sess-1", status: "SKIPPED" },
        data: { status: "PENDING", skippedReason: null },
      });
      expect(mockPrisma.cleaningSession.update).toHaveBeenCalledWith({
        where: { id: "sess-1" },
        data: { skippedTasks: 0 },
      });
    });

    it("returns message when no skipped tasks", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(
        { id: "sess-1", userId: "user123" } as never,
      );
      mockPrisma.cleaningTask.updateMany.mockResolvedValueOnce(
        { count: 0 } as never,
      );

      const handler = registry.tools.get("clean_tasks_requeue_skipped")!.handler;
      const result = await handler({ session_id: "sess-1" });

      expect(result.content[0]!.text).toContain("No skipped tasks");
    });

    it("returns error for unowned session", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_tasks_requeue_skipped")!.handler;
      const result = await handler({ session_id: "bad" });

      expect(result.content[0]!.text).toContain("Session not found");
    });

    it("handles database error", async () => {
      mockPrisma.cleaningSession.findFirst.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_tasks_requeue_skipped")!.handler;
      const result = await handler({ session_id: "sess-1" });

      expect(result.isError).toBe(true);
    });
  });
});
