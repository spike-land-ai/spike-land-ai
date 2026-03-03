/**
 * CleanSweep Task Tools (Server-Side)
 *
 * MCP tools for session management and task lifecycle —
 * start/end sessions, add/list/complete/skip tasks.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import prisma from "@/lib/prisma";
import { safeToolCall, textResult } from "./tool-helpers";
import { calculateSessionPoints, POINTS } from "@/lib/clean/gamification";

export function registerCleanTasksTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // clean_tasks_start_session
  registry.register({
    name: "clean_tasks_start_session",
    description:
      "Start a new cleaning session. Returns a session ID for tracking tasks and progress.",
    category: "clean-tasks",
    tier: "free",
    inputSchema: {
      room_label: z
        .string()
        .optional()
        .describe(
          "Optional label for the room being cleaned (e.g. 'kitchen', 'bedroom')",
        ),
    },
    handler: async ({
      room_label,
    }: {
      room_label?: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_tasks_start_session", async () => {
        const session = await prisma.cleaningSession.create({
          data: {
            userId,
            roomLabel: room_label,
          },
        });

        let text = `**Session started!**\n\n`;
        text += `- **Session ID:** \`${session.id}\`\n`;
        if (room_label) text += `- **Room:** ${room_label}\n`;
        text += `- **Status:** ACTIVE\n`;
        text +=
          `\nUse \`clean_scanner_analyze_room\` to scan a room photo, or \`clean_tasks_add_tasks\` to add tasks manually.`;

        return textResult(text);
      });
    },
  });

  // clean_tasks_add_tasks
  registry.register({
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
    handler: async ({
      session_id,
      tasks,
    }: {
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
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_tasks_add_tasks", async () => {
        const session = await prisma.cleaningSession.findFirst({
          where: { id: session_id, userId },
        });
        if (!session) {
          return textResult("Session not found or not owned by you.");
        }

        // Get current max orderIndex
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
  });

  // clean_tasks_list
  registry.register({
    name: "clean_tasks_list",
    description: "List all tasks in a cleaning session with their current status.",
    category: "clean-tasks",
    tier: "free",
    inputSchema: {
      session_id: z.string().min(1).describe("The session ID"),
    },
    handler: async ({
      session_id,
    }: {
      session_id: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_tasks_list", async () => {
        const session = await prisma.cleaningSession.findFirst({
          where: { id: session_id, userId },
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
          text += `${icon} ${t.description.slice(0, 80)}${
            t.description.length > 80 ? "..." : ""
          }\n`;
          text += `    ID: \`${t.id}\` | ${t.difficulty} | ${t.category} | ${t.pointsValue} pts\n`;
        }

        return textResult(text);
      });
    },
  });

  // clean_tasks_get_current
  registry.register({
    name: "clean_tasks_get_current",
    description:
      "Get the current (next pending) task in a session. Returns the first PENDING task by order index.",
    category: "clean-tasks",
    tier: "free",
    inputSchema: {
      session_id: z.string().min(1).describe("The session ID"),
    },
    handler: async ({
      session_id,
    }: {
      session_id: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_tasks_get_current", async () => {
        const session = await prisma.cleaningSession.findFirst({
          where: { id: session_id, userId },
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
  });

  // clean_tasks_skip
  registry.register({
    name: "clean_tasks_skip",
    description: "Skip a cleaning task. No guilt! The task can be requeued later.",
    category: "clean-tasks",
    tier: "free",
    inputSchema: {
      task_id: z.string().min(1).describe("The task ID to skip"),
      reason: z
        .string()
        .optional()
        .describe("Optional reason for skipping"),
    },
    handler: async ({
      task_id,
      reason,
    }: {
      task_id: string;
      reason?: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_tasks_skip", async () => {
        const task = await prisma.cleaningTask.findUnique({
          where: { id: task_id },
          include: { session: { select: { userId: true, id: true } } },
        });
        if (!task || task.session.userId !== userId) {
          return textResult("Task not found or not owned by you.");
        }

        await prisma.cleaningTask.update({
          where: { id: task_id },
          data: {
            status: "SKIPPED",
            skippedReason: reason,
          },
        });

        await prisma.cleaningSession.update({
          where: { id: task.session.id },
          data: { skippedTasks: { increment: 1 } },
        });

        let text = `**Task skipped!** No worries.\n`;
        if (reason) text += `- Reason: ${reason}\n`;
        text +=
          `\nUse \`clean_tasks_get_current\` for the next task, or \`clean_tasks_requeue_skipped\` later to try again.`;

        return textResult(text);
      });
    },
  });

  // clean_tasks_complete
  registry.register({
    name: "clean_tasks_complete",
    description: "Mark a cleaning task as completed. Awards points and updates session progress.",
    category: "clean-tasks",
    tier: "free",
    inputSchema: {
      task_id: z.string().min(1).describe("The task ID to complete"),
    },
    handler: async ({
      task_id,
    }: {
      task_id: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_tasks_complete", async () => {
        const task = await prisma.cleaningTask.findUnique({
          where: { id: task_id },
          include: { session: { select: { userId: true, id: true } } },
        });
        if (!task || task.session.userId !== userId) {
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
  });

  // clean_tasks_end_session
  registry.register({
    name: "clean_tasks_end_session",
    description:
      "End a cleaning session. Calculates points with bonuses (streak, zero-skip, all-tasks) and returns a summary.",
    category: "clean-tasks",
    tier: "free",
    inputSchema: {
      session_id: z.string().min(1).describe("The session ID to end"),
    },
    handler: async ({
      session_id,
    }: {
      session_id: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_tasks_end_session", async () => {
        const session = await prisma.cleaningSession.findFirst({
          where: { id: session_id, userId },
          include: { tasks: true },
        });
        if (!session) {
          return textResult("Session not found or not owned by you.");
        }

        if (session.status === "COMPLETED") {
          return textResult("This session is already completed.");
        }

        // Calculate task points
        const taskPoints = session.tasks
          .filter(t => t.status === "COMPLETED" || t.status === "VERIFIED")
          .reduce((sum, t) => sum + t.pointsValue, 0);

        // Get current streak for bonus calculation
        const streak = await prisma.cleaningStreak.findUnique({
          where: { userId },
        });

        const hasVerificationPhoto = session.tasks.some(
          t => t.status === "VERIFIED",
        );
        const zeroSkips = session.skippedTasks === 0
          && session.completedTasks > 0;
        const allTasksDone = session.completedTasks + session.tasks.filter(t =>
                  t.status === "VERIFIED"
                ).length
            === session.totalTasks && session.totalTasks > 0;

        const points = calculateSessionPoints({
          taskPoints,
          currentStreak: streak?.currentStreak ?? 0,
          hasVerificationPhoto,
          zeroSkips,
          allTasksDone,
        });

        // Update session
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
        text +=
          `\nUse \`clean_streaks_record_session\` to update your streak and \`clean_motivate_check_achievements\` to check for new achievements!`;

        return textResult(text);
      });
    },
  });

  // clean_tasks_requeue_skipped
  registry.register({
    name: "clean_tasks_requeue_skipped",
    description: "Move all skipped tasks back to pending status so they can be attempted again.",
    category: "clean-tasks",
    tier: "free",
    inputSchema: {
      session_id: z.string().min(1).describe("The session ID"),
    },
    handler: async ({
      session_id,
    }: {
      session_id: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_tasks_requeue_skipped", async () => {
        const session = await prisma.cleaningSession.findFirst({
          where: { id: session_id, userId },
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

        // Reset skipped count
        await prisma.cleaningSession.update({
          where: { id: session_id },
          data: { skippedTasks: 0 },
        });

        return textResult(
          `**${result.count} task(s) requeued!** They're back in the queue as pending.\n\nUse \`clean_tasks_get_current\` to get the next task.`,
        );
      });
    },
  });
}
