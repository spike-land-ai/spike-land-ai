import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { resolveWorkspace, textResult } from "./tool-helpers";
import { type ReminderType } from "@prisma/client";
import { workspaceTool } from "../tool-builder/procedures.js";

export function registerRemindersTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        workspaceTool(userId)
            .tool("reminders_list", "List connection reminders for a workspace.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                status: z.enum(["ACTIVE", "COMPLETED", "ALL"]).optional().default("ACTIVE"),
            })
            .meta({ category: "reminders", tier: "workspace" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;

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
                        `- **${r.title}** [${r.status}]${connectionInfo}\n  Due: ${r.dueDate.toISOString()}\n  Description: ${r.description || "N/A"
                        }\n  ID: \`${r.id}\`\n\n`;
                }
                return textResult(text);
            })
    );

    registry.registerBuilt(
        workspaceTool(userId)
            .tool("reminders_create", "Create a new connection reminder.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                title: z.string().min(1).describe("Reminder title."),
                description: z.string().optional(),
                type: z.enum(["FOLLOW_UP", "RECONNECT", "OTHER"]).default("OTHER"),
                dueDate: z.string().datetime().describe("ISO 8601 date."),
                connectionId: z.string().min(1).describe(
                    "Connection ID to associate this reminder with.",
                ),
            })
            .meta({ category: "reminders", tier: "workspace" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;

                const prisma = (await import("@/lib/prisma")).default;
                const workspace = await resolveWorkspace(userId, args.workspace_slug);
                const reminder = await prisma.connectionReminder.create({
                    data: {
                        workspaceId: workspace.id,
                        title: args.title,
                        description: args.description ?? null,
                        type: args.type as ReminderType,
                        dueDate: new Date(args.dueDate),
                        connectionId: args.connectionId,
                    },
                });
                return textResult(
                    `**Reminder Created!**\n\nID: \`${reminder.id}\`\nTitle: ${reminder.title}`,
                );
            })
    );

    registry.registerBuilt(
        workspaceTool(userId)
            .tool("reminders_complete", "Mark a reminder as completed.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                reminderId: z.string().min(1),
            })
            .meta({ category: "reminders", tier: "workspace" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;

                const prisma = (await import("@/lib/prisma")).default;
                const workspace = await resolveWorkspace(userId, args.workspace_slug);
                const reminder = await prisma.connectionReminder.update({
                    where: { id: args.reminderId, workspaceId: workspace.id },
                    data: { status: "COMPLETED" },
                });
                return textResult(
                    `**Reminder Completed!**\n\nID: \`${reminder.id}\`\nTitle: ${reminder.title}`,
                );
            })
    );
}
