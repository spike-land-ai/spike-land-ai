/**
 * CleanSweep — Standalone Tool Tests
 */

import { describe, expect, it, vi } from "vitest";
import { cleansweepTools } from "./tools";
import { createMockContext, createMockRegistry } from "../shared/test-utils";

// Mock all external dependencies
vi.mock("@/lib/prisma", () => ({
  default: {
    cleaningSession: {
      create: vi.fn().mockResolvedValue({ id: "session-1" }),
      findFirst: vi.fn().mockResolvedValue({
        id: "session-1",
        userId: "test-user-id",
        status: "ACTIVE",
        completedTasks: 2,
        totalTasks: 5,
        skippedTasks: 0,
        roomLabel: "kitchen",
        startedAt: new Date("2026-01-01"),
        completedAt: new Date("2026-01-01T01:00:00"),
        tasks: [
          {
            id: "t1",
            status: "COMPLETED",
            pointsValue: 10,
            description: "Pick up toys",
            difficulty: "EASY",
            category: "PICKUP",
            orderIndex: 0,
            completedAt: new Date(),
          },
          {
            id: "t2",
            status: "PENDING",
            pointsValue: 20,
            description: "Wash dishes",
            difficulty: "MEDIUM",
            category: "DISHES",
            orderIndex: 1,
            completedAt: null,
          },
        ],
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    cleaningTask: {
      findFirst: vi.fn().mockResolvedValue({
        id: "t2",
        description: "Wash dishes",
        category: "DISHES",
        difficulty: "MEDIUM",
        pointsValue: 20,
        status: "PENDING",
        orderIndex: 1,
        session: { userId: "test-user-id", id: "session-1" },
      }),
      findUnique: vi.fn().mockResolvedValue({
        id: "t2",
        description: "Wash dishes",
        pointsValue: 20,
        status: "PENDING",
        completedAt: null,
        session: { userId: "test-user-id", id: "session-1" },
      }),
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    cleaningStreak: {
      upsert: vi.fn().mockResolvedValue({
        userId: "test-user-id",
        currentStreak: 3,
        bestStreak: 5,
        level: 2,
        totalPoints: 150,
        totalSessions: 10,
        totalTasks: 50,
        lastSessionDate: new Date("2026-01-01"),
      }),
      findUnique: vi.fn().mockResolvedValue({
        userId: "test-user-id",
        currentStreak: 3,
        bestStreak: 5,
        level: 2,
        totalPoints: 150,
        totalSessions: 10,
        totalTasks: 50,
        lastSessionDate: new Date("2026-01-01"),
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    cleaningReminder: {
      create: vi.fn().mockResolvedValue({
        id: "rem-1",
        time: "09:00",
        days: ["MON", "WED", "FRI"],
        message: null,
        enabled: true,
      }),
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: "rem-1", time: "09:00", days: ["MON", "WED", "FRI"], message: null, enabled: true },
        ]),
      findFirst: vi.fn().mockResolvedValue({
        id: "rem-1",
        userId: "test-user-id",
      }),
      update: vi.fn().mockResolvedValue({
        id: "rem-1",
        time: "10:00",
        days: ["MON"],
        message: "Time to clean!",
        enabled: true,
      }),
      delete: vi.fn().mockResolvedValue({}),
    },
    cleaningAchievement: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

vi.mock("@/lib/clean/photo-validation", () => ({
  validatePhoto: vi.fn().mockReturnValue({
    valid: true,
    isScreenshot: false,
    ageSeconds: 30,
    cameraModel: "iPhone 15",
    rejectionReason: null,
  }),
  extractPhotoMetadata: vi.fn().mockReturnValue({
    hasExif: true,
    cameraModel: "iPhone 15",
    timestamp: new Date("2026-01-01T12:00:00Z"),
    software: "iOS 19",
  }),
}));

vi.mock("@/lib/clean/gamification", () => ({
  POINTS: { QUICK: 5, EASY: 10, MEDIUM: 20, EFFORT: 40 },
  BONUSES: { VERIFICATION_PHOTO: 15 },
  ACHIEVEMENTS: [
    {
      type: "FIRST_SESSION",
      name: "First Steps",
      description: "Complete your first session",
    },
  ],
  calculateSessionPoints: vi.fn().mockReturnValue({
    base: 30,
    streakBonus: 5,
    verificationBonus: 0,
    zeroSkipBonus: 10,
    allTasksBonus: 0,
    total: 45,
  }),
  calculateLevel: vi.fn().mockReturnValue(3),
  isConsecutiveDay: vi.fn().mockReturnValue(true),
  isSameDay: vi.fn().mockReturnValue(false),
  pointsToNextLevel: vi.fn().mockReturnValue({ progress: 0.6, next: 300 }),
  checkNewAchievements: vi
    .fn()
    .mockReturnValue([
      { type: "FIRST_SESSION", name: "First Steps", description: "Complete your first session" },
    ]),
}));

vi.mock("@/lib/clean/encouragement", () => ({
  STARTING_MESSAGES: ["Let's do this!"],
  TASK_COMPLETE_MESSAGES: ["Great job!"],
  SKIP_MESSAGES: ["No worries!"],
  SESSION_COMPLETE_MESSAGES: ["Amazing session!"],
  COMEBACK_MESSAGES: ["Welcome back!"],
  ACHIEVEMENT_MESSAGES: { FIRST_SESSION: "You did it!" } as Record<string, string>,
  randomMessage: vi.fn().mockImplementation((msgs: string[]) => msgs[0] ?? ""),
}));

vi.mock("@/lib/ai/gemini-client", () => ({
  analyzeImageWithGemini: vi.fn().mockResolvedValue(
    JSON.stringify({
      room_type: "kitchen",
      mess_severity: 6,
      items: [
        {
          object: "plate",
          location: "counter",
          category: "DISHES",
          difficulty: "EASY",
          action: "Wash the plate",
        },
      ],
    }),
  ),
}));

vi.mock("@/lib/clean/vision-prompts", () => ({
  ROOM_ANALYSIS_PROMPT: "Analyze this room",
  COMPARISON_PROMPT: "Compare these images",
  buildVerificationPrompt: vi.fn().mockReturnValue("Verify this task"),
}));

describe("cleansweepTools", () => {
  const registry = createMockRegistry(cleansweepTools);
  const ctx = createMockContext();

  it("exports the correct number of tools", () => {
    // 19 tools minus 5 room tools = 22 tools listed but we expect 22
    expect(registry.getToolNames().length).toBe(cleansweepTools.length);
  });

  it("has correct tool count", () => {
    expect(cleansweepTools.length).toBe(22);
  });

  it("registers tools in expected categories", () => {
    const categories = new Set(cleansweepTools.map((t) => t.category));
    expect(categories).toContain("clean-photo");
    expect(categories).toContain("clean-scanner");
    expect(categories).toContain("clean-tasks");
    expect(categories).toContain("clean-streaks");
    expect(categories).toContain("clean-reminders");
    expect(categories).toContain("clean-verify");
    expect(categories).toContain("clean-motivate");
  });

  it("clean_photo_analyze returns photo analysis", async () => {
    const result = await registry.call("clean_photo_analyze", { photo_base64: "dGVzdA==" }, ctx);
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Photo Analysis");
    expect(text).toContain("Valid:");
  });

  it("clean_photo_analyze has enables dependency", () => {
    const tool = cleansweepTools.find((t) => t.name === "clean_photo_analyze");
    expect(tool?.dependencies?.enables).toContain("clean_scan_room");
  });

  it("clean_tasks_start_session creates a session", async () => {
    const result = await registry.call("clean_tasks_start_session", { room_label: "kitchen" }, ctx);
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Session started");
  });

  it("clean_tasks_get_current returns next pending task", async () => {
    const result = await registry.call("clean_tasks_get_current", { session_id: "session-1" }, ctx);
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Current Task");
  });

  it("clean_tasks_complete marks task as done", async () => {
    const result = await registry.call("clean_tasks_complete", { task_id: "t2" }, ctx);
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Task completed");
  });

  it("clean_streaks_get returns streak info", async () => {
    const result = await registry.call("clean_streaks_get", {}, ctx);
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Cleaning Streak");
    expect(text).toContain("3 day(s)");
  });

  it("clean_reminders_create creates a reminder", async () => {
    const result = await registry.call(
      "clean_reminders_create",
      { time: "09:00", days: ["MON", "WED", "FRI"] },
      ctx,
    );
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Reminder created");
  });

  it("clean_motivate_get_encouragement returns a message", async () => {
    const result = await registry.call(
      "clean_motivate_get_encouragement",
      { context: "starting" },
      ctx,
    );
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Let's do this!");
  });

  it("clean_motivate_celebrate returns achievement message", async () => {
    const result = await registry.call(
      "clean_motivate_celebrate",
      { achievement_type: "FIRST_SESSION" },
      ctx,
    );
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("First Steps");
    expect(text).toContain("You did it!");
  });

  it("clean_scanner_analyze_room returns room analysis", async () => {
    const result = await registry.call(
      "clean_scanner_analyze_room",
      { photo_base64: "dGVzdA==" },
      ctx,
    );
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Room Analysis");
    expect(text).toContain("kitchen");
  });

  it("all tools have valid tier", () => {
    for (const tool of cleansweepTools) {
      expect(["free", "workspace"]).toContain(tool.tier);
    }
  });
});
