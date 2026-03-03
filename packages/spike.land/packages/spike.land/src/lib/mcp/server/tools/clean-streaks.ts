/**
 * CleanSweep Streak Tools (Server-Side)
 *
 * MCP tools for streak tracking, stats, and level progression.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import prisma from "@/lib/prisma";
import { safeToolCall, textResult } from "./tool-helpers";
import {
  calculateLevel,
  isConsecutiveDay,
  isSameDay,
  pointsToNextLevel,
} from "@/lib/clean/gamification";

export function registerCleanStreaksTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // clean_streaks_get
  registry.register({
    name: "clean_streaks_get",
    description: "Get your current cleaning streak data. Creates a streak record if none exists.",
    category: "clean-streaks",
    tier: "free",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> => {
      return safeToolCall("clean_streaks_get", async () => {
        const streak = await prisma.cleaningStreak.upsert({
          where: { userId },
          create: { userId },
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
  });

  // clean_streaks_record_session
  registry.register({
    name: "clean_streaks_record_session",
    description:
      "Record a completed session in streak tracking. Updates streak (checks consecutive days), total points, sessions, tasks, and recalculates level.",
    category: "clean-streaks",
    tier: "free",
    inputSchema: {
      session_id: z.string().min(1).describe("The completed session ID"),
      points_earned: z.number().min(0).describe("Points earned in the session"),
      tasks_completed: z
        .number()
        .min(0)
        .describe("Number of tasks completed in the session"),
    },
    handler: async ({
      session_id,
      points_earned,
      tasks_completed,
    }: {
      session_id: string;
      points_earned: number;
      tasks_completed: number;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_streaks_record_session", async () => {
        // Verify session ownership and completion
        const session = await prisma.cleaningSession.findFirst({
          where: { id: session_id, userId, status: "COMPLETED" },
        });
        if (!session) {
          return textResult(
            "Session not found, not completed, or not owned by you.",
          );
        }

        const streak = await prisma.cleaningStreak.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });

        const now = new Date();
        let newStreak = streak.currentStreak;

        if (streak.lastSessionDate) {
          if (isSameDay(now, streak.lastSessionDate)) {
            // Same day — streak doesn't change
          } else if (isConsecutiveDay(now, streak.lastSessionDate)) {
            // Consecutive day — increment streak
            newStreak += 1;
          } else {
            // Streak broken — reset to 1
            newStreak = 1;
          }
        } else {
          // First session ever
          newStreak = 1;
        }

        const newTotalPoints = streak.totalPoints + points_earned;
        const newLevel = calculateLevel(newTotalPoints);
        const newBestStreak = Math.max(streak.bestStreak, newStreak);

        await prisma.cleaningStreak.update({
          where: { userId },
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
  });

  // clean_streaks_get_stats
  registry.register({
    name: "clean_streaks_get_stats",
    description:
      "Get full stats including level progress, all-time stats, and next level requirements.",
    category: "clean-streaks",
    tier: "free",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> => {
      return safeToolCall("clean_streaks_get_stats", async () => {
        const streak = await prisma.cleaningStreak.upsert({
          where: { userId },
          create: { userId },
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
  });
}
