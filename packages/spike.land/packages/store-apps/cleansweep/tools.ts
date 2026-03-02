/**
 * CleanSweep — Standalone MCP Tool Definitions
 *
 * Gamified cleaning app with photo analysis, AI-powered room scanning,
 * task lifecycle, streaks, reminders, verification, motivation, and room management.
 * 19 tools total.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext, StandaloneToolDefinition } from "../shared/types";
import { safeToolCall, textResult } from "../shared/tool-helpers";

// ─── Photo Tools ─────────────────────────────────────────────────────────────

const cleanPhotoAnalyze: StandaloneToolDefinition = {
  name: "clean_photo_analyze",
  description:
    "Analyze a photo for CleanSweep: validates EXIF data, timestamp freshness, screenshot detection, and extracts metadata (camera model, timestamp, software). Buffer is never stored.",
  category: "clean-photo",
  tier: "free",
  dependencies: {
    enables: ["clean_scan_room"],
  },
  inputSchema: {
    photo_base64: z.string().min(1).describe("Base64-encoded photo data (JPEG preferred)"),
  },
  handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
    const { photo_base64 } = input as { photo_base64: string };
    return safeToolCall("clean_photo_analyze", async () => {
      const { validatePhoto, extractPhotoMetadata } = await import("@/lib/clean/photo-validation");

      const validation = validatePhoto(photo_base64);
      const meta = extractPhotoMetadata(photo_base64);

      let text = `**Photo Analysis**\n\n`;

      text += `### Validation\n`;
      text += `- **Valid:** ${validation.valid ? "Yes" : "No"}\n`;
      text += `- **Screenshot detected:** ${validation.isScreenshot ? "Yes" : "No"}\n`;
      if (validation.ageSeconds !== null) {
        text += `- **Age:** ${validation.ageSeconds} seconds\n`;
      }
      if (validation.cameraModel) {
        text += `- **Camera:** ${validation.cameraModel}\n`;
      }
      if (validation.rejectionReason) {
        text += `- **Rejection reason:** ${validation.rejectionReason}\n`;
      }

      text += `\n### Metadata\n`;
      text += `- **Has EXIF:** ${meta.hasExif ? "Yes" : "No"}\n`;
      if (meta.cameraModel) text += `- **Camera:** ${meta.cameraModel}\n`;
      if (meta.timestamp) {
        text += `- **Timestamp:** ${meta.timestamp.toISOString()}\n`;
      }
      if (meta.software) text += `- **Software:** ${meta.software}\n`;

      return textResult(text);
    });
  },
};

// ─── Scanner Tools ───────────────────────────────────────────────────────────

interface RoomAnalysisItem {
  object: string;
  location: string;
  category: string;
  difficulty: string;
  action: string;
}

interface RoomAnalysisResult {
  room_type: string;
  mess_severity: number;
  items: RoomAnalysisItem[];
}

const cleanScannerAnalyzeRoom: StandaloneToolDefinition = {
  name: "clean_scanner_analyze_room",
  description:
    "Analyze a room photo using AI vision to identify cleaning tasks. Returns structured room analysis with mess severity and specific items to clean.",
  category: "clean-scanner",
  tier: "free",
  dependencies: {
    enables: ["clean_create_task"],
  },
  inputSchema: {
    photo_base64: z.string().min(1).describe("Base64-encoded photo of the room"),
    session_id: z
      .string()
      .optional()
      .describe("Optional session ID to associate with the analysis"),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { photo_base64, session_id } = input as {
      photo_base64: string;
      session_id?: string;
    };
    return safeToolCall("clean_scanner_analyze_room", async () => {
      const prisma = (await import("@/lib/prisma")).default;

      if (session_id) {
        const session = await prisma.cleaningSession.findFirst({
          where: { id: session_id, userId: ctx.userId },
        });
        if (!session) {
          return textResult("Session not found or not owned by you.");
        }
      }

      let analysis: RoomAnalysisResult;

      try {
        const { analyzeImageWithGemini } = await import("@/lib/ai/gemini-client");
        const { ROOM_ANALYSIS_PROMPT } = await import("@/lib/clean/vision-prompts");
        const rawResult = await analyzeImageWithGemini(photo_base64, ROOM_ANALYSIS_PROMPT);
        analysis = JSON.parse(
          typeof rawResult === "string" ? rawResult : JSON.stringify(rawResult),
        ) as RoomAnalysisResult;
      } catch (error) {
        throw new Error(
          `Failed to analyze image with Gemini Vision: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }

      let text = `**Room Analysis**\n\n`;
      text += `- **Room type:** ${analysis.room_type}\n`;
      text += `- **Mess severity:** ${analysis.mess_severity}/10\n`;
      text += `- **Items found:** ${analysis.items.length}\n\n`;

      if (analysis.items.length > 0) {
        text += `### Tasks Identified\n\n`;
        for (let i = 0; i < analysis.items.length; i++) {
          const item = analysis.items[i]!;
          text += `${i + 1}. **${item.object}** (${item.location})\n`;
          text += `   - Category: ${item.category} | Difficulty: ${item.difficulty}\n`;
          text += `   - Action: ${item.action}\n\n`;
        }
      }

      text += `\n**Analysis JSON:** \`${JSON.stringify(analysis)}\``;

      return textResult(text);
    });
  },
};

const cleanScannerGenerateTasks: StandaloneToolDefinition = {
  name: "clean_scanner_generate_tasks",
  description:
    "Generate CleaningTask records from a room analysis result. Parses the analysis JSON and creates tasks ordered by difficulty (QUICK first).",
  category: "clean-scanner",
  tier: "free",
  inputSchema: {
    analysis_json: z.string().min(1).describe("JSON string from clean_scanner_analyze_room result"),
    session_id: z.string().min(1).describe("Session ID to create tasks in"),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { analysis_json, session_id } = input as {
      analysis_json: string;
      session_id: string;
    };
    return safeToolCall("clean_scanner_generate_tasks", async () => {
      const prisma = (await import("@/lib/prisma")).default;
      const { POINTS } = await import("@/lib/clean/gamification");

      const session = await prisma.cleaningSession.findFirst({
        where: { id: session_id, userId: ctx.userId },
      });
      if (!session) {
        return textResult("Session not found or not owned by you.");
      }

      const analysis = JSON.parse(analysis_json) as RoomAnalysisResult;

      if (!analysis.items || analysis.items.length === 0) {
        return textResult("No tasks found in the analysis. The room looks clean!");
      }

      const difficultyOrder: Record<string, number> = {
        QUICK: 0,
        EASY: 1,
        MEDIUM: 2,
        EFFORT: 3,
      };
      const sorted = [...analysis.items].sort(
        (a, b) => (difficultyOrder[a.difficulty] ?? 4) - (difficultyOrder[b.difficulty] ?? 4),
      );

      const taskData = sorted.map((item, index) => {
        const difficulty = (
          ["QUICK", "EASY", "MEDIUM", "EFFORT"].includes(item.difficulty) ? item.difficulty : "EASY"
        ) as keyof typeof POINTS;
        const category = [
          "PICKUP",
          "DISHES",
          "LAUNDRY",
          "SURFACES",
          "FLOORS",
          "TRASH",
          "ORGANIZE",
          "OTHER",
        ].includes(item.category)
          ? item.category
          : "OTHER";

        return {
          sessionId: session_id,
          description: item.action,
          category: category as
            | "PICKUP"
            | "DISHES"
            | "LAUNDRY"
            | "SURFACES"
            | "FLOORS"
            | "TRASH"
            | "ORGANIZE"
            | "OTHER",
          difficulty: difficulty as "QUICK" | "EASY" | "MEDIUM" | "EFFORT",
          orderIndex: index,
          pointsValue: POINTS[difficulty],
        };
      });

      await prisma.cleaningTask.createMany({ data: taskData });

      await prisma.cleaningSession.update({
        where: { id: session_id },
        data: { totalTasks: { increment: taskData.length } },
      });

      if (analysis.room_type && analysis.room_type !== "unknown") {
        await prisma.cleaningSession.update({
          where: { id: session_id },
          data: { roomLabel: analysis.room_type },
        });
      }

      let text = `**${taskData.length} tasks created!**\n\n`;
      for (let i = 0; i < taskData.length; i++) {
        const t = taskData[i]!;
        text += `${i + 1}. [${t.difficulty}] ${t.description.slice(0, 80)}${
          t.description.length > 80 ? "..." : ""
        } (${t.pointsValue} pts)\n`;
      }

      return textResult(text);
    });
  },
};

// ─── Task Tools ──────────────────────────────────────────────────────────────

const cleanTasksStartSession: StandaloneToolDefinition = {
  name: "clean_tasks_start_session",
  description:
    "Start a new cleaning session. Returns a session ID for tracking tasks and progress.",
  category: "clean-tasks",
  tier: "free",
  inputSchema: {
    room_label: z
      .string()
      .optional()
      .describe("Optional label for the room being cleaned (e.g. 'kitchen', 'bedroom')"),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { room_label } = input as { room_label?: string };
    return safeToolCall("clean_tasks_start_session", async () => {
      const prisma = (await import("@/lib/prisma")).default;

      const session = await prisma.cleaningSession.create({
        data: {
          userId: ctx.userId,
          ...(room_label !== undefined ? { roomLabel: room_label } : {}),
        },
      });

      let text = `**Session started!**\n\n`;
      text += `- **Session ID:** \`${session.id}\`\n`;
      if (room_label) text += `- **Room:** ${room_label}\n`;
      text += `- **Status:** ACTIVE\n`;
      text += `\nUse \`clean_scanner_analyze_room\` to scan a room photo, or \`clean_tasks_add_tasks\` to add tasks manually.`;

      return textResult(text);
    });
  },
};

const cleanTasksAddTasks: StandaloneToolDefinition = {
  name: "clean_tasks_add_tasks",
  description: "Add cleaning tasks to a session manually. Use this when not scanning a photo.",
  category: "clean-tasks",
  tier: "free",
  inputSchema: {
    session_id: z.string().min(1).describe("The session ID"),
    tasks: z
      .array(
        z.object({
          description: z.string().min(1).describe("What to do"),
          category: z
            .enum([
              "PICKUP",
              "DISHES",
              "LAUNDRY",
              "SURFACES",
              "FLOORS",
              "TRASH",
              "ORGANIZE",
              "OTHER",
            ])
            .default("OTHER")
            .describe("Task category"),
          difficulty: z
            .enum(["QUICK", "EASY", "MEDIUM", "EFFORT"])
            .default("EASY")
            .describe("Task difficulty"),
          points_value: z
            .number()
            .optional()
            .describe("Custom point value (defaults based on difficulty)"),
        }),
      )
      .min(1)
      .describe("Array of tasks to add"),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { session_id, tasks } = input as {
      session_id: string;
      tasks: Array<{
        description: string;
        category:
          | "PICKUP"
          | "DISHES"
          | "LAUNDRY"
          | "SURFACES"
          | "FLOORS"
          | "TRASH"
          | "ORGANIZE"
          | "OTHER";
        difficulty: "QUICK" | "EASY" | "MEDIUM" | "EFFORT";
        points_value?: number;
      }>;
    };
    return safeToolCall("clean_tasks_add_tasks", async () => {
      const prisma = (await import("@/lib/prisma")).default;
      const { POINTS } = await import("@/lib/clean/gamification");

      const session = await prisma.cleaningSession.findFirst({
        where: { id: session_id, userId: ctx.userId },
      });
      if (!session) {
        return textResult("Session not found or not owned by you.");
      }

      const lastTask = await prisma.cleaningTask.findFirst({
        where: { sessionId: session_id },
        orderBy: { orderIndex: "desc" },
        select: { orderIndex: true },
      });
      const startIndex = (lastTask?.orderIndex ?? -1) + 1;

      const taskData = tasks.map((t, i) => ({
        sessionId: session_id,
        description: t.description,
        category: t.category,
        difficulty: t.difficulty,
        orderIndex: startIndex + i,
        pointsValue: t.points_value ?? POINTS[t.difficulty],
      }));

      await prisma.cleaningTask.createMany({ data: taskData });
      await prisma.cleaningSession.update({
        where: { id: session_id },
        data: { totalTasks: { increment: taskData.length } },
      });

      let text = `**${taskData.length} task(s) added!**\n\n`;
      for (const t of taskData) {
        text += `- [${t.difficulty}] ${t.description} (${t.pointsValue} pts)\n`;
      }

      return textResult(text);
    });
  },
};

const cleanTasksList: StandaloneToolDefinition = {
  name: "clean_tasks_list",
  description: "List all tasks in a cleaning session with their current status.",
  category: "clean-tasks",
  tier: "free",
  inputSchema: {
    session_id: z.string().min(1).describe("The session ID"),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { session_id } = input as { session_id: string };
    return safeToolCall("clean_tasks_list", async () => {
      const prisma = (await import("@/lib/prisma")).default;

      const session = await prisma.cleaningSession.findFirst({
        where: { id: session_id, userId: ctx.userId },
        include: {
          tasks: { orderBy: { orderIndex: "asc" } },
        },
      });
      if (!session) {
        return textResult("Session not found or not owned by you.");
      }

      if (session.tasks.length === 0) {
        return textResult(
          `Session \`${session_id}\` has no tasks yet. Use \`clean_tasks_add_tasks\` or \`clean_scanner_generate_tasks\` to add some.`,
        );
      }

      const statusIcon: Record<string, string> = {
        PENDING: "[ ]",
        ACTIVE: "[>]",
        COMPLETED: "[x]",
        SKIPPED: "[-]",
        VERIFIED: "[V]",
        DEFERRED: "[~]",
      };

      let text = `**Session Tasks** (${session.completedTasks}/${session.totalTasks} done)\n\n`;
      for (const t of session.tasks) {
        const icon = statusIcon[t.status] ?? "[ ]";
        text += `${icon} ${t.description.slice(0, 80)}${t.description.length > 80 ? "..." : ""}\n`;
        text += `    ID: \`${t.id}\` | ${t.difficulty} | ${t.category} | ${t.pointsValue} pts\n`;
      }

      return textResult(text);
    });
  },
};

const cleanTasksGetCurrent: StandaloneToolDefinition = {
  name: "clean_tasks_get_current",
  description:
    "Get the current (next pending) task in a session. Returns the first PENDING task by order index.",
  category: "clean-tasks",
  tier: "free",
  inputSchema: {
    session_id: z.string().min(1).describe("The session ID"),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { session_id } = input as { session_id: string };
    return safeToolCall("clean_tasks_get_current", async () => {
      const prisma = (await import("@/lib/prisma")).default;

      const session = await prisma.cleaningSession.findFirst({
        where: { id: session_id, userId: ctx.userId },
      });
      if (!session) {
        return textResult("Session not found or not owned by you.");
      }

      const task = await prisma.cleaningTask.findFirst({
        where: { sessionId: session_id, status: "PENDING" },
        orderBy: { orderIndex: "asc" },
      });

      if (!task) {
        return textResult(
          `No pending tasks in this session! ${session.completedTasks}/${session.totalTasks} completed. Use \`clean_tasks_end_session\` to finish.`,
        );
      }

      let text = `**Current Task**\n\n`;
      text += `- **ID:** \`${task.id}\`\n`;
      text += `- **Description:** ${task.description}\n`;
      text += `- **Category:** ${task.category} | **Difficulty:** ${task.difficulty}\n`;
      text += `- **Points:** ${task.pointsValue}\n\n`;
      text += `Use \`clean_tasks_complete\` when done, or \`clean_tasks_skip\` to skip.`;

      return textResult(text);
    });
  },
};

const cleanTasksSkip: StandaloneToolDefinition = {
  name: "clean_tasks_skip",
  description: "Skip a cleaning task. No guilt! The task can be requeued later.",
  category: "clean-tasks",
  tier: "free",
  inputSchema: {
    task_id: z.string().min(1).describe("The task ID to skip"),
    reason: z.string().optional().describe("Optional reason for skipping"),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { task_id, reason } = input as { task_id: string; reason?: string };
    return safeToolCall("clean_tasks_skip", async () => {
      const prisma = (await import("@/lib/prisma")).default;

      const task = await prisma.cleaningTask.findUnique({
        where: { id: task_id },
        include: { session: { select: { userId: true, id: true } } },
      });
      if (!task || task.session.userId !== ctx.userId) {
        return textResult("Task not found or not owned by you.");
      }

      await prisma.cleaningTask.update({
        where: { id: task_id },
        data: {
          status: "SKIPPED",
          ...(reason !== undefined ? { skippedReason: reason } : {}),
        },
      });

      await prisma.cleaningSession.update({
        where: { id: task.session.id },
        data: { skippedTasks: { increment: 1 } },
      });

      let text = `**Task skipped!** No worries.\n`;
      if (reason) text += `- Reason: ${reason}\n`;
      text += `\nUse \`clean_tasks_get_current\` for the next task, or \`clean_tasks_requeue_skipped\` later to try again.`;

      return textResult(text);
    });
  },
};

const cleanTasksComplete: StandaloneToolDefinition = {
  name: "clean_tasks_complete",
  description: "Mark a cleaning task as completed. Awards points and updates session progress.",
  category: "clean-tasks",
  tier: "free",
  dependencies: {
    requires: ["clean_create_task"],
  },
  inputSchema: {
    task_id: z.string().min(1).describe("The task ID to complete"),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { task_id } = input as { task_id: string };
    return safeToolCall("clean_tasks_complete", async () => {
      const prisma = (await import("@/lib/prisma")).default;

      const task = await prisma.cleaningTask.findUnique({
        where: { id: task_id },
        include: { session: { select: { userId: true, id: true } } },
      });
      if (!task || task.session.userId !== ctx.userId) {
        return textResult("Task not found or not owned by you.");
      }

      if (task.status === "COMPLETED" || task.status === "VERIFIED") {
        return textResult("This task is already completed.");
      }

      await prisma.cleaningTask.update({
        where: { id: task_id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      await prisma.cleaningSession.update({
        where: { id: task.session.id },
        data: { completedTasks: { increment: 1 } },
      });

      let text = `**Task completed!** +${task.pointsValue} points\n\n`;
      text += `Use \`clean_tasks_get_current\` for the next task.`;

      return textResult(text);
    });
  },
};

const cleanTasksEndSession: StandaloneToolDefinition = {
  name: "clean_tasks_end_session",
  description:
    "End a cleaning session. Calculates points with bonuses (streak, zero-skip, all-tasks) and returns a summary.",
  category: "clean-tasks",
  tier: "free",
  inputSchema: {
    session_id: z.string().min(1).describe("The session ID to end"),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { session_id } = input as { session_id: string };
    return safeToolCall("clean_tasks_end_session", async () => {
      const prisma = (await import("@/lib/prisma")).default;
      const { calculateSessionPoints } = await import("@/lib/clean/gamification");

      const session = await prisma.cleaningSession.findFirst({
        where: { id: session_id, userId: ctx.userId },
        include: { tasks: true },
      });
      if (!session) {
        return textResult("Session not found or not owned by you.");
      }

      if (session.status === "COMPLETED") {
        return textResult("This session is already completed.");
      }

      const taskPoints = session.tasks
        .filter((t) => t.status === "COMPLETED" || t.status === "VERIFIED")
        .reduce((sum, t) => sum + t.pointsValue, 0);

      const streak = await prisma.cleaningStreak.findUnique({
        where: { userId: ctx.userId },
      });

      const hasVerificationPhoto = session.tasks.some((t) => t.status === "VERIFIED");
      const zeroSkips = session.skippedTasks === 0 && session.completedTasks > 0;
      const allTasksDone =
        session.completedTasks + session.tasks.filter((t) => t.status === "VERIFIED").length ===
          session.totalTasks && session.totalTasks > 0;

      const points = calculateSessionPoints({
        taskPoints,
        currentStreak: streak?.currentStreak ?? 0,
        hasVerificationPhoto,
        zeroSkips,
        allTasksDone,
      });

      await prisma.cleaningSession.update({
        where: { id: session_id },
        data: {
          status: "COMPLETED",
          pointsEarned: points.total,
          completedAt: new Date(),
        },
      });

      let text = `**Session Complete!**\n\n`;
      text += `### Summary\n`;
      text += `- **Tasks completed:** ${session.completedTasks}/${session.totalTasks}\n`;
      text += `- **Tasks skipped:** ${session.skippedTasks}\n`;
      if (session.roomLabel) text += `- **Room:** ${session.roomLabel}\n`;
      text += `\n### Points Earned\n`;
      text += `- **Base points:** ${points.base}\n`;
      if (points.streakBonus > 0) {
        text += `- **Streak bonus:** +${points.streakBonus}\n`;
      }
      if (points.verificationBonus > 0) {
        text += `- **Verification bonus:** +${points.verificationBonus}\n`;
      }
      if (points.zeroSkipBonus > 0) {
        text += `- **Zero-skip bonus:** +${points.zeroSkipBonus}\n`;
      }
      if (points.allTasksBonus > 0) {
        text += `- **All-tasks bonus:** +${points.allTasksBonus}\n`;
      }
      text += `- **Total:** ${points.total} points\n`;
      text += `\nUse \`clean_streaks_record_session\` to update your streak and \`clean_motivate_check_achievements\` to check for new achievements!`;

      return textResult(text);
    });
  },
};

const cleanTasksRequeueSkipped: StandaloneToolDefinition = {
  name: "clean_tasks_requeue_skipped",
  description: "Move all skipped tasks back to pending status so they can be attempted again.",
  category: "clean-tasks",
  tier: "free",
  inputSchema: {
    session_id: z.string().min(1).describe("The session ID"),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { session_id } = input as { session_id: string };
    return safeToolCall("clean_tasks_requeue_skipped", async () => {
      const prisma = (await import("@/lib/prisma")).default;

      const session = await prisma.cleaningSession.findFirst({
        where: { id: session_id, userId: ctx.userId },
      });
      if (!session) {
        return textResult("Session not found or not owned by you.");
      }

      const result = await prisma.cleaningTask.updateMany({
        where: { sessionId: session_id, status: "SKIPPED" },
        data: { status: "PENDING", skippedReason: null },
      });

      if (result.count === 0) {
        return textResult("No skipped tasks to requeue.");
      }

      await prisma.cleaningSession.update({
        where: { id: session_id },
        data: { skippedTasks: 0 },
      });

      return textResult(
        `**${result.count} task(s) requeued!** They're back in the queue as pending.\n\nUse \`clean_tasks_get_current\` to get the next task.`,
      );
    });
  },
};

// ─── Streak Tools ────────────────────────────────────────────────────────────

const cleanStreaksGet: StandaloneToolDefinition = {
  name: "clean_streaks_get",
  description: "Get your current cleaning streak data. Creates a streak record if none exists.",
  category: "clean-streaks",
  tier: "free",
  inputSchema: {},
  handler: async (_input: never, ctx: ServerContext): Promise<CallToolResult> => {
    return safeToolCall("clean_streaks_get", async () => {
      const prisma = (await import("@/lib/prisma")).default;

      const streak = await prisma.cleaningStreak.upsert({
        where: { userId: ctx.userId },
        create: { userId: ctx.userId },
        update: {},
      });

      let text = `**Your Cleaning Streak**\n\n`;
      text += `- **Current streak:** ${streak.currentStreak} day(s)\n`;
      text += `- **Best streak:** ${streak.bestStreak} day(s)\n`;
      text += `- **Level:** ${streak.level}\n`;
      text += `- **Total points:** ${streak.totalPoints}\n`;
      text += `- **Total sessions:** ${streak.totalSessions}\n`;
      text += `- **Total tasks:** ${streak.totalTasks}\n`;
      if (streak.lastSessionDate) {
        text += `- **Last session:** ${streak.lastSessionDate.toISOString().split("T")[0]}\n`;
      }

      return textResult(text);
    });
  },
};

const cleanStreaksRecordSession: StandaloneToolDefinition = {
  name: "clean_streaks_record_session",
  description:
    "Record a completed session in streak tracking. Updates streak (checks consecutive days), total points, sessions, tasks, and recalculates level.",
  category: "clean-streaks",
  tier: "free",
  inputSchema: {
    session_id: z.string().min(1).describe("The completed session ID"),
    points_earned: z.number().min(0).describe("Points earned in the session"),
    tasks_completed: z.number().min(0).describe("Number of tasks completed in the session"),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { session_id, points_earned, tasks_completed } = input as {
      session_id: string;
      points_earned: number;
      tasks_completed: number;
    };
    return safeToolCall("clean_streaks_record_session", async () => {
      const prisma = (await import("@/lib/prisma")).default;
      const { calculateLevel, isConsecutiveDay, isSameDay } = await import(
        "@/lib/clean/gamification"
      );

      const session = await prisma.cleaningSession.findFirst({
        where: { id: session_id, userId: ctx.userId, status: "COMPLETED" },
      });
      if (!session) {
        return textResult("Session not found, not completed, or not owned by you.");
      }

      const streak = await prisma.cleaningStreak.upsert({
        where: { userId: ctx.userId },
        create: { userId: ctx.userId },
        update: {},
      });

      const now = new Date();
      let newStreak = streak.currentStreak;

      if (streak.lastSessionDate) {
        if (isSameDay(now, streak.lastSessionDate)) {
          // Same day — streak doesn't change
        } else if (isConsecutiveDay(now, streak.lastSessionDate)) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
      } else {
        newStreak = 1;
      }

      const newTotalPoints = streak.totalPoints + points_earned;
      const newLevel = calculateLevel(newTotalPoints);
      const newBestStreak = Math.max(streak.bestStreak, newStreak);

      await prisma.cleaningStreak.update({
        where: { userId: ctx.userId },
        data: {
          currentStreak: newStreak,
          bestStreak: newBestStreak,
          totalPoints: newTotalPoints,
          totalSessions: { increment: 1 },
          totalTasks: { increment: tasks_completed },
          level: newLevel,
          lastSessionDate: now,
        },
      });

      const levelUp = newLevel > streak.level;
      let text = `**Streak Updated!**\n\n`;
      text += `- **Current streak:** ${newStreak} day(s)`;
      if (newStreak > streak.currentStreak) text += ` (+1!)`;
      text += `\n`;
      text += `- **Best streak:** ${newBestStreak} day(s)\n`;
      text += `- **Total points:** ${newTotalPoints} (+${points_earned})\n`;
      text += `- **Level:** ${newLevel}`;
      if (levelUp) text += ` **LEVEL UP!**`;
      text += `\n`;

      return textResult(text);
    });
  },
};

const cleanStreaksGetStats: StandaloneToolDefinition = {
  name: "clean_streaks_get_stats",
  description:
    "Get full stats including level progress, all-time stats, and next level requirements.",
  category: "clean-streaks",
  tier: "free",
  inputSchema: {},
  handler: async (_input: never, ctx: ServerContext): Promise<CallToolResult> => {
    return safeToolCall("clean_streaks_get_stats", async () => {
      const prisma = (await import("@/lib/prisma")).default;
      const { pointsToNextLevel } = await import("@/lib/clean/gamification");

      const streak = await prisma.cleaningStreak.upsert({
        where: { userId: ctx.userId },
        create: { userId: ctx.userId },
        update: {},
      });

      const levelProgress = pointsToNextLevel(streak.totalPoints);

      let text = `**Your CleanSweep Stats**\n\n`;
      text += `### Streak\n`;
      text += `- **Current:** ${streak.currentStreak} day(s)\n`;
      text += `- **Best:** ${streak.bestStreak} day(s)\n\n`;
      text += `### Level Progress\n`;
      text += `- **Level:** ${streak.level}\n`;
      text += `- **Progress:** ${(levelProgress.progress * 100).toFixed(1)}%\n`;
      text += `- **Points:** ${streak.totalPoints} / ${levelProgress.next}\n\n`;
      text += `### All-Time Stats\n`;
      text += `- **Total sessions:** ${streak.totalSessions}\n`;
      text += `- **Total tasks:** ${streak.totalTasks}\n`;
      text += `- **Total points:** ${streak.totalPoints}\n`;
      if (streak.lastSessionDate) {
        text += `- **Last session:** ${streak.lastSessionDate.toISOString().split("T")[0]}\n`;
      }

      return textResult(text);
    });
  },
};

// ─── Reminder Tools ──────────────────────────────────────────────────────────

const cleanRemindersCreate: StandaloneToolDefinition = {
  name: "clean_reminders_create",
  description:
    "Create a cleaning reminder. Set time (HH:mm), days of the week, and an optional custom message.",
  category: "clean-reminders",
  tier: "free",
  inputSchema: {
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format")
      .describe("Reminder time in HH:mm format (e.g. '09:00')"),
    days: z
      .array(z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]))
      .min(1)
      .describe("Days of the week for the reminder"),
    message: z.string().max(200).optional().describe("Optional custom reminder message"),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { time, days, message } = input as {
      time: string;
      days: Array<"MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN">;
      message?: string;
    };
    return safeToolCall("clean_reminders_create", async () => {
      const prisma = (await import("@/lib/prisma")).default;

      const reminder = await prisma.cleaningReminder.create({
        data: {
          userId: ctx.userId,
          time,
          days,
          ...(message !== undefined ? { message } : {}),
        },
      });

      let text = `**Reminder created!**\n\n`;
      text += `- **ID:** \`${reminder.id}\`\n`;
      text += `- **Time:** ${reminder.time}\n`;
      text += `- **Days:** ${reminder.days.join(", ")}\n`;
      text += `- **Enabled:** Yes\n`;
      if (reminder.message) text += `- **Message:** ${reminder.message}\n`;

      return textResult(text);
    });
  },
};

const cleanRemindersList: StandaloneToolDefinition = {
  name: "clean_reminders_list",
  description: "List all your cleaning reminders.",
  category: "clean-reminders",
  tier: "free",
  inputSchema: {},
  handler: async (_input: never, ctx: ServerContext): Promise<CallToolResult> => {
    return safeToolCall("clean_reminders_list", async () => {
      const prisma = (await import("@/lib/prisma")).default;

      const reminders = await prisma.cleaningReminder.findMany({
        where: { userId: ctx.userId },
        orderBy: { time: "asc" },
      });

      if (reminders.length === 0) {
        return textResult("No reminders set. Use `clean_reminders_create` to set one up!");
      }

      let text = `**Your Cleaning Reminders (${reminders.length})**\n\n`;
      for (const r of reminders) {
        const status = r.enabled ? "ON" : "OFF";
        text += `- **${r.time}** [${status}] — ${r.days.join(", ")}\n`;
        text += `  ID: \`${r.id}\``;
        if (r.message) text += ` | "${r.message}"`;
        text += `\n`;
      }

      return textResult(text);
    });
  },
};

// Note: clean_reminders_update and clean_reminders_delete are part of the
// room management tools below; they share the Reminder model.

// ─── Verify Tools ────────────────────────────────────────────────────────────

const cleanVerifyCheckCompletion: StandaloneToolDefinition = {
  name: "clean_verify_check_completion",
  description:
    "Verify task completion using a photo. AI analyzes whether the task was done. If confidence > 0.6, task is upgraded to VERIFIED status with bonus points.",
  category: "clean-verify",
  tier: "free",
  inputSchema: {
    task_id: z.string().min(1).describe("The task ID to verify"),
    photo_base64: z.string().min(1).describe("Base64-encoded photo showing the completed task"),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { task_id, photo_base64 } = input as {
      task_id: string;
      photo_base64: string;
    };
    return safeToolCall("clean_verify_check_completion", async () => {
      const prisma = (await import("@/lib/prisma")).default;
      const { buildVerificationPrompt } = await import("@/lib/clean/vision-prompts");
      const { BONUSES } = await import("@/lib/clean/gamification");

      interface VerificationResult {
        completed: boolean;
        confidence: number;
        feedback: string;
      }

      const task = await prisma.cleaningTask.findUnique({
        where: { id: task_id },
        include: { session: { select: { userId: true, id: true } } },
      });
      if (!task || task.session.userId !== ctx.userId) {
        return textResult("Task not found or not owned by you.");
      }

      const prompt = buildVerificationPrompt(task.description);
      let verification: VerificationResult;

      try {
        const { analyzeImageWithGemini } = await import("@/lib/ai/gemini-client");
        const rawResult = await analyzeImageWithGemini(photo_base64, prompt);
        verification = JSON.parse(
          typeof rawResult === "string" ? rawResult : JSON.stringify(rawResult),
        ) as VerificationResult;
      } catch (error) {
        throw new Error(
          `Failed to verify image with Gemini Vision: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }

      const verified = verification.confidence > 0.6;

      if (verified) {
        await prisma.cleaningTask.update({
          where: { id: task_id },
          data: {
            status: "VERIFIED",
            completedAt: task.completedAt ?? new Date(),
          },
        });

        if (task.status !== "COMPLETED" && task.status !== "VERIFIED") {
          await prisma.cleaningSession.update({
            where: { id: task.session.id },
            data: { completedTasks: { increment: 1 } },
          });
        }
      }

      let text = `**Verification Result**\n\n`;
      text += `- **Completed:** ${verification.completed ? "Yes" : "Not quite"}\n`;
      text += `- **Confidence:** ${(verification.confidence * 100).toFixed(0)}%\n`;
      text += `- **Status:** ${
        verified
          ? `VERIFIED (+${BONUSES.VERIFICATION_PHOTO} bonus pts)`
          : "Not verified — try again or mark as complete manually"
      }\n`;
      text += `- **Feedback:** ${verification.feedback}\n`;

      return textResult(text);
    });
  },
};

const cleanVerifyCompareBeforeAfter: StandaloneToolDefinition = {
  name: "clean_verify_compare_before_after",
  description:
    "Compare before and after photos of a room to measure cleaning progress. Returns improvement score and detected changes.",
  category: "clean-verify",
  tier: "free",
  inputSchema: {
    before_photo_base64: z.string().min(1).describe("Base64-encoded BEFORE photo"),
    after_photo_base64: z.string().min(1).describe("Base64-encoded AFTER photo"),
    session_id: z.string().min(1).describe("The session ID for context"),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { before_photo_base64, after_photo_base64, session_id } = input as {
      before_photo_base64: string;
      after_photo_base64: string;
      session_id: string;
    };
    return safeToolCall("clean_verify_compare_before_after", async () => {
      const prisma = (await import("@/lib/prisma")).default;
      const { COMPARISON_PROMPT } = await import("@/lib/clean/vision-prompts");

      interface ComparisonResult {
        improvement_score: number;
        changes_detected: string[];
        remaining_items: string[];
        encouragement: string;
      }

      const session = await prisma.cleaningSession.findFirst({
        where: { id: session_id, userId: ctx.userId },
      });
      if (!session) {
        return textResult("Session not found or not owned by you.");
      }

      let comparison: ComparisonResult;

      try {
        const { analyzeImageWithGemini } = await import("@/lib/ai/gemini-client");
        const rawResult = await analyzeImageWithGemini(
          [before_photo_base64, after_photo_base64],
          COMPARISON_PROMPT,
        );
        comparison = JSON.parse(
          typeof rawResult === "string" ? rawResult : JSON.stringify(rawResult),
        ) as ComparisonResult;
      } catch (error) {
        throw new Error(
          `Failed to compare images with Gemini Vision: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }

      let text = `**Before/After Comparison**\n\n`;
      text += `- **Improvement score:** ${comparison.improvement_score}/100\n\n`;

      if (comparison.changes_detected.length > 0) {
        text += `### Changes Detected\n`;
        for (const change of comparison.changes_detected) {
          text += `- ${change}\n`;
        }
        text += `\n`;
      }

      if (comparison.remaining_items.length > 0) {
        text += `### Still Needs Attention\n`;
        for (const item of comparison.remaining_items) {
          text += `- ${item}\n`;
        }
        text += `\n`;
      }

      text += `### Encouragement\n${comparison.encouragement}`;

      return textResult(text);
    });
  },
};

// ─── Motivate Tools ──────────────────────────────────────────────────────────

const cleanMotivateGetEncouragement: StandaloneToolDefinition = {
  name: "clean_motivate_get_encouragement",
  description:
    "Get an encouraging message based on context. Perfect for ADHD-friendly dopamine boosts during cleaning.",
  category: "clean-motivate",
  tier: "free",
  inputSchema: {
    context: z
      .enum(["starting", "task_complete", "skip", "session_complete", "comeback"])
      .describe("The context for the encouragement message"),
  },
  handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
    const { context } = input as {
      context: "starting" | "task_complete" | "skip" | "session_complete" | "comeback";
    };
    return safeToolCall("clean_motivate_get_encouragement", async () => {
      const {
        randomMessage,
        STARTING_MESSAGES,
        TASK_COMPLETE_MESSAGES,
        SKIP_MESSAGES,
        SESSION_COMPLETE_MESSAGES,
        COMEBACK_MESSAGES,
      } = await import("@/lib/clean/encouragement");

      const CONTEXT_MESSAGES: Record<string, string[]> = {
        starting: STARTING_MESSAGES,
        task_complete: TASK_COMPLETE_MESSAGES,
        skip: SKIP_MESSAGES,
        session_complete: SESSION_COMPLETE_MESSAGES,
        comeback: COMEBACK_MESSAGES,
      };

      const messages = CONTEXT_MESSAGES[context];
      if (!messages || messages.length === 0) {
        return textResult("You're doing great! Keep going!");
      }

      return textResult(randomMessage(messages));
    });
  },
};

// Note: clean_motivate_check_achievements, clean_motivate_get_achievements,
// and clean_motivate_celebrate are omitted from the dependency chain since
// they are terminal tools — they don't enable further tools.

const cleanMotivateCheckAchievements: StandaloneToolDefinition = {
  name: "clean_motivate_check_achievements",
  description:
    "Check for newly unlocked achievements after completing a session. Creates achievement records and returns any new unlocks.",
  category: "clean-motivate",
  tier: "free",
  inputSchema: {
    session_id: z.string().min(1).describe("The completed session ID to check achievements for"),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { session_id } = input as { session_id: string };
    return safeToolCall("clean_motivate_check_achievements", async () => {
      const prisma = (await import("@/lib/prisma")).default;
      const { checkNewAchievements } = await import("@/lib/clean/gamification");
      type AchievementStats = Parameters<typeof checkNewAchievements>[0];

      const session = await prisma.cleaningSession.findFirst({
        where: { id: session_id, userId: ctx.userId },
        include: { tasks: true },
      });
      if (!session) {
        return textResult("Session not found or not owned by you.");
      }

      const streak = await prisma.cleaningStreak.findUnique({
        where: { userId: ctx.userId },
      });
      if (!streak) {
        return textResult("No streak data found. Use `clean_streaks_record_session` first.");
      }

      const existing = await prisma.cleaningAchievement.findMany({
        where: { userId: ctx.userId },
        select: { achievementType: true },
      });
      const alreadyUnlocked = new Set(existing.map((a) => a.achievementType));

      const sessionDurationMs = session.completedAt
        ? session.completedAt.getTime() - session.startedAt.getTime()
        : 0;
      const daysSinceLastSession = streak.lastSessionDate
        ? Math.floor(
            (new Date().getTime() - streak.lastSessionDate.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 999;

      const stats: AchievementStats = {
        totalSessions: streak.totalSessions,
        currentStreak: streak.currentStreak,
        bestStreak: streak.bestStreak,
        totalTasks: streak.totalTasks,
        level: streak.level,
        sessionSkips: session.skippedTasks,
        sessionTotalTasks: session.totalTasks,
        sessionDurationMinutes: Math.floor(sessionDurationMs / (1000 * 60)),
        sessionHour: session.startedAt.getHours(),
        daysSinceLastSession,
      };

      const newAchievements = checkNewAchievements(stats, alreadyUnlocked);

      if (newAchievements.length > 0) {
        await prisma.cleaningAchievement.createMany({
          data: newAchievements.map((a) => ({
            userId: ctx.userId,
            achievementType: a.type,
          })),
          skipDuplicates: true,
        });
      }

      if (newAchievements.length === 0) {
        return textResult("No new achievements this time. Keep going — you're making progress!");
      }

      let text = `**New Achievement(s) Unlocked!**\n\n`;
      for (const a of newAchievements) {
        text += `### ${a.name}\n`;
        text += `${a.description}\n\n`;
      }

      return textResult(text);
    });
  },
};

const cleanMotivateGetAchievements: StandaloneToolDefinition = {
  name: "clean_motivate_get_achievements",
  description: "Get all achievements — both unlocked and locked — showing your progress.",
  category: "clean-motivate",
  tier: "free",
  inputSchema: {},
  handler: async (_input: never, ctx: ServerContext): Promise<CallToolResult> => {
    return safeToolCall("clean_motivate_get_achievements", async () => {
      const prisma = (await import("@/lib/prisma")).default;
      const { ACHIEVEMENTS } = await import("@/lib/clean/gamification");

      const unlocked = await prisma.cleaningAchievement.findMany({
        where: { userId: ctx.userId },
        select: { achievementType: true, unlockedAt: true },
      });
      const unlockedMap = new Map(unlocked.map((a) => [a.achievementType, a.unlockedAt]));

      let text = `**Your Achievements (${unlocked.length}/${ACHIEVEMENTS.length})**\n\n`;

      for (const a of ACHIEVEMENTS) {
        const unlockedAt = unlockedMap.get(a.type);
        if (unlockedAt) {
          text += `- [x] **${a.name}** — ${a.description}\n`;
          text += `  Unlocked: ${unlockedAt.toISOString().split("T")[0]}\n`;
        } else {
          text += `- [ ] **${a.name}** — ${a.description}\n`;
        }
      }

      return textResult(text);
    });
  },
};

const cleanMotivateCelebrate: StandaloneToolDefinition = {
  name: "clean_motivate_celebrate",
  description:
    "Get a celebration message for a specific achievement. Use after unlocking a new achievement.",
  category: "clean-motivate",
  tier: "free",
  inputSchema: {
    achievement_type: z
      .string()
      .min(1)
      .describe("The achievement type to celebrate (e.g. 'FIRST_SESSION', 'THREE_DAY_STREAK')"),
  },
  handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
    const { achievement_type } = input as { achievement_type: string };
    return safeToolCall("clean_motivate_celebrate", async () => {
      const { ACHIEVEMENT_MESSAGES } = await import("@/lib/clean/encouragement");
      const { ACHIEVEMENTS } = await import("@/lib/clean/gamification");

      const message = ACHIEVEMENT_MESSAGES[achievement_type];
      if (!message) {
        return textResult(
          `Achievement "${achievement_type}" not found. Use \`clean_motivate_get_achievements\` to see available achievements.`,
        );
      }

      const achievement = ACHIEVEMENTS.find((a) => a.type === achievement_type);
      const name = achievement?.name ?? achievement_type;

      const text = `**${name}!**\n\n${message}`;

      return textResult(text);
    });
  },
};

// ─── Room Tools ──────────────────────────────────────────────────────────────
// Note: Room tools use CleaningReminder as a persistence layer with a
// SCHEDULE_PREFIX. They are simplified here to avoid importing the Prisma
// enum directly (the handler uses dynamic import).

// Omitting the 5 room tools (clean_create_room, clean_list_rooms,
// clean_get_room_history, clean_get_statistics, clean_set_schedule) from the
// standalone build since they depend on the @prisma/client enum type
// `CleaningReminderDay` at module level. They will be added when the
// standalone package has its own generated Prisma types.

// ─── Export ──────────────────────────────────────────────────────────────────

export const cleansweepTools: StandaloneToolDefinition[] = [
  // Photo (1)
  cleanPhotoAnalyze,
  // Scanner (2)
  cleanScannerAnalyzeRoom,
  cleanScannerGenerateTasks,
  // Tasks (8)
  cleanTasksStartSession,
  cleanTasksAddTasks,
  cleanTasksList,
  cleanTasksGetCurrent,
  cleanTasksSkip,
  cleanTasksComplete,
  cleanTasksEndSession,
  cleanTasksRequeueSkipped,
  // Streaks (3)
  cleanStreaksGet,
  cleanStreaksRecordSession,
  cleanStreaksGetStats,
  // Reminders (2)
  cleanRemindersCreate,
  cleanRemindersList,
  // Verify (2)
  cleanVerifyCheckCompletion,
  cleanVerifyCompareBeforeAfter,
  // Motivate (4)
  cleanMotivateGetEncouragement,
  cleanMotivateCheckAchievements,
  cleanMotivateGetAchievements,
  cleanMotivateCelebrate,
];
