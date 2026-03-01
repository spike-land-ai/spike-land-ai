/**
 * Agent Inbox MCP Tools
 *
 * Bidirectional chat bridge for external agents (e.g., Claude Code via MCP).
 * Allows an external agent to poll for user messages, read full context,
 * respond to app chats, and handle site-wide chat.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures.js";

export function registerAgentInboxTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        freeTool(userId)
            .tool("agent_inbox_poll", "Poll for new unread user messages across all your apps. "
                + "Returns apps with unread counts and latest message preview. "
                + "Call this repeatedly to monitor for new messages. "
                + "Also refreshes the MCP agent active flag to prevent built-in AI from processing.", {
                since: z
                    .string()
                    .optional()
                    .describe(
                        "ISO timestamp. Only return messages created after this time. Omit for all unread.",
                    ),
                app_id: z
                    .string()
                    .optional()
                    .describe("Filter to a specific app. Omit to poll all apps."),
            })
            .meta({ category: "agent-inbox", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { since, app_id } = input;

                const prisma = (await import("@/lib/prisma")).default;
                const { setMcpAgentActive } = await import("@/lib/upstash/client");

                // Build where clause for unread user messages on apps owned by this user
                const whereClause: Record<string, unknown> = {
                    role: "USER",
                    isRead: false,
                    app: { userId },
                };

                if (app_id) {
                    whereClause.appId = app_id;
                }

                if (since) {
                    whereClause.createdAt = { gt: new Date(since) };
                }

                const messages = await prisma.appMessage.findMany({
                    where: whereClause,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        appId: true,
                        content: true,
                        createdAt: true,
                        app: {
                            select: {
                                id: true,
                                name: true,
                                codespaceId: true,
                            },
                        },
                    },
                });

                // Group by app
                const appMap = new Map<string, {
                    appId: string;
                    appName: string | null;
                    codespaceId: string | null;
                    unreadCount: number;
                    latestMessage: { id: string; content: string; createdAt: Date; };
                }>();

                for (const msg of messages) {
                    const existing = appMap.get(msg.appId);
                    if (existing) {
                        existing.unreadCount++;
                    } else {
                        appMap.set(msg.appId, {
                            appId: msg.appId,
                            appName: msg.app.name,
                            codespaceId: msg.app.codespaceId,
                            unreadCount: 1,
                            latestMessage: {
                                id: msg.id,
                                content: typeof msg.content === "string"
                                    ? msg.content.slice(0, 200)
                                    : String(msg.content).slice(0, 200),
                                createdAt: msg.createdAt,
                            },
                        });
                    }
                }

                // Refresh MCP agent active flag for all polled apps
                const appIds = app_id ? [app_id] : Array.from(appMap.keys());
                for (const id of appIds) {
                    await setMcpAgentActive(id);
                }

                const serverTime = new Date().toISOString();

                if (appMap.size === 0) {
                    return textResult(
                        `**No unread messages.**\n\nserverTime: ${serverTime}\n\nCall again to continue polling.`,
                    );
                }

                let text = `**Unread Messages (${messages.length} across ${appMap.size} app(s)):**\n\n`;
                for (const app of appMap.values()) {
                    text += `### ${app.appName || app.codespaceId || app.appId}\n`;
                    text += `- **App ID:** ${app.appId}\n`;
                    text += `- **Unread:** ${app.unreadCount}\n`;
                    text += `- **Latest:** ${app.latestMessage.content}${app.latestMessage.content.length >= 200 ? "..." : ""
                        }\n`;
                    text += `- **At:** ${new Date(app.latestMessage.createdAt).toISOString()}\n\n`;
                }
                text += `serverTime: ${serverTime}`;

                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("agent_inbox_read", "Get full messages for an app. Returns chronological messages with full content, "
                + "attachments, and code versions.", {
                app_id: z
                    .string()
                    .min(1)
                    .describe("App ID to read messages from."),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(50)
                    .optional()
                    .describe("Max messages to return. Default: 20."),
                unread_only: z
                    .boolean()
                    .optional()
                    .describe("When true, only return unread messages."),
                since: z
                    .string()
                    .optional()
                    .describe("ISO timestamp. Only return messages created after this time."),
            })
            .meta({ category: "agent-inbox", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { app_id, limit, unread_only, since } = input;

                const prisma = (await import("@/lib/prisma")).default;

                // Verify app ownership
                const app = await prisma.app.findFirst({
                    where: { id: app_id, userId },
                    select: { id: true, name: true, codespaceId: true },
                });

                if (!app) {
                    return textResult(
                        `**Error:** App not found or you don't own it (ID: ${app_id}).`,
                    );
                }

                const whereClause: Record<string, unknown> = { appId: app_id };
                if (unread_only) {
                    whereClause.role = "USER";
                    whereClause.isRead = false;
                }
                if (since) {
                    whereClause.createdAt = { gt: new Date(since) };
                }

                const messages = await prisma.appMessage.findMany({
                    where: whereClause,
                    orderBy: { createdAt: "asc" },
                    take: limit || 20,
                    select: {
                        id: true,
                        role: true,
                        content: true,
                        isRead: true,
                        createdAt: true,
                        attachments: {
                            select: {
                                imageId: true,
                                image: { select: { originalUrl: true } },
                            },
                        },
                        codeVersion: {
                            select: {
                                id: true,
                                createdAt: true,
                            },
                        },
                    },
                });

                if (messages.length === 0) {
                    return textResult(
                        `**No messages found** for app "${app.name || app_id}".`,
                    );
                }

                let text = `**Messages for "${app.name || app.codespaceId || app_id
                    }" (${messages.length}):**\n\n`;
                for (const msg of messages) {
                    const role = msg.role === "USER" ? "User" : "Agent";
                    const readStatus = msg.role === "USER"
                        ? (msg.isRead ? " [Read]" : " [Unread]")
                        : "";
                    text += `**[${role}]${readStatus}** (${new Date(msg.createdAt).toISOString()
                        }) ID: ${msg.id}\n`;
                    text += `${msg.content}\n`;
                    if (msg.attachments && msg.attachments.length > 0) {
                        text += `Attachments: ${msg.attachments.map(a => a.image?.originalUrl || a.imageId)
                            .join(", ")
                            }\n`;
                    }
                    if (msg.codeVersion) {
                        text += `Code version: ${msg.codeVersion.id}\n`;
                    }
                    text += "\n";
                }

                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("agent_inbox_respond", "Send an agent response to an app chat. Creates an AGENT message, "
                + "marks processed messages as read, and broadcasts to the user's browser via SSE.", {
                app_id: z
                    .string()
                    .min(1)
                    .describe("App ID to respond to."),
                content: z
                    .string()
                    .min(1)
                    .describe("The agent's response content."),
                code_updated: z
                    .boolean()
                    .optional()
                    .describe(
                        "Set true if code was updated, triggers iframe reload for the user.",
                    ),
                processed_message_ids: z
                    .array(z.string())
                    .optional()
                    .describe("Message IDs to mark as read after responding."),
            })
            .meta({ category: "agent-inbox", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { app_id, content, code_updated, processed_message_ids } = input;

                const prisma = (await import("@/lib/prisma")).default;
                const { broadcastMessage, broadcastCodeUpdated } = await import(
                    "@/app/api/apps/[id]/messages/stream/route"
                );

                // Verify app ownership
                const app = await prisma.app.findFirst({
                    where: { id: app_id, userId },
                    select: { id: true, name: true, codespaceId: true },
                });

                if (!app) {
                    return textResult(
                        `**Error:** App not found or you don't own it (ID: ${app_id}).`,
                    );
                }

                // Create agent message
                const agentMessage = await prisma.appMessage.create({
                    data: {
                        appId: app_id,
                        role: "AGENT",
                        content,
                    },
                });

                // Mark processed messages as read
                if (processed_message_ids && processed_message_ids.length > 0) {
                    await prisma.appMessage.updateMany({
                        where: {
                            id: { in: processed_message_ids },
                            appId: app_id,
                            role: "USER",
                        },
                        data: { isRead: true },
                    });
                }

                // Broadcast to connected SSE clients
                broadcastMessage(app_id, {
                    id: agentMessage.id,
                    role: agentMessage.role,
                    content: typeof agentMessage.content === "string"
                        ? agentMessage.content
                        : String(agentMessage.content),
                    createdAt: agentMessage.createdAt,
                });

                // Broadcast code update if needed
                if (code_updated) {
                    broadcastCodeUpdated(app_id);
                }

                return textResult(
                    `**Response sent.**\n\n`
                    + `**Message ID:** ${agentMessage.id}\n`
                    + `**App:** ${app.name || app_id}\n`
                    + `**Marked read:** ${processed_message_ids?.length || 0} message(s)`
                    + (code_updated ? "\n**Code update broadcast sent.**" : ""),
                );
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("agent_inbox_site_chat_poll", "Poll for new site chat messages that need AI responses. "
                + "Returns questions where answer is null (pending).", {
                since: z
                    .string()
                    .optional()
                    .describe("ISO timestamp. Only return messages created after this time."),
            })
            .meta({ category: "agent-inbox", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { since } = input;

                const prisma = (await import("@/lib/prisma")).default;
                const { setMcpAgentActive } = await import("@/lib/upstash/client");

                // Refresh MCP agent active flag for site-chat
                await setMcpAgentActive("site-chat");

                const whereClause: Record<string, unknown> = {
                    answer: null,
                };

                if (since) {
                    whereClause.createdAt = { gt: new Date(since) };
                }

                const messages = await prisma.bazdmegChatMessage.findMany({
                    where: whereClause,
                    orderBy: { createdAt: "asc" },
                    select: {
                        id: true,
                        sessionId: true,
                        question: true,
                        route: true,
                        createdAt: true,
                    },
                });

                const serverTime = new Date().toISOString();

                if (messages.length === 0) {
                    return textResult(
                        `**No pending site chat messages.**\n\nserverTime: ${serverTime}`,
                    );
                }

                let text = `**Pending Site Chat Messages (${messages.length}):**\n\n`;
                for (const msg of messages) {
                    text += `**ID:** ${msg.id}\n`;
                    text += `**Session:** ${msg.sessionId}\n`;
                    text += `**Route:** ${msg.route || "/"}\n`;
                    text += `**Question:** ${msg.question}\n`;
                    text += `**At:** ${new Date(msg.createdAt).toISOString()}\n\n`;
                }
                text += `serverTime: ${serverTime}`;

                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("agent_inbox_site_chat_respond", "Respond to a site chat message. Updates the BazdmegChatMessage with the answer.", {
                message_id: z
                    .string()
                    .min(1)
                    .describe("ID of the BazdmegChatMessage to respond to."),
                answer: z
                    .string()
                    .min(1)
                    .describe("The agent's answer to the user's question."),
                model: z
                    .string()
                    .optional()
                    .describe("Model name to record. Defaults to 'mcp-agent'."),
            })
            .meta({ category: "agent-inbox", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { message_id, answer, model } = input;

                const prisma = (await import("@/lib/prisma")).default;

                const message = await prisma.bazdmegChatMessage.findUnique({
                    where: { id: message_id },
                    select: { id: true, question: true, answer: true },
                });

                if (!message) {
                    return textResult(
                        `**Error:** Site chat message not found (ID: ${message_id}).`,
                    );
                }

                if (message.answer) {
                    return textResult(
                        `**Error:** Message already has an answer (ID: ${message_id}).`,
                    );
                }

                await prisma.bazdmegChatMessage.update({
                    where: { id: message_id },
                    data: {
                        answer,
                        model: model || "mcp-agent",
                        agentModel: "mcp-agent",
                    },
                });

                return textResult(
                    `**Site chat response saved.**\n\n`
                    + `**Message ID:** ${message_id}\n`
                    + `**Question:** ${message.question.slice(0, 100)}${message.question.length > 100 ? "..." : ""
                    }\n`
                    + `**Answer length:** ${answer.length} chars`,
                );
            })
    );
}
