/**
 * Reminders Tools (CF Workers)
 *
 * CRUD for user reminders using Drizzle ORM + D1.
 * Simplified from spike.land's workspace-scoped connectionReminder model
 * to a flat per-user reminders table.
 */

import { z } from "zod";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import type { ToolRegistryAdapter } from "./types";
import { freeTool } from "../procedures/index";
import { textResult } from "./tool-helpers";
import type { DrizzleDB } from "../db/index";
import { reminders } from "../db/schema";

export function registerRemindersTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool("reminders_list", "List your reminders.", {
        status: z
          .enum(["ACTIVE", "COMPLETED", "ALL"])
          .optional()
          .default("ACTIVE")
          .describe("Filter by status."),
      })
      .meta({ category: "reminders", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const conditions = [eq(reminders.userId, ctx.userId)];

        if (input.status === "ACTIVE") {
          conditions.push(isNull(reminders.completedAt));
        } else if (input.status === "COMPLETED") {
          conditions.push(isNotNull(reminders.completedAt));
        }

        const rows = await ctx.db
          .select()
          .from(reminders)
          .where(and(...conditions))
          .orderBy(reminders.dueAt);

        if (rows.length === 0) return textResult("No reminders found.");

        let text = `**Your Reminders (${rows.length})**\n\n`;
        for (const r of rows) {
          const status = r.completedAt ? "COMPLETED" : "ACTIVE";
          const dueStr = r.dueAt ? new Date(r.dueAt).toISOString() : "No due date";
          text += `- **${r.text}** [${status}]\n  Due: ${dueStr}\n  ID: \`${r.id}\`\n\n`;
        }
        return textResult(text);
      }),
  );

  registry.registerBuilt(
    t
      .tool("reminders_create", "Create a new reminder.", {
        text: z.string().min(1).describe("Reminder text."),
        due_date: z.string().datetime().optional().describe("ISO 8601 due date."),
      })
      .meta({ category: "reminders", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const id = crypto.randomUUID();
        const now = Date.now();

        await ctx.db.insert(reminders).values({
          id,
          userId: ctx.userId,
          text: input.text,
          dueAt: input.due_date ? new Date(input.due_date).getTime() : null,
          completedAt: null,
          createdAt: now,
        });

        return textResult(`**Reminder Created!**\n\nID: \`${id}\`\nText: ${input.text}`);
      }),
  );

  registry.registerBuilt(
    t
      .tool("reminders_complete", "Mark a reminder as completed.", {
        reminder_id: z.string().min(1).describe("Reminder ID."),
      })
      .meta({ category: "reminders", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const now = Date.now();

        const updated = await ctx.db
          .update(reminders)
          .set({ completedAt: now })
          .where(and(eq(reminders.id, input.reminder_id), eq(reminders.userId, ctx.userId)))
          .returning({ id: reminders.id, text: reminders.text });

        if (updated.length === 0) {
          return textResult(
            "**Error: NOT_FOUND**\nReminder not found or not owned by you.\n**Retryable:** false",
          );
        }

        return textResult(
          `**Reminder Completed!**\n\nID: \`${updated[0]!.id}\`\nText: ${updated[0]!.text}`,
        );
      }),
  );
}
