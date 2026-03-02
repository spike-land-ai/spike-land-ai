/**
 * Swarm Management MCP Tools (CF Workers)
 *
 * Tools for managing AI agents in the swarm: list, inspect, spawn, stop,
 * redirect, broadcast, send_message, read_messages, and delegate_task.
 *
 * Ported from Next.js/Prisma to Cloudflare Workers/Drizzle.
 * The D1 schema uses a simplified claudeCodeAgents table — fields like
 * deletedAt, trustScore, totalTokensUsed are stored in the metadata JSON.
 */

import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, textResult } from "../procedures/index";
import { claudeCodeAgents, agentMessages } from "../db/schema";
import type { DrizzleDB } from "../db/index";

export function registerSwarmTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
  const t = freeTool(userId, db);

  // swarm_list_agents
  registry.registerBuilt(
    t
      .tool("swarm_list_agents", "List all AI agents with their status, tasks, and session info.", {
        status: z
          .enum(["active", "idle", "stopped", "all"])
          .optional()
          .default("all")
          .describe("Filter by agent status."),
        limit: z.number().int().min(1).max(100).optional().default(20).describe("Max results."),
      })
      .meta({ category: "swarm", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { status = "all", limit = 20 } = input;

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

        const now = Date.now();
        const fiveMinAgo = now - 5 * 60 * 1000;

        const filtered =
          status === "all"
            ? agents
            : agents.filter((a) => {
                if (status === "active") {
                  return a.status === "running" || (a.lastActiveAt && a.lastActiveAt > fiveMinAgo);
                }
                if (status === "idle") return a.status === "idle";
                if (status === "stopped") return a.status === "stopped";
                return true;
              });

        if (filtered.length === 0) return textResult("No agents found.");

        let text = `**Swarm Agents (${filtered.length}):**\n\n`;
        for (const a of filtered) {
          const statusLabel = a.status.toUpperCase();
          const lastSeen = a.lastActiveAt ? new Date(a.lastActiveAt).toISOString() : "never";
          text +=
            `- **${a.name}** [${statusLabel}]\n` +
            `  Last seen: ${lastSeen}\n` +
            `  ID: ${a.id}\n\n`;
        }
        return textResult(text);
      }),
  );

  // swarm_get_agent
  registry.registerBuilt(
    t
      .tool(
        "swarm_get_agent",
        "Get detailed information about a specific agent including metadata.",
        {
          agent_id: z.string().min(1).describe("Agent ID."),
        },
      )
      .meta({ category: "swarm", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { agent_id } = input;

        const results = await ctx.db
          .select()
          .from(claudeCodeAgents)
          .where(eq(claudeCodeAgents.id, agent_id))
          .limit(1);

        const agent = results[0];
        if (!agent || agent.userId !== ctx.userId) {
          return textResult("Agent not found.");
        }

        const meta = JSON.parse(agent.metadata || "{}") as Record<string, unknown>;

        return textResult(
          `**Agent: ${agent.name}**\n\n` +
            `- ID: ${agent.id}\n` +
            `- Status: ${agent.status}\n` +
            `- Workspace: ${agent.workspaceId || "(none)"}\n` +
            `- Metadata: ${JSON.stringify(meta)}\n` +
            `- Last Active: ${agent.lastActiveAt ? new Date(agent.lastActiveAt).toISOString() : "never"}\n` +
            `- Created: ${new Date(agent.createdAt).toISOString()}`,
        );
      }),
  );

  // swarm_spawn_agent
  registry.registerBuilt(
    t
      .tool("swarm_spawn_agent", "Register a new agent in the swarm.", {
        display_name: z.string().min(1).max(100).describe("Agent display name."),
        machine_id: z.string().min(1).describe("Machine identifier."),
        session_id: z.string().min(1).describe("Session identifier."),
        project_path: z.string().optional().describe("Project path."),
      })
      .meta({ category: "swarm", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { display_name, machine_id, session_id, project_path } = input;

        const id = crypto.randomUUID();
        const now = Date.now();
        const metadata = JSON.stringify({
          machineId: machine_id,
          sessionId: session_id,
          projectPath: project_path ?? null,
        });

        await ctx.db.insert(claudeCodeAgents).values({
          id,
          userId: ctx.userId,
          name: display_name,
          status: "running",
          lastActiveAt: now,
          metadata,
          createdAt: now,
        });

        return textResult(`**Agent spawned!**\n\nID: ${id}\nName: ${display_name}`);
      }),
  );

  // swarm_stop_agent
  registry.registerBuilt(
    t
      .tool("swarm_stop_agent", "Stop an agent by marking it as stopped.", {
        agent_id: z.string().min(1).describe("Agent ID to stop."),
      })
      .meta({ category: "swarm", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { agent_id } = input;

        const results = await ctx.db
          .select({ userId: claudeCodeAgents.userId })
          .from(claudeCodeAgents)
          .where(eq(claudeCodeAgents.id, agent_id))
          .limit(1);

        if (!results[0] || results[0].userId !== ctx.userId) {
          return textResult("Agent not found.");
        }

        await ctx.db
          .update(claudeCodeAgents)
          .set({ status: "stopped" })
          .where(eq(claudeCodeAgents.id, agent_id));

        return textResult(`Agent ${agent_id} stopped.`);
      }),
  );

  // swarm_redirect_agent
  registry.registerBuilt(
    t
      .tool(
        "swarm_redirect_agent",
        "Redirect an agent to a different project or working directory by updating its metadata.",
        {
          agent_id: z.string().min(1).describe("Agent ID."),
          project_path: z.string().optional().describe("New project path."),
          working_directory: z.string().optional().describe("New working directory."),
        },
      )
      .meta({ category: "swarm", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { agent_id, project_path, working_directory } = input;

        const results = await ctx.db
          .select({ userId: claudeCodeAgents.userId, metadata: claudeCodeAgents.metadata })
          .from(claudeCodeAgents)
          .where(eq(claudeCodeAgents.id, agent_id))
          .limit(1);

        const agent = results[0];
        if (!agent || agent.userId !== ctx.userId) {
          return textResult("Agent not found.");
        }

        const meta = JSON.parse(agent.metadata || "{}") as Record<string, unknown>;
        if (project_path !== undefined) meta.projectPath = project_path;
        if (working_directory !== undefined) meta.workingDirectory = working_directory;

        await ctx.db
          .update(claudeCodeAgents)
          .set({ metadata: JSON.stringify(meta), lastActiveAt: Date.now() })
          .where(eq(claudeCodeAgents.id, agent_id));

        return textResult(`Agent ${agent_id} redirected.`);
      }),
  );

  // swarm_broadcast
  registry.registerBuilt(
    t
      .tool("swarm_broadcast", "Broadcast a message to all active agents.", {
        content: z.string().min(1).max(10000).describe("Message content."),
      })
      .meta({ category: "swarm", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { content } = input;

        const agents = await ctx.db
          .select({ id: claudeCodeAgents.id })
          .from(claudeCodeAgents)
          .where(eq(claudeCodeAgents.userId, ctx.userId));

        const activeAgents = agents.filter(Boolean);
        if (activeAgents.length === 0) {
          return textResult("No agents to broadcast to.");
        }

        const now = Date.now();
        for (const a of activeAgents) {
          await ctx.db.insert(agentMessages).values({
            id: crypto.randomUUID(),
            agentId: a.id,
            role: "user",
            content,
            createdAt: now,
          });
        }

        return textResult(`Broadcast sent to ${activeAgents.length} agents.`);
      }),
  );

  // swarm_send_message
  registry.registerBuilt(
    t
      .tool("swarm_send_message", "Send a direct message to a specific agent in the swarm.", {
        target_agent_id: z.string().min(1).describe("ID of the agent to send the message to."),
        content: z.string().min(1).max(10000).describe("Message content."),
        metadata: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Optional metadata (JSON object) attached to the message."),
      })
      .meta({ category: "swarm", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { target_agent_id, content, metadata } = input;

        const results = await ctx.db
          .select({ userId: claudeCodeAgents.userId, name: claudeCodeAgents.name })
          .from(claudeCodeAgents)
          .where(eq(claudeCodeAgents.id, target_agent_id))
          .limit(1);

        const target = results[0];
        if (!target || target.userId !== ctx.userId) {
          return textResult("Target agent not found.");
        }

        const msgContent = metadata
          ? `${content}\n\n---\nMetadata: ${JSON.stringify(metadata)}`
          : content;

        const msgId = crypto.randomUUID();
        await ctx.db.insert(agentMessages).values({
          id: msgId,
          agentId: target_agent_id,
          role: "user",
          content: msgContent,
          createdAt: Date.now(),
        });

        return textResult(
          `**Message sent to ${target.name}**\n\n` +
            `Message ID: ${msgId}\nTarget: ${target_agent_id}`,
        );
      }),
  );

  // swarm_read_messages
  registry.registerBuilt(
    t
      .tool("swarm_read_messages", "Read messages from an agent's inbox.", {
        agent_id: z.string().min(1).describe("ID of the agent whose inbox to read."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(20)
          .describe("Max messages to return."),
      })
      .meta({ category: "swarm", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { agent_id, limit = 20 } = input;

        // Verify ownership
        const agentRows = await ctx.db
          .select({ userId: claudeCodeAgents.userId })
          .from(claudeCodeAgents)
          .where(eq(claudeCodeAgents.id, agent_id))
          .limit(1);

        if (!agentRows[0] || agentRows[0].userId !== ctx.userId) {
          return textResult("Agent not found.");
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
          .orderBy(desc(agentMessages.createdAt))
          .limit(limit);

        if (messages.length === 0) return textResult("No messages found.");

        let text = `**Messages (${messages.length}):**\n\n`;
        for (const m of messages) {
          const preview = m.content.slice(0, 200);
          const ellipsis = m.content.length > 200 ? "..." : "";
          text +=
            `- **[${m.role}]** ${new Date(m.createdAt).toISOString()}\n` +
            `  ${preview}${ellipsis}\n` +
            `  ID: ${m.id}\n\n`;
        }
        return textResult(text);
      }),
  );

  // swarm_delegate_task
  registry.registerBuilt(
    t
      .tool(
        "swarm_delegate_task",
        "Delegate a task to another agent in the swarm. Creates a task message in the target agent's inbox with priority and context.",
        {
          target_agent_id: z.string().min(1).describe("ID of the agent to delegate the task to."),
          task_description: z
            .string()
            .min(1)
            .max(10000)
            .describe("Description of the task to delegate."),
          priority: z
            .enum(["low", "medium", "high", "critical"])
            .optional()
            .default("medium")
            .describe("Task priority level."),
          context: z
            .record(z.string(), z.unknown())
            .optional()
            .describe("Optional context data for the delegated task."),
        },
      )
      .meta({ category: "swarm", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { target_agent_id, task_description, priority = "medium", context } = input;

        const results = await ctx.db
          .select({ userId: claudeCodeAgents.userId, name: claudeCodeAgents.name })
          .from(claudeCodeAgents)
          .where(eq(claudeCodeAgents.id, target_agent_id))
          .limit(1);

        const target = results[0];
        if (!target || target.userId !== ctx.userId) {
          return textResult("Target agent not found.");
        }

        const taskContent = `[TASK:${priority.toUpperCase()}] ${task_description}`;
        const taskMetadata = {
          type: "delegation",
          priority,
          delegated_by: ctx.userId,
          delegated_at: new Date().toISOString(),
          ...(context ? { context } : {}),
        };

        const msgId = crypto.randomUUID();
        await ctx.db.insert(agentMessages).values({
          id: msgId,
          agentId: target_agent_id,
          role: "system",
          content: `${taskContent}\n\n---\nMetadata: ${JSON.stringify(taskMetadata)}`,
          createdAt: Date.now(),
        });

        return textResult(
          `**Task delegated to ${target.name}**\n\n` +
            `Priority: ${priority.toUpperCase()}\n` +
            `Message ID: ${msgId}\n` +
            `Task: ${task_description.slice(0, 200)}`,
        );
      }),
  );
}
