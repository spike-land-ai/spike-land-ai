/**
 * Agent Management MCP Tools
 *
 * List, get details, check message queues, and send messages to agents.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures.js";

export function registerAgentManagementTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        freeTool(userId)
            .tool("agents_list", "List your connected agents with status and stats.", {
                limit: z.number().int().min(1).max(50).optional().describe(
                    "Max results (default 20).",
                ),
            })
            .meta({ category: "agents", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { limit = 20 } = input;

                const prisma = (await import("@/lib/prisma")).default;
                const agents = await prisma.claudeCodeAgent.findMany({
                    where: { userId, deletedAt: null },
                    select: {
                        id: true,
                        displayName: true,
                        lastSeenAt: true,
                        totalTokensUsed: true,
                        totalTasksCompleted: true,
                        _count: { select: { messages: true } },
                    },
                    take: limit,
                    orderBy: { lastSeenAt: "desc" },
                });
                if (agents.length === 0) return textResult("No agents found.");
                let text = `**Agents (${agents.length}):**\n\n`;
                for (const a of agents) {
                    text +=
                        `- **${a.displayName}** — ${a._count.messages} messages, ${a.totalTasksCompleted} tasks\n  Last seen: ${a.lastSeenAt?.toISOString() || "never"
                        }\n  ID: ${a.id}\n\n`;
                }
                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("agents_get", "Get detailed information about a specific agent.", {
                agent_id: z.string().min(1).describe("Agent ID."),
            })
            .meta({ category: "agents", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { agent_id } = input;

                const prisma = (await import("@/lib/prisma")).default;
                const agent = await prisma.claudeCodeAgent.findUnique({
                    where: { id: agent_id },
                    include: {
                        _count: { select: { messages: true } },
                    },
                });
                if (!agent) {
                    return textResult(
                        "**Error: NOT_FOUND**\nAgent not found.\n**Retryable:** false",
                    );
                }
                if (agent.userId !== userId) {
                    return textResult(
                        "**Error: NOT_FOUND**\nAgent not found.\n**Retryable:** false",
                    );
                }
                return textResult(
                    `**Agent**\n\n`
                    + `**ID:** ${agent.id}\n`
                    + `**Name:** ${agent.displayName}\n`
                    + `**Machine:** ${agent.machineId}\n`
                    + `**Session:** ${agent.sessionId}\n`
                    + `**Project:** ${agent.projectPath || "(none)"}\n`
                    + `**Working Dir:** ${agent.workingDirectory || "(none)"}\n`
                    + `**Messages:** ${agent._count.messages}\n`
                    + `**Tokens Used:** ${agent.totalTokensUsed}\n`
                    + `**Tasks Completed:** ${agent.totalTasksCompleted}\n`
                    + `**Session Time:** ${agent.totalSessionTime}s\n`
                    + `**Last Seen:** ${agent.lastSeenAt?.toISOString() || "never"}\n`
                    + `**Created:** ${agent.createdAt.toISOString()}`,
                );
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("agents_get_queue", "Get unread messages queued for an agent.", {
                agent_id: z.string().min(1).describe("Agent ID to check queue for."),
            })
            .meta({ category: "agents", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { agent_id } = input;

                const prisma = (await import("@/lib/prisma")).default;
                // Verify ownership
                const agent = await prisma.claudeCodeAgent.findUnique({
                    where: { id: agent_id },
                    select: { userId: true, displayName: true },
                });
                if (!agent) {
                    return textResult(
                        "**Error: NOT_FOUND**\nAgent not found.\n**Retryable:** false",
                    );
                }
                if (agent.userId !== userId) {
                    return textResult(
                        "**Error: PERMISSION_DENIED**\nYou do not own this agent.\n**Retryable:** false",
                    );
                }

                const messages = await prisma.agentMessage.findMany({
                    where: { agentId: agent_id, isRead: false },
                    select: { id: true, role: true, content: true, createdAt: true },
                    orderBy: { createdAt: "asc" },
                });
                if (messages.length === 0) {
                    return textResult(
                        `No unread messages for agent **${agent.displayName}**.`,
                    );
                }
                let text = `**Unread Messages for ${agent.displayName} (${messages.length}):**\n\n`;
                for (const msg of messages) {
                    text += `- **[${msg.role}]** ${msg.content.substring(0, 150)}${msg.content.length > 150 ? "..." : ""
                        }\n  ID: ${msg.id} | ${msg.createdAt.toISOString()}\n\n`;
                }
                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("agents_send_message", "Send a message to an agent.", {
                agent_id: z.string().min(1).describe("Agent ID to send message to."),
                content: z.string().min(1).max(10000).describe(
                    "Message content (max 10000 chars).",
                ),
            })
            .meta({ category: "agents", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { agent_id, content } = input;

                const prisma = (await import("@/lib/prisma")).default;
                // Verify ownership
                const agent = await prisma.claudeCodeAgent.findUnique({
                    where: { id: agent_id },
                    select: { userId: true, displayName: true },
                });
                if (!agent) {
                    return textResult(
                        "**Error: NOT_FOUND**\nAgent not found.\n**Retryable:** false",
                    );
                }
                if (agent.userId !== userId) {
                    return textResult(
                        "**Error: PERMISSION_DENIED**\nYou do not own this agent.\n**Retryable:** false",
                    );
                }

                const message = await prisma.agentMessage.create({
                    data: {
                        agentId: agent_id,
                        role: "USER",
                        content,
                        isRead: false,
                    },
                });
                return textResult(
                    `**Message Sent!**\n\n`
                    + `**ID:** ${message.id}\n`
                    + `**To:** ${agent.displayName}\n`
                    + `**Content:** ${content.substring(0, 100)}${content.length > 100 ? "..." : ""}`,
                );
            })
    );
}
