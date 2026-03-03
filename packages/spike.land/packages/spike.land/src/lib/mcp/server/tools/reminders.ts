import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolveWorkspace, safeToolCall, textResult } from "./tool-helpers";
import { type ReminderType } from "@prisma/client";

const ListRemindersSchema = z.object({
  workspace_slug: z.string().min(1).describe("Workspace slug."),
  status: z.enum(["ACTIVE", "COMPLETED", "ALL"]).optional().default("ACTIVE"),
});

const CreateReminderSchema = z.object({
  workspace_slug: z.string().min(1).describe("Workspace slug."),
  title: z.string().min(1).describe("Reminder title."),
  description: z.string().optional(),
  type: z.enum(["FOLLOW_UP", "RECONNECT", "OTHER"]).default("OTHER"),
  dueDate: z.string().datetime().describe("ISO 8601 date."),
  connectionId: z.string().min(1).describe(
    "Connection ID to associate this reminder with.",
  ),
});

const ReminderIdSchema = z.object({
  workspace_slug: z.string().min(1).describe("Workspace slug."),
  reminderId: z.string().min(1),
});

export function registerRemindersTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "reminders_list",
    description: "List connection reminders for a workspace.",
    category: "reminders",
    tier: "workspace",
    inputSchema: ListRemindersSchema.shape,
    handler: async (
      args: z.infer<typeof ListRemindersSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("reminders_list", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const workspace = await resolveWorkspace(userId, args.workspace_slug);
        const where: Record<string, unknown> = { workspaceId: workspace.id };
        if (args.status === "ACTIVE") where.status = { not: "COMPLETED" };
        else if (args.status === "COMPLETED") where.status = "COMPLETED";

        const reminders = await prisma.connectionReminder.findMany({
          where,
          include: { connection: { select: { displayName: true } } },
          orderBy: { dueDate: "asc" },
        });

        if (reminders.length === 0) return textResult("No reminders found.");
        let text = `**Reminders for ${workspace.name}**\n\n`;
        for (const r of reminders) {
          const connectionInfo = r.connection
            ? ` (Connection: ${r.connection.displayName})`
            : "";
          text +=
            `- **${r.title}** [${r.status}]${connectionInfo}\n  Due: ${r.dueDate.toISOString()}\n  Description: ${
              r.description || "N/A"
            }\n  ID: \`${r.id}\`\n\n`;
        }
        return textResult(text);
      }),
  });

  registry.register({
    name: "reminders_create",
    description: "Create a new connection reminder.",
    category: "reminders",
    tier: "workspace",
    inputSchema: CreateReminderSchema.shape,
    handler: async (
      args: z.infer<typeof CreateReminderSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("reminders_create", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const workspace = await resolveWorkspace(userId, args.workspace_slug);
        const reminder = await prisma.connectionReminder.create({
          data: {
            workspaceId: workspace.id,
            title: args.title,
            description: args.description,
            type: args.type as ReminderType,
            dueDate: new Date(args.dueDate),
            connectionId: args.connectionId,
          },
        });
        return textResult(
          `**Reminder Created!**\n\nID: \`${reminder.id}\`\nTitle: ${reminder.title}`,
        );
      }),
  });

  registry.register({
    name: "reminders_complete",
    description: "Mark a reminder as completed.",
    category: "reminders",
    tier: "workspace",
    inputSchema: ReminderIdSchema.shape,
    handler: async (
      args: z.infer<typeof ReminderIdSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("reminders_complete", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const workspace = await resolveWorkspace(userId, args.workspace_slug);
        const reminder = await prisma.connectionReminder.update({
          where: { id: args.reminderId, workspaceId: workspace.id },
          data: { status: "COMPLETED" },
        });
        return textResult(
          `**Reminder Completed!**\n\nID: \`${reminder.id}\`\nTitle: ${reminder.title}`,
        );
      }),
  });
}
