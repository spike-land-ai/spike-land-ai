/**
 * Agent Inbox MCP Tools
 *
 * Bidirectional chat bridge for external agents (e.g., Claude Code via MCP).
 * Allows an external agent to poll for messages, read full context, and respond.
 *
 * Runs on Cloudflare Workers with Drizzle ORM.
 * Uses agentMessages + claudeCodeAgents
 * tables and delegates app-specific operations to the spike.land API.
 */

import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, textResult } from "../procedures/index";
import { agentMessages, claudeCodeAgents } from "../db/schema";
import type { DrizzleDB } from "../db/index";

export function registerAgentInboxTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "agent_inbox_poll",
        "Poll for new messages across your agents. " +
          "Returns agents with message counts and latest message preview.",
        {
          since: z
            .string()
            .optional()
            .describe("ISO timestamp. Only return messages created after this time. Omit for all."),
          agent_id: z
            .string()
            .optional()
            .describe("Filter to a specific agent. Omit to poll all agents."),
        },
      )
      .meta({ category: "agent-inbox", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { since, agent_id } = input;

        // Get agents owned by this user
        const agentFilter = agent_id
          ? and(eq(claudeCodeAgents.id, agent_id), eq(claudeCodeAgents.userId, ctx.userId))
          : eq(claudeCodeAgents.userId, ctx.userId);

        const agents = await ctx.db
          .select({ id: claudeCodeAgents.id, name: claudeCodeAgents.name })
          .from(claudeCodeAgents)
          .where(agentFilter);

        if (agents.length === 0) {
          const serverTime = new Date().toISOString();
          return textResult(`**No agents found.**\n\nserverTime: ${serverTime}`);
        }

        // Fetch messages for each agent
        const agentMap = new Map<
          string,
          {
            agentId: string;
            agentName: string;
            messageCount: number;
            latestMessage: {
              id: string;
              content: string;
              role: string;
              createdAt: number;
            };
          }
        >();

        for (const agent of agents) {
          const sinceTs = since ? new Date(since).getTime() : 0;

          // Get recent messages for this agent
          const msgs = await ctx.db
            .select({
              id: agentMessages.id,
              content: agentMessages.content,
              role: agentMessages.role,
              createdAt: agentMessages.createdAt,
            })
            .from(agentMessages)
            .where(eq(agentMessages.agentId, agent.id))
            .orderBy(desc(agentMessages.createdAt))
            .limit(50);

          const filtered = sinceTs > 0 ? msgs.filter((m) => m.createdAt > sinceTs) : msgs;

          if (filtered.length > 0) {
            const latest = filtered[0]!;
            agentMap.set(agent.id, {
              agentId: agent.id,
              agentName: agent.name,
              messageCount: filtered.length,
              latestMessage: {
                id: latest.id,
                content: latest.content.slice(0, 200),
                role: latest.role,
                createdAt: latest.createdAt,
              },
            });
          }
        }

        const serverTime = new Date().toISOString();

        if (agentMap.size === 0) {
          return textResult(
            `**No messages found.**\n\nserverTime: ${serverTime}\n\nCall again to continue polling.`,
          );
        }

        let text = `**Messages (across ${agentMap.size} agent(s)):**\n\n`;
        for (const a of agentMap.values()) {
          text += `### ${a.agentName}\n`;
          text += `- **Agent ID:** ${a.agentId}\n`;
          text += `- **Messages:** ${a.messageCount}\n`;
          text += `- **Latest [${a.latestMessage.role}]:** ${a.latestMessage.content}${
            a.latestMessage.content.length >= 200 ? "..." : ""
          }\n`;
          text += `- **At:** ${new Date(a.latestMessage.createdAt).toISOString()}\n\n`;
        }
        text += `serverTime: ${serverTime}`;

        return textResult(text);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "agent_inbox_read",
        "Get full messages for an agent. Returns chronological messages with full content.",
        {
          agent_id: z.string().min(1).describe("Agent ID to read messages from."),
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .optional()
            .describe("Max messages to return. Default: 20."),
          since: z
            .string()
            .optional()
            .describe("ISO timestamp. Only return messages created after this time."),
        },
      )
      .meta({ category: "agent-inbox", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { agent_id, limit, since } = input;

        // Verify agent ownership
        const agentRows = await ctx.db
          .select({
            id: claudeCodeAgents.id,
            name: claudeCodeAgents.name,
            userId: claudeCodeAgents.userId,
          })
          .from(claudeCodeAgents)
          .where(eq(claudeCodeAgents.id, agent_id))
          .limit(1);

        const agent = agentRows[0];
        if (!agent || agent.userId !== ctx.userId) {
          return textResult(`**Error:** Agent not found or you don't own it (ID: ${agent_id}).`);
        }

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
          .limit(limit || 20);

        const sinceTs = since ? new Date(since).getTime() : 0;
        const filtered = sinceTs > 0 ? messages.filter((m) => m.createdAt > sinceTs) : messages;

        if (filtered.length === 0) {
          return textResult(`**No messages found** for agent "${agent.name}".`);
        }

        let text = `**Messages for "${agent.name}" (${filtered.length}):**\n\n`;
        for (const msg of filtered) {
          const role = msg.role === "user" ? "User" : msg.role === "assistant" ? "Agent" : "System";
          text += `**[${role}]** (${new Date(msg.createdAt).toISOString()}) ID: ${msg.id}\n`;
          text += `${msg.content}\n\n`;
        }

        return textResult(text);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "agent_inbox_respond",
        "Send an agent response. Creates an assistant message for the agent.",
        {
          agent_id: z.string().min(1).describe("Agent ID to respond to."),
          content: z.string().min(1).describe("The agent's response content."),
        },
      )
      .meta({ category: "agent-inbox", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { agent_id, content } = input;

        // Verify agent ownership
        const agentRows = await ctx.db
          .select({
            id: claudeCodeAgents.id,
            name: claudeCodeAgents.name,
            userId: claudeCodeAgents.userId,
          })
          .from(claudeCodeAgents)
          .where(eq(claudeCodeAgents.id, agent_id))
          .limit(1);

        const agent = agentRows[0];
        if (!agent || agent.userId !== ctx.userId) {
          return textResult(`**Error:** Agent not found or you don't own it (ID: ${agent_id}).`);
        }

        const id = crypto.randomUUID();
        await ctx.db.insert(agentMessages).values({
          id,
          agentId: agent_id,
          role: "assistant",
          content,
          createdAt: Date.now(),
        });

        return textResult(
          `**Response sent.**\n\n` + `**Message ID:** ${id}\n` + `**Agent:** ${agent.name}`,
        );
      }),
  );
}
