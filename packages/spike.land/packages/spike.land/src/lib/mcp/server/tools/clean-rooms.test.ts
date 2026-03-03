import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  cleaningReminder: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  cleaningSession: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  cleaningStreak: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { registerCleanRoomsTools } from "./clean-rooms";

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

describe("Clean Rooms MCP Tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCleanRoomsTools(
      registry as unknown as Parameters<typeof registerCleanRoomsTools>[0],
      "user123",
    );
  });

  // ── Registration ────────────────────────────────────────────────────────────

  it("registers 5 room tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.tools.has("clean_create_room")).toBe(true);
    expect(registry.tools.has("clean_list_rooms")).toBe(true);
    expect(registry.tools.has("clean_get_room_history")).toBe(true);
    expect(registry.tools.has("clean_get_statistics")).toBe(true);
    expect(registry.tools.has("clean_set_schedule")).toBe(true);
  });

  // ── clean_create_room ───────────────────────────────────────────────────────

  describe("clean_create_room", () => {
    it("creates a room reminder and returns room ID and schedule suggestion", async () => {
      mockPrisma.cleaningReminder.create.mockResolvedValueOnce({
        id: "room-1",
        userId: "user123",
        time: "09:00",
        days: ["MON"],
        message:
          "__room_schedule__{\"roomName\":\"Kitchen\",\"roomType\":\"kitchen\",\"priority\":\"high\"}",
      } as never);

      const handler = registry.tools.get("clean_create_room")!.handler;
      const result = await handler({
        name: "Kitchen",
        room_type: "kitchen",
        priority: "high",
      });

      const text = result.content[0]!.text;
      expect(text).toContain("Room created");
      expect(text).toContain("room-1");
      expect(text).toContain("Kitchen");
      expect(text).toContain("kitchen");
      expect(text).toContain("high");
      expect(text).toContain("Suggested schedule:");
      expect(mockPrisma.cleaningReminder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user123",
            time: "09:00",
          }),
        }),
      );
    });

    it("defaults priority to medium when not provided", async () => {
      mockPrisma.cleaningReminder.create.mockResolvedValueOnce({
        id: "room-2",
        time: "09:00",
        days: ["MON"],
        message:
          "__room_schedule__{\"roomName\":\"Bedroom\",\"roomType\":\"bedroom\",\"priority\":\"medium\"}",
      } as never);

      const handler = registry.tools.get("clean_create_room")!.handler;
      const result = await handler({
        name: "Bedroom",
        room_type: "bedroom",
      });

      expect(result.content[0]!.text).toContain("medium");
      expect(mockPrisma.cleaningReminder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: expect.stringContaining("\"priority\":\"medium\""),
          }),
        }),
      );
    });

    it("handles database error gracefully", async () => {
      mockPrisma.cleaningReminder.create.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_create_room")!.handler;
      const result = await handler({
        name: "Garage",
        room_type: "garage",
      });

      expect(result.isError).toBe(true);
    });
  });

  // ── clean_list_rooms ────────────────────────────────────────────────────────

  describe("clean_list_rooms", () => {
    it("returns all defined rooms sorted by name by default", async () => {
      mockPrisma.cleaningReminder.findMany.mockResolvedValueOnce([
        {
          id: "room-2",
          message:
            "__room_schedule__{\"roomName\":\"Bedroom\",\"roomType\":\"bedroom\",\"priority\":\"low\"}",
        },
        {
          id: "room-1",
          message:
            "__room_schedule__{\"roomName\":\"Bathroom\",\"roomType\":\"bathroom\",\"priority\":\"high\"}",
        },
      ] as never);

      const lastCleaned = new Date("2026-02-20T10:00:00Z");
      mockPrisma.cleaningSession.findFirst
        .mockResolvedValueOnce({ completedAt: lastCleaned } as never) // Bedroom
        .mockResolvedValueOnce(null as never); // Bathroom

      const handler = registry.tools.get("clean_list_rooms")!.handler;
      const result = await handler({});

      const text = result.content[0]!.text;
      expect(text).toContain("Your Rooms (2)");
      expect(text).toContain("Bathroom");
      expect(text).toContain("Bedroom");
      // Name sort: Bathroom before Bedroom
      expect(text.indexOf("Bathroom")).toBeLessThan(text.indexOf("Bedroom"));
    });

    it("returns message when no rooms defined", async () => {
      mockPrisma.cleaningReminder.findMany.mockResolvedValueOnce([] as never);

      const handler = registry.tools.get("clean_list_rooms")!.handler;
      const result = await handler({});

      expect(result.content[0]!.text).toContain("No rooms defined yet");
    });

    it("sorts by priority when sort_by is 'priority'", async () => {
      mockPrisma.cleaningReminder.findMany.mockResolvedValueOnce([
        {
          id: "room-1",
          message:
            "__room_schedule__{\"roomName\":\"Office\",\"roomType\":\"office\",\"priority\":\"low\"}",
        },
        {
          id: "room-2",
          message:
            "__room_schedule__{\"roomName\":\"Kitchen\",\"roomType\":\"kitchen\",\"priority\":\"high\"}",
        },
      ] as never);

      mockPrisma.cleaningSession.findFirst
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(null as never);

      const handler = registry.tools.get("clean_list_rooms")!.handler;
      const result = await handler({ sort_by: "priority" });

      const text = result.content[0]!.text;
      // High priority (Kitchen) should appear before low priority (Office)
      expect(text.indexOf("Kitchen")).toBeLessThan(text.indexOf("Office"));
    });

    it("sorts by last_cleaned — oldest first", async () => {
      mockPrisma.cleaningReminder.findMany.mockResolvedValueOnce([
        {
          id: "room-1",
          message:
            "__room_schedule__{\"roomName\":\"Laundry\",\"roomType\":\"laundry\",\"priority\":\"medium\"}",
        },
        {
          id: "room-2",
          message:
            "__room_schedule__{\"roomName\":\"Living Room\",\"roomType\":\"living_room\",\"priority\":\"medium\"}",
        },
      ] as never);

      const recent = new Date("2026-02-25T10:00:00Z");
      const old = new Date("2026-01-01T10:00:00Z");
      mockPrisma.cleaningSession.findFirst
        .mockResolvedValueOnce({ completedAt: recent } as never) // Laundry
        .mockResolvedValueOnce({ completedAt: old } as never); // Living Room

      const handler = registry.tools.get("clean_list_rooms")!.handler;
      const result = await handler({ sort_by: "last_cleaned" });

      const text = result.content[0]!.text;
      // Oldest cleaned (Living Room, Jan 1) should appear first
      expect(text.indexOf("Living Room")).toBeLessThan(text.indexOf("Laundry"));
    });

    it("handles malformed room metadata without throwing", async () => {
      mockPrisma.cleaningReminder.findMany.mockResolvedValueOnce([
        {
          id: "room-bad",
          message: "__room_schedule__{INVALID_JSON",
        },
      ] as never);
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(null as never);

      const handler = registry.tools.get("clean_list_rooms")!.handler;
      const result = await handler({});

      // Should not throw; falls back to Unknown
      expect(result.isError).toBeUndefined();
      expect(result.content[0]!.text).toContain("Your Rooms (1)");
    });

    it("handles database error gracefully", async () => {
      mockPrisma.cleaningReminder.findMany.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_list_rooms")!.handler;
      const result = await handler({});

      expect(result.isError).toBe(true);
    });
  });

  // ── clean_get_room_history ──────────────────────────────────────────────────

  describe("clean_get_room_history", () => {
    it("returns cleaning history for a valid room", async () => {
      mockPrisma.cleaningReminder.findFirst.mockResolvedValueOnce({
        id: "room-1",
        message:
          "__room_schedule__{\"roomName\":\"Kitchen\",\"roomType\":\"kitchen\",\"priority\":\"high\"}",
      } as never);

      const completedAt = new Date("2026-02-20T12:00:00Z");
      const startedAt = new Date("2026-02-20T11:30:00Z");
      mockPrisma.cleaningSession.findMany.mockResolvedValueOnce([
        {
          id: "sess-1",
          completedAt,
          startedAt,
          totalTasks: 4,
          tasks: [
            { status: "COMPLETED", pointsValue: 20, completedAt },
            { status: "COMPLETED", pointsValue: 15, completedAt },
            { status: "SKIPPED", pointsValue: 5, completedAt: null },
            { status: "COMPLETED", pointsValue: 10, completedAt },
          ],
        },
      ] as never);

      const handler = registry.tools.get("clean_get_room_history")!.handler;
      const result = await handler({ room_id: "room-1" });

      const text = result.content[0]!.text;
      expect(text).toContain("Kitchen");
      expect(text).toContain("2026-02-20");
      expect(text).toContain("Tasks completed: 3/4");
      expect(text).toContain("Points earned: 45");
    });

    it("returns not-found message for unknown room_id", async () => {
      mockPrisma.cleaningReminder.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_get_room_history")!.handler;
      const result = await handler({ room_id: "bad-id" });

      expect(result.content[0]!.text).toContain("Room not found");
    });

    it("returns helpful message when no sessions exist for the room", async () => {
      mockPrisma.cleaningReminder.findFirst.mockResolvedValueOnce({
        id: "room-1",
        message:
          "__room_schedule__{\"roomName\":\"Office\",\"roomType\":\"office\",\"priority\":\"medium\"}",
      } as never);
      mockPrisma.cleaningSession.findMany.mockResolvedValueOnce([] as never);

      const handler = registry.tools.get("clean_get_room_history")!.handler;
      const result = await handler({ room_id: "room-1", period: "7d" });

      const text = result.content[0]!.text;
      expect(text).toContain("No completed cleaning sessions");
      expect(text).toContain("Office");
    });

    it("filters by the specified period", async () => {
      mockPrisma.cleaningReminder.findFirst.mockResolvedValueOnce({
        id: "room-1",
        message:
          "__room_schedule__{\"roomName\":\"Bathroom\",\"roomType\":\"bathroom\",\"priority\":\"high\"}",
      } as never);
      mockPrisma.cleaningSession.findMany.mockResolvedValueOnce([
        {
          id: "sess-2",
          completedAt: new Date("2026-02-25T09:00:00Z"),
          startedAt: new Date("2026-02-25T08:45:00Z"),
          totalTasks: 2,
          tasks: [
            { status: "COMPLETED", pointsValue: 10, completedAt: new Date() },
            { status: "COMPLETED", pointsValue: 10, completedAt: new Date() },
          ],
        },
      ] as never);

      const handler = registry.tools.get("clean_get_room_history")!.handler;
      const result = await handler({ room_id: "room-1", period: "7d" });

      // Verify the query went through (session data rendered)
      expect(result.content[0]!.text).toContain("2026-02-25");
      // Verify period label is shown
      expect(result.content[0]!.text).toContain("7d");
    });

    it("handles database error gracefully", async () => {
      mockPrisma.cleaningReminder.findFirst.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_get_room_history")!.handler;
      const result = await handler({ room_id: "room-1" });

      expect(result.isError).toBe(true);
    });
  });

  // ── clean_get_statistics ────────────────────────────────────────────────────

  describe("clean_get_statistics", () => {
    it("returns statistics when completed sessions exist", async () => {
      const startedAt = new Date("2026-02-20T10:00:00Z");
      const completedAt = new Date("2026-02-20T10:45:00Z");

      mockPrisma.cleaningSession.findMany.mockResolvedValueOnce([
        {
          id: "sess-1",
          roomLabel: "Kitchen",
          startedAt,
          completedAt,
          tasks: [
            { status: "COMPLETED", pointsValue: 20 },
            { status: "COMPLETED", pointsValue: 10 },
            { status: "SKIPPED", pointsValue: 5 },
          ],
        },
        {
          id: "sess-2",
          roomLabel: "Bathroom",
          startedAt,
          completedAt,
          tasks: [
            { status: "COMPLETED", pointsValue: 15 },
          ],
        },
      ] as never);

      mockPrisma.cleaningStreak.findUnique.mockResolvedValueOnce({
        currentStreak: 3,
        bestStreak: 7,
        level: 2,
      } as never);

      const handler = registry.tools.get("clean_get_statistics")!.handler;
      const result = await handler({ period: "30d" });

      const text = result.content[0]!.text;
      expect(text).toContain("CleanSweep Statistics");
      expect(text).toContain("Total sessions:** 2");
      expect(text).toContain("Tasks completed:** 3");
      expect(text).toContain("Total points:** 45");
      expect(text).toContain("Current streak:** 3");
      expect(text).toContain("Level:** 2");
    });

    it("returns message when no sessions exist in the period", async () => {
      mockPrisma.cleaningSession.findMany.mockResolvedValueOnce([] as never);
      mockPrisma.cleaningStreak.findUnique.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_get_statistics")!.handler;
      const result = await handler({});

      expect(result.content[0]!.text).toContain("No completed sessions found");
    });

    it("reports cleanest room by average points per session", async () => {
      const startedAt = new Date("2026-02-01T10:00:00Z");
      const completedAt = new Date("2026-02-01T10:30:00Z");

      mockPrisma.cleaningSession.findMany.mockResolvedValueOnce([
        {
          id: "s1",
          roomLabel: "Office",
          startedAt,
          completedAt,
          tasks: [{ status: "COMPLETED", pointsValue: 100 }],
        },
        {
          id: "s2",
          roomLabel: "Garage",
          startedAt,
          completedAt,
          tasks: [{ status: "COMPLETED", pointsValue: 10 }],
        },
      ] as never);

      mockPrisma.cleaningStreak.findUnique.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_get_statistics")!.handler;
      const result = await handler({ period: "90d" });

      // Office has highest avg points (100 vs 10)
      expect(result.content[0]!.text).toContain("Cleanest room:** Office");
    });

    it("handles sessions without startedAt/completedAt (no duration reported)", async () => {
      mockPrisma.cleaningSession.findMany.mockResolvedValueOnce([
        {
          id: "s1",
          roomLabel: "Bedroom",
          startedAt: null,
          completedAt: null,
          tasks: [{ status: "COMPLETED", pointsValue: 30 }],
        },
      ] as never);

      mockPrisma.cleaningStreak.findUnique.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_get_statistics")!.handler;
      const result = await handler({});

      const text = result.content[0]!.text;
      expect(text).toContain("Total sessions:** 1");
      // No avg session length when duration not available
      expect(text).not.toContain("Avg session length");
    });

    it("handles database error gracefully", async () => {
      mockPrisma.cleaningSession.findMany.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_get_statistics")!.handler;
      const result = await handler({});

      expect(result.isError).toBe(true);
    });
  });

  // ── clean_set_schedule ──────────────────────────────────────────────────────

  describe("clean_set_schedule", () => {
    it("sets a weekly schedule and returns next scheduled date", async () => {
      mockPrisma.cleaningReminder.findFirst.mockResolvedValueOnce({
        id: "room-1",
        message:
          "__room_schedule__{\"roomName\":\"Bathroom\",\"roomType\":\"bathroom\",\"priority\":\"high\"}",
      } as never);
      mockPrisma.cleaningReminder.update.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_set_schedule")!.handler;
      const result = await handler({
        room_id: "room-1",
        frequency: "weekly",
        preferred_day: "saturday",
        preferred_time: "10:00",
      });

      const text = result.content[0]!.text;
      expect(text).toContain("Schedule set for Bathroom");
      expect(text).toContain("Once a week");
      expect(text).toContain("saturday");
      expect(text).toContain("10:00");
      expect(text).toContain("Next scheduled clean:");
      expect(mockPrisma.cleaningReminder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "room-1" },
          data: expect.objectContaining({ time: "10:00", enabled: true }),
        }),
      );
    });

    it("returns not-found message for unknown room_id", async () => {
      mockPrisma.cleaningReminder.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_set_schedule")!.handler;
      const result = await handler({
        room_id: "bad-id",
        frequency: "monthly",
      });

      expect(result.content[0]!.text).toContain("Room not found");
    });

    it("sets daily schedule without preferred day", async () => {
      mockPrisma.cleaningReminder.findFirst.mockResolvedValueOnce({
        id: "room-2",
        message:
          "__room_schedule__{\"roomName\":\"Kitchen\",\"roomType\":\"kitchen\",\"priority\":\"medium\"}",
      } as never);
      mockPrisma.cleaningReminder.update.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_set_schedule")!.handler;
      const result = await handler({
        room_id: "room-2",
        frequency: "daily",
      });

      const text = result.content[0]!.text;
      expect(text).toContain("Every day");
      // Daily schedule should have all 7 days in the update
      expect(mockPrisma.cleaningReminder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            days: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
          }),
        }),
      );
    });

    it("sets biweekly schedule and shows correct label", async () => {
      mockPrisma.cleaningReminder.findFirst.mockResolvedValueOnce({
        id: "room-3",
        message:
          "__room_schedule__{\"roomName\":\"Garage\",\"roomType\":\"garage\",\"priority\":\"low\"}",
      } as never);
      mockPrisma.cleaningReminder.update.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_set_schedule")!.handler;
      const result = await handler({
        room_id: "room-3",
        frequency: "biweekly",
        preferred_day: "wednesday",
      });

      expect(result.content[0]!.text).toContain("Every two weeks");
    });

    it("handles database error gracefully", async () => {
      mockPrisma.cleaningReminder.findFirst.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_set_schedule")!.handler;
      const result = await handler({
        room_id: "room-1",
        frequency: "weekly",
      });

      expect(result.isError).toBe(true);
    });
  });
});
