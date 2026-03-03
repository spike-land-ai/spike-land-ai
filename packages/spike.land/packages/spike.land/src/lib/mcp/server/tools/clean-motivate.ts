/**
 * CleanSweep Motivation Tools (Server-Side)
 *
 * MCP tools for encouragement, achievements, and celebrations.
 * Designed for ADHD-friendly dopamine hits.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import prisma from "@/lib/prisma";
import { safeToolCall, textResult } from "./tool-helpers";
import {
  ACHIEVEMENTS,
  type AchievementStats,
  checkNewAchievements,
} from "@/lib/clean/gamification";
import {
  ACHIEVEMENT_MESSAGES,
  COMEBACK_MESSAGES,
  randomMessage,
  SESSION_COMPLETE_MESSAGES,
  SKIP_MESSAGES,
  STARTING_MESSAGES,
  TASK_COMPLETE_MESSAGES,
} from "@/lib/clean/encouragement";

const CONTEXT_MESSAGES: Record<string, string[]> = {
  starting: STARTING_MESSAGES,
  task_complete: TASK_COMPLETE_MESSAGES,
  skip: SKIP_MESSAGES,
  session_complete: SESSION_COMPLETE_MESSAGES,
  comeback: COMEBACK_MESSAGES,
};

export function registerCleanMotivateTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // clean_motivate_get_encouragement
  registry.register({
    name: "clean_motivate_get_encouragement",
    description:
      "Get an encouraging message based on context. Perfect for ADHD-friendly dopamine boosts during cleaning.",
    category: "clean-motivate",
    tier: "free",
    inputSchema: {
      context: z
        .enum([
          "starting",
          "task_complete",
          "skip",
          "session_complete",
          "comeback",
        ])
        .describe(
          "The context for the encouragement message",
        ),
    },
    handler: async ({
      context,
    }: {
      context:
        | "starting"
        | "task_complete"
        | "skip"
        | "session_complete"
        | "comeback";
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_motivate_get_encouragement", async () => {
        const messages = CONTEXT_MESSAGES[context];
        if (!messages || messages.length === 0) {
          return textResult("You're doing great! Keep going!");
        }

        return textResult(randomMessage(messages));
      });
    },
  });

  // clean_motivate_check_achievements
  registry.register({
    name: "clean_motivate_check_achievements",
    description:
      "Check for newly unlocked achievements after completing a session. Creates achievement records and returns any new unlocks.",
    category: "clean-motivate",
    tier: "free",
    inputSchema: {
      session_id: z
        .string()
        .min(1)
        .describe("The completed session ID to check achievements for"),
    },
    handler: async ({
      session_id,
    }: {
      session_id: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_motivate_check_achievements", async () => {
        const session = await prisma.cleaningSession.findFirst({
          where: { id: session_id, userId },
          include: { tasks: true },
        });
        if (!session) {
          return textResult("Session not found or not owned by you.");
        }

        const streak = await prisma.cleaningStreak.findUnique({
          where: { userId },
        });
        if (!streak) {
          return textResult(
            "No streak data found. Use `clean_streaks_record_session` first.",
          );
        }

        // Get already unlocked achievements
        const existing = await prisma.cleaningAchievement.findMany({
          where: { userId },
          select: { achievementType: true },
        });
        const alreadyUnlocked = new Set(
          existing.map(a => a.achievementType),
        );

        // Calculate session-specific stats
        const sessionDurationMs = session.completedAt
          ? session.completedAt.getTime() - session.startedAt.getTime()
          : 0;
        const daysSinceLastSession = streak.lastSessionDate
          ? Math.floor(
            (new Date().getTime() - streak.lastSessionDate.getTime())
              / (1000 * 60 * 60 * 24),
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

        // Create achievement records
        if (newAchievements.length > 0) {
          await prisma.cleaningAchievement.createMany({
            data: newAchievements.map(a => ({
              userId,
              achievementType: a.type,
            })),
            skipDuplicates: true,
          });
        }

        if (newAchievements.length === 0) {
          return textResult(
            "No new achievements this time. Keep going — you're making progress!",
          );
        }

        let text = `**New Achievement(s) Unlocked!**\n\n`;
        for (const a of newAchievements) {
          text += `### ${a.name}\n`;
          text += `${a.description}\n\n`;
        }

        return textResult(text);
      });
    },
  });

  // clean_motivate_get_achievements
  registry.register({
    name: "clean_motivate_get_achievements",
    description: "Get all achievements — both unlocked and locked — showing your progress.",
    category: "clean-motivate",
    tier: "free",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> => {
      return safeToolCall("clean_motivate_get_achievements", async () => {
        const unlocked = await prisma.cleaningAchievement.findMany({
          where: { userId },
          select: { achievementType: true, unlockedAt: true },
        });
        const unlockedMap = new Map(
          unlocked.map(a => [a.achievementType, a.unlockedAt]),
        );

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
  });

  // clean_motivate_celebrate
  registry.register({
    name: "clean_motivate_celebrate",
    description:
      "Get a celebration message for a specific achievement. Use after unlocking a new achievement.",
    category: "clean-motivate",
    tier: "free",
    inputSchema: {
      achievement_type: z
        .string()
        .min(1)
        .describe(
          "The achievement type to celebrate (e.g. 'FIRST_SESSION', 'THREE_DAY_STREAK')",
        ),
    },
    handler: async ({
      achievement_type,
    }: {
      achievement_type: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_motivate_celebrate", async () => {
        const message = ACHIEVEMENT_MESSAGES[achievement_type];
        if (!message) {
          return textResult(
            `Achievement "${achievement_type}" not found. Use \`clean_motivate_get_achievements\` to see available achievements.`,
          );
        }

        const achievement = ACHIEVEMENTS.find(
          a => a.type === achievement_type,
        );
        const name = achievement?.name ?? achievement_type;

        const text = `**${name}!**\n\n${message}`;

        return textResult(text);
      });
    },
  });
}
