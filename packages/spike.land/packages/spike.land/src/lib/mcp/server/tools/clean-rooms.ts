/**
 * CleanSweep Room Management Tools (Server-Side)
 *
 * MCP tools for defining rooms, viewing history, running statistics,
 * and scheduling recurring cleans.
 *
 * Rooms are identified by their label string stored on CleaningSession.
 * Schedules are persisted on CleaningReminder with a message prefix so
 * they can be distinguished from reminder-only records.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { CleaningReminderDay } from "@/generated/prisma";
import prisma from "@/lib/prisma";
import { safeToolCall, textResult } from "./tool-helpers";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Prefix used to tag room schedule reminders so they can be found later. */
const SCHEDULE_PREFIX = "__room_schedule__";

/** Suggested weekly frequency for each room type (days between cleans). */
const SCHEDULE_SUGGESTIONS: Record<string, string> = {
  kitchen: "daily",
  bathroom: "every_other_day",
  bedroom: "weekly",
  living_room: "weekly",
  office: "weekly",
  garage: "monthly",
  laundry: "weekly",
  other: "weekly",
};

type RoomType =
  | "bedroom"
  | "bathroom"
  | "kitchen"
  | "living_room"
  | "office"
  | "garage"
  | "laundry"
  | "other";

type Priority = "high" | "medium" | "low";
type SortBy = "name" | "priority" | "last_cleaned";
type Period = "7d" | "30d" | "90d" | "all";
type Frequency =
  | "daily"
  | "every_other_day"
  | "weekly"
  | "biweekly"
  | "monthly";
type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

// Map preferred_day → CleaningReminderDay enum value
const DAY_ENUM: Record<DayOfWeek, CleaningReminderDay> = {
  monday: CleaningReminderDay.MON,
  tuesday: CleaningReminderDay.TUE,
  wednesday: CleaningReminderDay.WED,
  thursday: CleaningReminderDay.THU,
  friday: CleaningReminderDay.FRI,
  saturday: CleaningReminderDay.SAT,
  sunday: CleaningReminderDay.SUN,
};

/** Frequency in human-readable form and its reminder day cadence hint. */
const FREQ_LABEL: Record<Frequency, string> = {
  daily: "Every day",
  every_other_day: "Every other day",
  weekly: "Once a week",
  biweekly: "Every two weeks",
  monthly: "Once a month",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compute next scheduled date from frequency + preferred day. */
function computeNextDate(
  frequency: Frequency,
  preferredDay?: DayOfWeek,
  preferredTime?: string,
): Date {
  const now = new Date();
  const [hh = "09", mm = "00"] = (preferredTime ?? "09:00").split(":");
  const targetHour = parseInt(hh, 10);
  const targetMin = parseInt(mm, 10);

  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(targetHour, targetMin);

  // If the computed time is already past for today, start from tomorrow
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  switch (frequency) {
    case "daily":
      break; // already next occurrence
    case "every_other_day":
      next.setDate(next.getDate() + (next.getDay() % 2 === 0 ? 0 : 1));
      break;
    case "weekly":
    case "biweekly": {
      if (preferredDay) {
        const targetWd = [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ]
          .indexOf(preferredDay);
        const currentWd = next.getDay();
        let diff = targetWd - currentWd;
        if (diff <= 0) diff += 7;
        next.setDate(next.getDate() + diff);
        if (frequency === "biweekly") next.setDate(next.getDate() + 7);
      } else {
        next.setDate(next.getDate() + (frequency === "biweekly" ? 14 : 7));
      }
      break;
    }
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      if (preferredDay) {
        // Set to the first occurrence of preferred day in that month
        const targetWd = [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ]
          .indexOf(preferredDay);
        next.setDate(1);
        const diff = (targetWd - next.getDay() + 7) % 7;
        next.setDate(1 + diff);
      }
      break;
  }

  return next;
}

/** Build the days array for a CleaningReminder from frequency + preferred day. */
function buildReminderDays(
  frequency: Frequency,
  preferredDay?: DayOfWeek,
): CleaningReminderDay[] {
  if (preferredDay) {
    return [DAY_ENUM[preferredDay]!];
  }
  // Sensible defaults per frequency
  switch (frequency) {
    case "daily":
      return [
        CleaningReminderDay.MON,
        CleaningReminderDay.TUE,
        CleaningReminderDay.WED,
        CleaningReminderDay.THU,
        CleaningReminderDay.FRI,
        CleaningReminderDay.SAT,
        CleaningReminderDay.SUN,
      ];
    case "every_other_day":
      return [
        CleaningReminderDay.MON,
        CleaningReminderDay.WED,
        CleaningReminderDay.FRI,
        CleaningReminderDay.SUN,
      ];
    case "weekly":
      return [CleaningReminderDay.MON];
    case "biweekly":
      return [CleaningReminderDay.MON];
    case "monthly":
      return [CleaningReminderDay.MON];
  }
}

/** Estimate a "cleanliness score" (0–100) from recent session activity. */
function cleanlinessScore(lastCleaned: Date | null, frequency: string): number {
  if (!lastCleaned) return 0;
  const hoursSince = (Date.now() - lastCleaned.getTime()) / (1000 * 60 * 60);
  const decayHours: Record<string, number> = {
    daily: 24,
    every_other_day: 48,
    weekly: 168,
    biweekly: 336,
    monthly: 720,
    unknown: 168,
  };
  const decay = decayHours[frequency] ?? decayHours.unknown!;
  return Math.max(0, Math.round(100 - (hoursSince / decay) * 100));
}

// ─── Tool Registration ────────────────────────────────────────────────────────

export function registerCleanRoomsTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // ── clean_create_room ──────────────────────────────────────────────────────
  registry.register({
    name: "clean_create_room",
    description:
      "Define a room in your home for CleanSweep tracking. Returns the room ID, type, and a suggested cleaning schedule.",
    category: "clean-rooms",
    tier: "free",
    inputSchema: {
      name: z
        .string()
        .min(1)
        .max(80)
        .describe("Human-readable room name, e.g. 'Main Bathroom' or 'Kitchen'"),
      room_type: z
        .enum([
          "bedroom",
          "bathroom",
          "kitchen",
          "living_room",
          "office",
          "garage",
          "laundry",
          "other",
        ])
        .describe("Type of room"),
      priority: z
        .enum(["high", "medium", "low"])
        .optional()
        .describe("Cleaning priority for this room (default: medium)"),
    },
    handler: async ({
      name,
      room_type,
      priority,
    }: {
      name: string;
      room_type: RoomType;
      priority?: Priority;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_create_room", async () => {
        const resolvedPriority: Priority = priority ?? "medium";
        const suggestion = SCHEDULE_SUGGESTIONS[room_type] ?? "weekly";

        // Persist as a CleaningReminder with a special prefix so we can look
        // up the room definition later.  The message field encodes the full
        // metadata as JSON.
        const meta = JSON.stringify({
          roomName: name,
          roomType: room_type,
          priority: resolvedPriority,
        });
        const reminder = await prisma.cleaningReminder.create({
          data: {
            userId,
            time: "09:00",
            days: [CleaningReminderDay.MON],
            message: `${SCHEDULE_PREFIX}${meta}`,
          },
        });

        let text = `**Room created!**\n\n`;
        text += `- **Room ID:** \`${reminder.id}\`\n`;
        text += `- **Name:** ${name}\n`;
        text += `- **Type:** ${room_type}\n`;
        text += `- **Priority:** ${resolvedPriority}\n`;
        text += `- **Suggested schedule:** ${FREQ_LABEL[suggestion as Frequency] ?? suggestion}\n`;
        text +=
          `\nUse \`clean_set_schedule\` with room ID \`${reminder.id}\` to set a recurring schedule.`;

        return textResult(text);
      });
    },
  });

  // ── clean_list_rooms ───────────────────────────────────────────────────────
  registry.register({
    name: "clean_list_rooms",
    description:
      "List all defined rooms with name, type, last cleaned date, and cleanliness score.",
    category: "clean-rooms",
    tier: "free",
    inputSchema: {
      sort_by: z
        .enum(["name", "priority", "last_cleaned"])
        .optional()
        .describe("Sort order for the room list (default: name)"),
    },
    handler: async ({
      sort_by,
    }: {
      sort_by?: SortBy;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_list_rooms", async () => {
        // Room definitions are stored as reminders with the SCHEDULE_PREFIX.
        const reminders = await prisma.cleaningReminder.findMany({
          where: {
            userId,
            message: { startsWith: SCHEDULE_PREFIX },
          },
          orderBy: { time: "asc" },
        });

        if (reminders.length === 0) {
          return textResult(
            "No rooms defined yet. Use `clean_create_room` to add your first room.",
          );
        }

        // For each room, find the most recent completed session whose roomLabel
        // matches the room name.
        type RoomRow = {
          id: string;
          name: string;
          type: string;
          priority: Priority;
          lastCleaned: Date | null;
          score: number;
          frequency: string;
        };

        const rows: RoomRow[] = await Promise.all(
          reminders.map(async r => {
            const rawMeta = (r.message ?? "").slice(SCHEDULE_PREFIX.length);
            let meta: { roomName: string; roomType: string; priority: Priority; } = {
              roomName: "Unknown",
              roomType: "other",
              priority: "medium",
            };
            try {
              meta = JSON.parse(rawMeta) as typeof meta;
            } catch {
              // malformed entry — keep defaults
            }

            const lastSession = await prisma.cleaningSession.findFirst({
              where: {
                userId,
                roomLabel: meta.roomName,
                status: "COMPLETED",
              },
              orderBy: { completedAt: "desc" },
              select: { completedAt: true },
            });

            const freq = SCHEDULE_SUGGESTIONS[meta.roomType] ?? "weekly";
            const lastCleaned = lastSession?.completedAt ?? null;
            return {
              id: r.id,
              name: meta.roomName,
              type: meta.roomType,
              priority: meta.priority,
              lastCleaned,
              score: cleanlinessScore(lastCleaned, freq),
              frequency: freq,
            };
          }),
        );

        const priorityOrder: Record<Priority, number> = {
          high: 0,
          medium: 1,
          low: 2,
        };

        const sorted = [...rows].sort((a, b) => {
          switch (sort_by ?? "name") {
            case "priority":
              return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
            case "last_cleaned": {
              const at = a.lastCleaned?.getTime() ?? 0;
              const bt = b.lastCleaned?.getTime() ?? 0;
              return at - bt; // oldest first (needs cleaning soonest)
            }
            default:
              return a.name.localeCompare(b.name);
          }
        });

        let text = `**Your Rooms (${sorted.length})**\n\n`;
        for (const row of sorted) {
          const lastDate = row.lastCleaned
            ? row.lastCleaned.toISOString().split("T")[0]
            : "never";
          text += `- **${row.name}** [${row.type}] — Priority: ${row.priority}\n`;
          text += `  ID: \`${row.id}\` | Last cleaned: ${lastDate} | Score: ${row.score}/100\n`;
        }

        return textResult(text);
      });
    },
  });

  // ── clean_get_room_history ─────────────────────────────────────────────────
  registry.register({
    name: "clean_get_room_history",
    description:
      "Get the cleaning history for a specific room, including sessions, tasks completed, time spent, and before/after scores.",
    category: "clean-rooms",
    tier: "free",
    inputSchema: {
      room_id: z
        .string()
        .min(1)
        .describe("The room ID returned by `clean_create_room` or `clean_list_rooms`"),
      period: z
        .enum(["7d", "30d", "90d", "all"])
        .optional()
        .describe("Time period for history (default: 30d)"),
    },
    handler: async ({
      room_id,
      period,
    }: {
      room_id: string;
      period?: Period;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_get_room_history", async () => {
        // Look up the room definition reminder.
        const reminder = await prisma.cleaningReminder.findFirst({
          where: { id: room_id, userId, message: { startsWith: SCHEDULE_PREFIX } },
        });
        if (!reminder) {
          return textResult("Room not found or not owned by you.");
        }

        const rawMeta = (reminder.message ?? "").slice(SCHEDULE_PREFIX.length);
        let roomName = "Unknown";
        let roomType = "other";
        try {
          const parsed = JSON.parse(rawMeta) as { roomName: string; roomType: string; };
          roomName = parsed.roomName;
          roomType = parsed.roomType;
        } catch {
          // keep defaults
        }

        // Compute date filter
        const sinceDate = (() => {
          const resolved = period ?? "30d";
          if (resolved === "all") return undefined;
          const days = resolved === "7d" ? 7 : resolved === "30d" ? 30 : 90;
          const d = new Date();
          d.setDate(d.getDate() - days);
          return d;
        })();

        const sessions = await prisma.cleaningSession.findMany({
          where: {
            userId,
            roomLabel: roomName,
            status: "COMPLETED",
            ...(sinceDate ? { completedAt: { gte: sinceDate } } : {}),
          },
          orderBy: { completedAt: "desc" },
          include: {
            tasks: {
              select: {
                status: true,
                pointsValue: true,
                completedAt: true,
              },
            },
          },
        });

        if (sessions.length === 0) {
          const periodLabel = period ?? "30d";
          return textResult(
            `No completed cleaning sessions found for **${roomName}** in the last ${periodLabel}.\n\nStart a session with \`clean_tasks_start_session\` and set room_label to "${roomName}".`,
          );
        }

        const freq = SCHEDULE_SUGGESTIONS[roomType] ?? "weekly";

        let text = `**Cleaning History — ${roomName}**\n`;
        text += `Type: ${roomType} | Period: ${period ?? "30d"} | Sessions: ${sessions.length}\n\n`;

        for (const session of sessions) {
          const date = session.completedAt
            ? session.completedAt.toISOString().split("T")[0]
            : "unknown date";
          const completedTasks = session.tasks.filter(
            t => t.status === "COMPLETED" || t.status === "VERIFIED",
          ).length;
          const totalPoints = session.tasks
            .filter(t => t.status === "COMPLETED" || t.status === "VERIFIED")
            .reduce((s, t) => s + t.pointsValue, 0);

          // Estimate session duration from startedAt → completedAt
          let durationMins: number | null = null;
          if (session.startedAt && session.completedAt) {
            durationMins = Math.round(
              (session.completedAt.getTime() - session.startedAt.getTime()) / 60000,
            );
          }

          text += `### ${date}\n`;
          text += `- Tasks completed: ${completedTasks}/${session.totalTasks}\n`;
          text += `- Points earned: ${totalPoints}\n`;
          if (durationMins !== null) {
            text += `- Time spent: ${durationMins} min\n`;
          }
          // Before/after cleanliness scores based on age at session time
          const sessionAge = session.completedAt ? session.completedAt : new Date();
          const scoreAfter = cleanlinessScore(sessionAge, freq);
          text += `- Cleanliness score after: ${scoreAfter}/100\n`;
          text += `\n`;
        }

        return textResult(text);
      });
    },
  });

  // ── clean_get_statistics ───────────────────────────────────────────────────
  registry.register({
    name: "clean_get_statistics",
    description:
      "Get overall CleanSweep statistics: total sessions, tasks, time, average session length, cleanest room, most improved room, and current streak.",
    category: "clean-rooms",
    tier: "free",
    inputSchema: {
      period: z
        .enum(["7d", "30d", "90d", "all"])
        .optional()
        .describe("Time period for statistics (default: 30d)"),
    },
    handler: async ({
      period,
    }: {
      period?: Period;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_get_statistics", async () => {
        const sinceDate = (() => {
          const resolved = period ?? "30d";
          if (resolved === "all") return undefined;
          const days = resolved === "7d" ? 7 : resolved === "30d" ? 30 : 90;
          const d = new Date();
          d.setDate(d.getDate() - days);
          return d;
        })();

        const [sessions, streak] = await Promise.all([
          prisma.cleaningSession.findMany({
            where: {
              userId,
              status: "COMPLETED",
              ...(sinceDate ? { completedAt: { gte: sinceDate } } : {}),
            },
            include: {
              tasks: { select: { status: true, pointsValue: true } },
            },
            orderBy: { completedAt: "asc" },
          }),
          prisma.cleaningStreak.findUnique({ where: { userId } }),
        ]);

        const totalSessions = sessions.length;

        if (totalSessions === 0) {
          return textResult(
            `No completed sessions found in the selected period (${
              period ?? "30d"
            }).\n\nStart a session with \`clean_tasks_start_session\`!`,
          );
        }

        let totalTasksCompleted = 0;
        let totalPoints = 0;
        let totalDurationMins = 0;
        let sessionWithDuration = 0;

        // Track per-room stats for cleanest / most improved
        const roomPoints: Record<string, number> = {};
        const roomSessions: Record<string, number> = {};

        for (const session of sessions) {
          const completed = session.tasks.filter(
            t => t.status === "COMPLETED" || t.status === "VERIFIED",
          );
          totalTasksCompleted += completed.length;
          const pts = completed.reduce((s, t) => s + t.pointsValue, 0);
          totalPoints += pts;

          if (session.startedAt && session.completedAt) {
            const dur = Math.round(
              (session.completedAt.getTime() - session.startedAt.getTime()) / 60000,
            );
            totalDurationMins += dur;
            sessionWithDuration += 1;
          }

          if (session.roomLabel) {
            roomPoints[session.roomLabel] = (roomPoints[session.roomLabel] ?? 0) + pts;
            roomSessions[session.roomLabel] = (roomSessions[session.roomLabel] ?? 0) + 1;
          }
        }

        const avgSessionMins = sessionWithDuration > 0
          ? Math.round(totalDurationMins / sessionWithDuration)
          : null;

        // Cleanest room: highest average points per session
        let cleanestRoom: string | null = null;
        let cleanestAvg = 0;
        for (const [room, pts] of Object.entries(roomPoints)) {
          const count = roomSessions[room] ?? 1;
          const avg = pts / count;
          if (avg > cleanestAvg) {
            cleanestAvg = avg;
            cleanestRoom = room;
          }
        }

        // Most improved: room with highest total session count (most attention)
        let mostImproved: string | null = null;
        let mostSessions = 0;
        for (const [room, count] of Object.entries(roomSessions)) {
          if (count > mostSessions) {
            mostSessions = count;
            mostImproved = room;
          }
        }

        const currentStreak = streak?.currentStreak ?? 0;

        let text = `**CleanSweep Statistics** (${period ?? "30d"})\n\n`;
        text += `### Overview\n`;
        text += `- **Total sessions:** ${totalSessions}\n`;
        text += `- **Tasks completed:** ${totalTasksCompleted}\n`;
        text += `- **Total points:** ${totalPoints}\n`;
        if (avgSessionMins !== null) {
          text += `- **Avg session length:** ${avgSessionMins} min\n`;
        }
        if (totalDurationMins > 0) {
          text += `- **Total time cleaning:** ${totalDurationMins} min\n`;
        }
        text += `\n### Streak\n`;
        text += `- **Current streak:** ${currentStreak} day(s)\n`;
        if (streak?.bestStreak) {
          text += `- **Best streak:** ${streak.bestStreak} day(s)\n`;
        }
        if (streak?.level) {
          text += `- **Level:** ${streak.level}\n`;
        }
        if (Object.keys(roomPoints).length > 0) {
          text += `\n### Room Highlights\n`;
          if (cleanestRoom) {
            text += `- **Cleanest room:** ${cleanestRoom}\n`;
          }
          if (mostImproved && mostImproved !== cleanestRoom) {
            text += `- **Most actively cleaned:** ${mostImproved} (${mostSessions} sessions)\n`;
          }
        }

        return textResult(text);
      });
    },
  });

  // ── clean_set_schedule ─────────────────────────────────────────────────────
  registry.register({
    name: "clean_set_schedule",
    description:
      "Set a recurring cleaning schedule for a room. Updates the room's reminder with frequency, preferred day, and preferred time.",
    category: "clean-rooms",
    tier: "free",
    inputSchema: {
      room_id: z
        .string()
        .min(1)
        .describe("The room ID from `clean_create_room` or `clean_list_rooms`"),
      frequency: z
        .enum(["daily", "every_other_day", "weekly", "biweekly", "monthly"])
        .describe("How often this room should be cleaned"),
      preferred_day: z
        .enum([
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ])
        .optional()
        .describe("Preferred day of the week for weekly/biweekly/monthly schedules"),
      preferred_time: z
        .string()
        .regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format")
        .optional()
        .describe("Preferred time of day in HH:mm format (e.g. '08:30')"),
    },
    handler: async ({
      room_id,
      frequency,
      preferred_day,
      preferred_time,
    }: {
      room_id: string;
      frequency: Frequency;
      preferred_day?: DayOfWeek;
      preferred_time?: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_set_schedule", async () => {
        const reminder = await prisma.cleaningReminder.findFirst({
          where: { id: room_id, userId, message: { startsWith: SCHEDULE_PREFIX } },
        });
        if (!reminder) {
          return textResult("Room not found or not owned by you.");
        }

        const rawMeta = (reminder.message ?? "").slice(SCHEDULE_PREFIX.length);
        let meta: { roomName: string; roomType: string; priority: string; } = {
          roomName: "Unknown",
          roomType: "other",
          priority: "medium",
        };
        try {
          meta = JSON.parse(rawMeta) as typeof meta;
        } catch {
          // keep defaults
        }

        const days = buildReminderDays(frequency, preferred_day);
        const time = preferred_time ?? "09:00";

        // Embed the schedule info into the message so it can be read back.
        const newMeta = JSON.stringify({
          ...meta,
          schedule: { frequency, preferred_day, preferred_time: time },
        });

        await prisma.cleaningReminder.update({
          where: { id: room_id },
          data: {
            time,
            days,
            message: `${SCHEDULE_PREFIX}${newMeta}`,
            enabled: true,
          },
        });

        const nextDate = computeNextDate(frequency, preferred_day, time);
        const nextDateStr = nextDate.toISOString().split("T")[0];

        let text = `**Schedule set for ${meta.roomName}!**\n\n`;
        text += `- **Frequency:** ${FREQ_LABEL[frequency]}\n`;
        if (preferred_day) text += `- **Preferred day:** ${preferred_day}\n`;
        text += `- **Preferred time:** ${time}\n`;
        text += `- **Next scheduled clean:** ${nextDateStr}\n`;
        text +=
          `\nUse \`clean_tasks_start_session\` with room_label "${meta.roomName}" to start a session for this room.`;

        return textResult(text);
      });
    },
  });
}
