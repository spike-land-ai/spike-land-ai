/**
 * Direct Message MCP Tools
 *
 * Send, list, and manage private messages between users.
 * Defaults to messaging the site owner (Zoltan) when no recipient is specified.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures.js";

export function registerDirectMessageTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        freeTool(userId)
            .tool("dm_send", "Send a private message to a user (defaults to site owner Zoltan).", {
                subject: z.string().min(1).describe("Subject line of the message."),
                message: z.string().min(1).describe("Body of the message."),
                toEmail: z.string().email().optional().describe(
                    "Recipient email address. Defaults to site owner (zoltan@spike.land).",
                ),
                priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().describe(
                    "Message priority level. Defaults to MEDIUM.",
                ),
            })
            .meta({ category: "direct-message", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { subject, message, toEmail, priority } = input;

                const prisma = (await import("@/lib/prisma")).default;

                const targetUser = await prisma.user.findFirst({
                    where: {
                        email: {
                            equals: toEmail || "zoltan@spike.land",
                            mode: "insensitive",
                        },
                    },
                    select: { id: true, email: true, name: true },
                });

                if (!targetUser) {
                    return textResult(
                        `**Error:** Recipient not found (${toEmail || "zoltan@spike.land"
                        }). Please check the email address and try again.`,
                    );
                }

                const dm = await prisma.directMessage.create({
                    data: {
                        fromUserId: userId.startsWith("session:") ? null : userId,
                        fromSessionId: userId.startsWith("session:") ? userId : null,
                        toUserId: targetUser.id,
                        subject,
                        message,
                        priority: priority || "MEDIUM",
                    },
                });

                return textResult(
                    `**Message Sent**\n\n`
                    + `**ID:** ${dm.id}\n`
                    + `**To:** ${targetUser.name || targetUser.email}\n`
                    + `**Subject:** ${subject}\n`
                    + `**Priority:** ${priority || "MEDIUM"}`,
                );
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("dm_list", "List direct messages for the current user.", {
                unreadOnly: z.boolean().optional().describe(
                    "When true, only return unread messages.",
                ),
                limit: z.number().optional().describe(
                    "Maximum number of messages to return (default 20).",
                ),
            })
            .meta({ category: "direct-message", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { unreadOnly, limit } = input;

                const prisma = (await import("@/lib/prisma")).default;

                const messages = await prisma.directMessage.findMany({
                    where: {
                        toUserId: userId,
                        ...(unreadOnly ? { read: false } : {}),
                    },
                    orderBy: { createdAt: "desc" },
                    take: limit || 20,
                });

                if (messages.length === 0) {
                    return textResult(
                        unreadOnly ? "No unread messages." : "No messages found.",
                    );
                }

                let text = `**Direct Messages (${messages.length}):**\n\n`;
                for (const msg of messages) {
                    const preview = (msg.message as string).length > 80
                        ? (msg.message as string).slice(0, 80) + "..."
                        : msg.message;
                    const readStatus = msg.read ? "Read" : "Unread";
                    const date = new Date(msg.createdAt as string | number | Date).toISOString()
                        .split("T")[0];
                    text += `- **${msg.subject}** [${msg.priority}] [${readStatus}] (${date})\n`;
                    text += `  ID: ${msg.id}\n`;
                    text += `  ${preview}\n\n`;
                }

                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("dm_mark_read", "Mark a direct message as read.", {
                messageId: z.string().min(1).describe(
                    "ID of the direct message to mark as read.",
                ),
            })
            .meta({ category: "direct-message", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { messageId } = input;

                const prisma = (await import("@/lib/prisma")).default;

                await prisma.directMessage.update({
                    where: { id: messageId, toUserId: userId },
                    data: { read: true, readAt: new Date() },
                });

                return textResult(`**Message marked as read.** (ID: ${messageId})`);
            })
    );
}
