/**
 * Agent Management MCP Tools
 *
 * List, get details, check message queues, and send messages to agents.
 * Runs on Cloudflare Workers with Drizzle ORM.
 */

import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, textResult } from "../procedures/index";
import { agentMessages, claudeCodeAgents } from "../db/schema";
import type { DrizzleDB } from "../db/index";

export function registerAgentManagementTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool("agents_list", "List your connected agents with status and stats.", {
        limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
      })
      .meta({ category: "agents", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { limit = 20 } = input;
        const agents = await ctx.db
          .select({
            id: claudeCodeAgents.id,
            name: claudeCodeAgents.name,
            status: claudeCodeAgents.status,
            lastActiveAt: claudeCodeAgents.lastActiveAt,
            metadata: claudeCodeAgents.metadata,
            createdAt: claudeCodeAgents.createdAt,
          })
          .from(claudeCodeAgents)
          .where(eq(claudeCodeAgents.userId, ctx.userId))
          .orderBy(desc(claudeCodeAgents.lastActiveAt))
          .limit(limit);

        if (agents.length === 0) return textResult("No agents found.");

        let text = `**Agents (${agents.length}):**\n\n`;
        for (const a of agents) {
          const lastSeen = a.lastActiveAt ? new Date(a.lastActiveAt).toISOString() : "never";
          text +=
            `- **${a.name}** [${a.status}]\n` + `  Last seen: ${lastSeen}\n` + `  ID: ${a.id}\n\n`;
        }
        return textResult(text);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("agents_get", "Get detailed information about a specific agent.", {
        agent_id: z.string().min(1).describe("Agent ID."),
      })
      .meta({ category: "agents", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { agent_id } = input;
        const results = await ctx.db
          .select()
          .from(claudeCodeAgents)
          .where(eq(claudeCodeAgents.id, agent_id))
          .limit(1);

        const agent = results[0];
        if (!agent || agent.userId !== ctx.userId) {
          return textResult("**Error: NOT_FOUND**\nAgent not found.\n**Retryable:** false");
        }

        const meta = JSON.parse(agent.metadata ?? "{}") as Record<string, unknown>;
        return textResult(
          `**Agent**\n\n` +
            `**ID:** ${agent.id}\n` +
            `**Name:** ${agent.name}\n` +
            `**Status:** ${agent.status}\n` +
            `**Workspace:** ${agent.workspaceId || "(none)"}\n` +
            `**Metadata:** ${JSON.stringify(meta)}\n` +
            `**Last Active:** ${
              agent.lastActiveAt ? new Date(agent.lastActiveAt).toISOString() : "never"
            }\n` +
            `**Created:** ${new Date(agent.createdAt).toISOString()}`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("agents_get_queue", "Get unread messages queued for an agent.", {
        agent_id: z.string().min(1).describe("Agent ID to check queue for."),
      })
      .meta({ category: "agents", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { agent_id } = input;

        // Verify ownership
        const agentRows = await ctx.db
          .select({
            userId: claudeCodeAgents.userId,
            name: claudeCodeAgents.name,
          })
          .from(claudeCodeAgents)
          .where(eq(claudeCodeAgents.id, agent_id))
          .limit(1);

        const agent = agentRows[0];
        if (!agent) {
          return textResult("**Error: NOT_FOUND**\nAgent not found.\n**Retryable:** false");
        }
        if (agent.userId !== ctx.userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nYou do not own this agent.\n**Retryable:** false",
          );
        }

        // The D1 schema doesn't have an isRead column on agentMessages,
        // so we return the most recent messages instead.
        const messages = await ctx.db
          .select({
            id: agentMessages.id,
            role: agentMessages.role,
            content: agentMessages.content,
            createdAt: agentMessages.createdAt,
          })
          .from(agentMessages)
          .where(eq(agentMessages.agentId, agent_id))
          .orderBy(asc(agentMessages.createdAt))
          .limit(50);

        if (messages.length === 0) {
          return textResult(`No messages for agent **${agent.name}**.`);
        }

        let text = `**Messages for ${agent.name} (${messages.length}):**\n\n`;
        for (const msg of messages) {
          const preview = msg.content.substring(0, 150);
          const ellipsis = msg.content.length > 150 ? "..." : "";
          text +=
            `- **[${msg.role}]** ${preview}${ellipsis}\n` +
            `  ID: ${msg.id} | ${new Date(msg.createdAt).toISOString()}\n\n`;
        }
        return textResult(text);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("agents_send_message", "Send a message to an agent.", {
        agent_id: z.string().min(1).describe("Agent ID to send message to."),
        content: z.string().min(1).max(10000).describe("Message content (max 10000 chars)."),
      })
      .meta({ category: "agents", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { agent_id, content } = input;

        // Verify ownership
        const agentRows = await ctx.db
          .select({
            userId: claudeCodeAgents.userId,
            name: claudeCodeAgents.name,
          })
          .from(claudeCodeAgents)
          .where(eq(claudeCodeAgents.id, agent_id))
          .limit(1);

        const agent = agentRows[0];
        if (!agent) {
          return textResult("**Error: NOT_FOUND**\nAgent not found.\n**Retryable:** false");
        }
        if (agent.userId !== ctx.userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nYou do not own this agent.\n**Retryable:** false",
          );
        }

        const id = crypto.randomUUID();
        await ctx.db.insert(agentMessages).values({
          id,
          agentId: agent_id,
          role: "user",
          content,
          createdAt: Date.now(),
        });

        const preview = content.substring(0, 100);
        const ellipsis = content.length > 100 ? "..." : "";
        return textResult(
          `**Message Sent!**\n\n` +
            `**ID:** ${id}\n` +
            `**To:** ${agent.name}\n` +
            `**Content:** ${preview}${ellipsis}`,
        );
      }),
  );
}
