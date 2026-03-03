/**
 * CleanSweep Reminder Tools (Server-Side)
 *
 * MCP tools for managing cleaning reminders — create, list, update, delete.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import prisma from "@/lib/prisma";
import { safeToolCall, textResult } from "./tool-helpers";

export function registerCleanRemindersTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // clean_reminders_create
  registry.register({
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
      message: z
        .string()
        .max(200)
        .optional()
        .describe("Optional custom reminder message"),
    },
    handler: async ({
      time,
      days,
      message,
    }: {
      time: string;
      days: Array<"MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN">;
      message?: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_reminders_create", async () => {
        const reminder = await prisma.cleaningReminder.create({
          data: {
            userId,
            time,
            days,
            message,
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
  });

  // clean_reminders_list
  registry.register({
    name: "clean_reminders_list",
    description: "List all your cleaning reminders.",
    category: "clean-reminders",
    tier: "free",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> => {
      return safeToolCall("clean_reminders_list", async () => {
        const reminders = await prisma.cleaningReminder.findMany({
          where: { userId },
          orderBy: { time: "asc" },
        });

        if (reminders.length === 0) {
          return textResult(
            "No reminders set. Use `clean_reminders_create` to set one up!",
          );
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
  });

  // clean_reminders_update
  registry.register({
    name: "clean_reminders_update",
    description:
      "Update a cleaning reminder. You can change time, days, enabled status, or message.",
    category: "clean-reminders",
    tier: "free",
    inputSchema: {
      reminder_id: z.string().min(1).describe("The reminder ID to update"),
      time: z
        .string()
        .regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format")
        .optional()
        .describe("New time in HH:mm format"),
      days: z
        .array(z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]))
        .min(1)
        .optional()
        .describe("New days of the week"),
      enabled: z
        .boolean()
        .optional()
        .describe("Enable or disable the reminder"),
      message: z
        .string()
        .max(200)
        .optional()
        .describe("New custom message"),
    },
    handler: async ({
      reminder_id,
      time,
      days,
      enabled,
      message,
    }: {
      reminder_id: string;
      time?: string;
      days?: Array<"MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN">;
      enabled?: boolean;
      message?: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_reminders_update", async () => {
        // Verify ownership
        const existing = await prisma.cleaningReminder.findFirst({
          where: { id: reminder_id, userId },
        });
        if (!existing) {
          return textResult("Reminder not found or not owned by you.");
        }

        const data: Record<string, unknown> = {};
        if (time !== undefined) data.time = time;
        if (days !== undefined) data.days = days;
        if (enabled !== undefined) data.enabled = enabled;
        if (message !== undefined) data.message = message;

        if (Object.keys(data).length === 0) {
          return textResult("No fields to update. Provide at least one field.");
        }

        const updated = await prisma.cleaningReminder.update({
          where: { id: reminder_id },
          data,
        });

        let text = `**Reminder updated!**\n\n`;
        text += `- **Time:** ${updated.time}\n`;
        text += `- **Days:** ${updated.days.join(", ")}\n`;
        text += `- **Enabled:** ${updated.enabled ? "Yes" : "No"}\n`;
        if (updated.message) text += `- **Message:** ${updated.message}\n`;

        return textResult(text);
      });
    },
  });

  // clean_reminders_delete
  registry.register({
    name: "clean_reminders_delete",
    description: "Delete a cleaning reminder.",
    category: "clean-reminders",
    tier: "free",
    inputSchema: {
      reminder_id: z.string().min(1).describe("The reminder ID to delete"),
    },
    handler: async ({
      reminder_id,
    }: {
      reminder_id: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_reminders_delete", async () => {
        // Verify ownership
        const existing = await prisma.cleaningReminder.findFirst({
          where: { id: reminder_id, userId },
        });
        if (!existing) {
          return textResult("Reminder not found or not owned by you.");
        }

        await prisma.cleaningReminder.delete({ where: { id: reminder_id } });

        return textResult(
          `**Reminder deleted.** (was: ${existing.time} on ${existing.days.join(", ")})`,
        );
      });
    },
  });
}
