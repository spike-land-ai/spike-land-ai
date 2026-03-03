/**
 * Agent Management MCP Tools
 *
 * List, get details, check message queues, and send messages to agents.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const ListAgentsSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().describe(
    "Max results (default 20).",
  ),
});

const GetAgentSchema = z.object({
  agent_id: z.string().min(1).describe("Agent ID."),
});

const GetAgentQueueSchema = z.object({
  agent_id: z.string().min(1).describe("Agent ID to check queue for."),
});

const SendAgentMessageSchema = z.object({
  agent_id: z.string().min(1).describe("Agent ID to send message to."),
  content: z.string().min(1).max(10000).describe(
    "Message content (max 10000 chars).",
  ),
});

export function registerAgentManagementTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "agents_list",
    description: "List your connected agents with status and stats.",
    category: "agents",
    tier: "free",
    inputSchema: ListAgentsSchema.shape,
    handler: async (
      { limit = 20 }: z.infer<typeof ListAgentsSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("agents_list", async () => {
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
            `- **${a.displayName}** — ${a._count.messages} messages, ${a.totalTasksCompleted} tasks\n  Last seen: ${
              a.lastSeenAt?.toISOString() || "never"
            }\n  ID: ${a.id}\n\n`;
        }
        return textResult(text);
      }),
  });

  registry.register({
    name: "agents_get",
    description: "Get detailed information about a specific agent.",
    category: "agents",
    tier: "free",
    inputSchema: GetAgentSchema.shape,
    handler: async (
      { agent_id }: z.infer<typeof GetAgentSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("agents_get", async () => {
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
      }),
  });

  registry.register({
    name: "agents_get_queue",
    description: "Get unread messages queued for an agent.",
    category: "agents",
    tier: "free",
    inputSchema: GetAgentQueueSchema.shape,
    handler: async (
      { agent_id }: z.infer<typeof GetAgentQueueSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("agents_get_queue", async () => {
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
          text += `- **[${msg.role}]** ${msg.content.substring(0, 150)}${
            msg.content.length > 150 ? "..." : ""
          }\n  ID: ${msg.id} | ${msg.createdAt.toISOString()}\n\n`;
        }
        return textResult(text);
      }),
  });

  registry.register({
    name: "agents_send_message",
    description: "Send a message to an agent.",
    category: "agents",
    tier: "free",
    inputSchema: SendAgentMessageSchema.shape,
    handler: async (
      { agent_id, content }: z.infer<typeof SendAgentMessageSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("agents_send_message", async () => {
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
      }),
  });
}
