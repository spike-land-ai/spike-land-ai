/**
 * AI Orchestrator — Standalone Tool Definitions
 *
 * Swarm management (11 tools) + swarm monitoring (4 tools) = 15 tools.
 * Migrated from src/lib/mcp/server/tools/swarm.ts and swarm-monitoring.ts.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext, StandaloneToolDefinition } from "../shared/types";
import { safeToolCall, textResult } from "../shared/tool-helpers";

/* ── Schemas ────────────────────────────────────────────────────────── */

const ListAgentsSchema = z.object({
  status: z
    .enum(["active", "idle", "stopped", "all"])
    .optional()
    .default("all")
    .describe("Filter by agent status."),
  limit: z.number().int().min(1).max(100).optional().default(20).describe("Max results."),
});

const GetAgentSchema = z.object({
  agent_id: z.string().min(1).describe("Agent ID."),
});

const SpawnAgentSchema = z.object({
  display_name: z.string().min(1).max(100).describe("Agent display name."),
  machine_id: z.string().min(1).describe("Machine identifier."),
  session_id: z.string().min(1).describe("Session identifier."),
  project_path: z.string().optional().describe("Project path."),
});

const StopAgentSchema = z.object({
  agent_id: z.string().min(1).describe("Agent ID to stop."),
});

const RedirectAgentSchema = z.object({
  agent_id: z.string().min(1).describe("Agent ID."),
  project_path: z.string().optional().describe("New project path."),
  working_directory: z.string().optional().describe("New working directory."),
});

const BroadcastSchema = z.object({
  content: z.string().min(1).max(10000).describe("Message content."),
});

const AgentTimelineSchema = z.object({
  agent_id: z.string().min(1).describe("Agent ID."),
  limit: z.number().int().min(1).max(100).optional().default(20).describe("Max entries."),
});

const SendMessageSchema = z.object({
  target_agent_id: z.string().min(1).describe("ID of the agent to send the message to."),
  content: z.string().min(1).max(10000).describe("Message content."),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Optional metadata (JSON object) attached to the message."),
});

const ReadMessagesSchema = z.object({
  agent_id: z.string().min(1).describe("ID of the agent whose inbox to read."),
  unread_only: z
    .boolean()
    .optional()
    .default(true)
    .describe("Only return unread messages (default: true)."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("Max messages to return."),
  mark_as_read: z
    .boolean()
    .optional()
    .default(true)
    .describe("Mark returned messages as read (default: true)."),
});

const DelegateTaskSchema = z.object({
  target_agent_id: z.string().min(1).describe("ID of the agent to delegate the task to."),
  task_description: z.string().min(1).max(10000).describe("Description of the task to delegate."),
  priority: z
    .enum(["low", "medium", "high", "critical"])
    .optional()
    .default("medium")
    .describe("Task priority level."),
  context: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Optional context data for the delegated task."),
});

const GetMetricsSchema = z.object({
  period: z
    .enum(["1h", "24h", "7d", "30d"])
    .optional()
    .default("24h")
    .describe("Time period to aggregate metrics over."),
});

const GetCostSchema = z.object({
  agent_id: z
    .string()
    .optional()
    .describe("Filter cost breakdown by a specific agent ID. Omit for swarm-wide totals."),
});

const ReplaySchema = z.object({
  agent_id: z.string().min(1).describe("ID of the agent to replay."),
  from_step: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Start replaying from this step index (inclusive, 0-based)."),
  to_step: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Stop replaying at this step index (inclusive, 0-based)."),
});

/* ── Helpers ────────────────────────────────────────────────────────── */

async function requireAdminRole(userId: string): Promise<void> {
  const { requireAdminRole: platformRequireAdmin } = await import(
    "@/lib/mcp/server/tools/tool-helpers"
  );
  await platformRequireAdmin(userId);
}

function periodToMs(period: string): number {
  const map: Record<string, number> = {
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };
  return map[period] ?? map["24h"]!;
}

/* ── Tool Definitions ───────────────────────────────────────────────── */

export const aiOrchestratorTools: StandaloneToolDefinition[] = [
  // ── Swarm Management ──
  {
    name: "swarm_list_agents",
    description: "List all AI agents with their status, tasks, and session info.",
    category: "swarm",
    tier: "workspace",
    inputSchema: ListAgentsSchema.shape,
    handler: async (
      { status = "all", limit = 20 }: { status?: string; limit?: number },
      ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("swarm_list_agents", async () => {
        await requireAdminRole(ctx.userId);
        const prisma = (await import("@/lib/prisma")).default;
        const now = new Date();
        const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
        const agents = await prisma.claudeCodeAgent.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            displayName: true,
            lastSeenAt: true,
            totalTokensUsed: true,
            totalTasksCompleted: true,
            machineId: true,
            projectPath: true,
            _count: { select: { messages: true } },
          },
          take: limit,
          orderBy: { lastSeenAt: "desc" },
        });
        const filtered =
          status === "all"
            ? agents
            : agents.filter((a) => {
                const isActive = a.lastSeenAt && a.lastSeenAt > fiveMinAgo;
                if (status === "active") return isActive;
                if (status === "idle") return a.lastSeenAt && !isActive;
                if (status === "stopped") return !a.lastSeenAt;
                return true;
              });
        if (filtered.length === 0) return textResult("No agents found.");
        let text = `**Swarm Agents (${filtered.length}):**\n\n`;
        for (const a of filtered) {
          const isActive = a.lastSeenAt && a.lastSeenAt > fiveMinAgo;
          const statusLabel = isActive ? "ACTIVE" : a.lastSeenAt ? "IDLE" : "STOPPED";
          text += `- **${a.displayName}** [${statusLabel}]\n  Tasks: ${a.totalTasksCompleted} | Tokens: ${a.totalTokensUsed} | Messages: ${a._count.messages}\n  ID: ${a.id}\n\n`;
        }
        return textResult(text);
      }),
  },
  {
    name: "swarm_get_agent",
    description:
      "Get detailed information about a specific agent including messages and audit log.",
    category: "swarm",
    tier: "workspace",
    inputSchema: GetAgentSchema.shape,
    handler: async (
      { agent_id }: { agent_id: string },
      ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("swarm_get_agent", async () => {
        await requireAdminRole(ctx.userId);
        const prisma = (await import("@/lib/prisma")).default;
        const agent = await prisma.claudeCodeAgent.findUnique({
          where: { id: agent_id },
          include: { _count: { select: { messages: true } } },
        });
        if (!agent || agent.deletedAt) return textResult("Agent not found.");
        return textResult(
          `**Agent: ${agent.displayName}**\n\n` +
            `- ID: ${agent.id}\n- Machine: ${agent.machineId}\n- Session: ${agent.sessionId}\n` +
            `- Project: ${agent.projectPath || "(none)"}\n- Working Dir: ${
              agent.workingDirectory || "(none)"
            }\n` +
            `- Messages: ${agent._count.messages}\n- Tokens: ${agent.totalTokensUsed}\n` +
            `- Tasks: ${agent.totalTasksCompleted}\n- Session Time: ${agent.totalSessionTime}s\n` +
            `- Last Seen: ${
              agent.lastSeenAt?.toISOString() || "never"
            }\n- Created: ${agent.createdAt.toISOString()}`,
        );
      }),
  },
  {
    name: "swarm_spawn_agent",
    description: "Register a new agent in the swarm.",
    category: "swarm",
    tier: "workspace",
    inputSchema: SpawnAgentSchema.shape,
    handler: async (
      {
        display_name,
        machine_id,
        session_id,
        project_path,
      }: {
        display_name: string;
        machine_id: string;
        session_id: string;
        project_path?: string;
      },
      ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("swarm_spawn_agent", async () => {
        await requireAdminRole(ctx.userId);
        const prisma = (await import("@/lib/prisma")).default;
        const agent = await prisma.claudeCodeAgent.create({
          data: {
            id: session_id,
            userId: ctx.userId,
            machineId: machine_id,
            sessionId: session_id,
            displayName: display_name,
            ...(project_path !== undefined ? { projectPath: project_path } : {}),
            lastSeenAt: new Date(),
          },
        });
        return textResult(`**Agent spawned!**\n\nID: ${agent.id}\nName: ${agent.displayName}`);
      }),
  },
  {
    name: "swarm_stop_agent",
    description: "Stop an agent by soft-deleting it.",
    category: "swarm",
    tier: "workspace",
    inputSchema: StopAgentSchema.shape,
    handler: async (
      { agent_id }: { agent_id: string },
      ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("swarm_stop_agent", async () => {
        await requireAdminRole(ctx.userId);
        const prisma = (await import("@/lib/prisma")).default;
        await prisma.claudeCodeAgent.update({
          where: { id: agent_id },
          data: { deletedAt: new Date() },
        });
        return textResult(`Agent ${agent_id} stopped.`);
      }),
  },
  {
    name: "swarm_redirect_agent",
    description: "Redirect an agent to a different project or working directory.",
    category: "swarm",
    tier: "workspace",
    inputSchema: RedirectAgentSchema.shape,
    handler: async (
      {
        agent_id,
        project_path,
        working_directory,
      }: {
        agent_id: string;
        project_path?: string;
        working_directory?: string;
      },
      ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("swarm_redirect_agent", async () => {
        await requireAdminRole(ctx.userId);
        const prisma = (await import("@/lib/prisma")).default;
        const data: Record<string, string> = {};
        if (project_path !== undefined) data.projectPath = project_path;
        if (working_directory !== undefined) data.workingDirectory = working_directory;
        await prisma.claudeCodeAgent.update({ where: { id: agent_id }, data });
        return textResult(`Agent ${agent_id} redirected.`);
      }),
  },
  {
    name: "swarm_broadcast",
    description: "Broadcast a message to all active agents.",
    category: "swarm",
    tier: "workspace",
    inputSchema: BroadcastSchema.shape,
    handler: async (
      { content }: { content: string },
      ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("swarm_broadcast", async () => {
        await requireAdminRole(ctx.userId);
        const prisma = (await import("@/lib/prisma")).default;
        const agents = await prisma.claudeCodeAgent.findMany({
          where: { deletedAt: null },
          select: { id: true },
        });
        const messages = agents.map((a) => ({
          agentId: a.id,
          role: "USER" as const,
          content,
          isRead: false,
        }));
        const result = await prisma.agentMessage.createMany({ data: messages });
        return textResult(`Broadcast sent to ${result.count} agents.`);
      }),
  },
  {
    name: "swarm_agent_timeline",
    description: "Get an agent's activity timeline from the audit log.",
    category: "swarm",
    tier: "workspace",
    inputSchema: AgentTimelineSchema.shape,
    handler: async (
      { agent_id, limit = 20 }: { agent_id: string; limit?: number },
      ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("swarm_agent_timeline", async () => {
        await requireAdminRole(ctx.userId);
        const prisma = (await import("@/lib/prisma")).default;
        const logs = await prisma.agentAuditLog.findMany({
          where: { agentId: agent_id },
          select: {
            action: true,
            actionType: true,
            createdAt: true,
            durationMs: true,
            isError: true,
          },
          take: limit,
          orderBy: { createdAt: "desc" },
        });
        if (logs.length === 0) return textResult("No timeline entries found.");
        let text = `**Agent Timeline (${logs.length}):**\n\n`;
        for (const log of logs) {
          text += `- **${log.action}** [${log.actionType}] ${
            log.isError ? "[ERROR]" : ""
          }\n  Duration: ${log.durationMs}ms | ${log.createdAt.toISOString()}\n\n`;
        }
        return textResult(text);
      }),
  },
  {
    name: "swarm_topology",
    description: "Get the swarm topology showing agent relationships and trust scores.",
    category: "swarm",
    tier: "workspace",
    inputSchema: {},
    handler: async (_input: never, ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("swarm_topology", async () => {
        await requireAdminRole(ctx.userId);
        const prisma = (await import("@/lib/prisma")).default;
        const agents = await prisma.claudeCodeAgent.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            displayName: true,
            lastSeenAt: true,
            trustScore: { select: { trustLevel: true, totalSuccessful: true, totalFailed: true } },
          },
        });
        if (agents.length === 0) return textResult("No agents in the swarm.");
        let text = `**Swarm Topology (${agents.length} agents):**\n\n`;
        for (const a of agents) {
          const trust = a.trustScore;
          text += `- **${a.displayName}** — Trust: ${trust?.trustLevel || "SANDBOX"} (${
            trust?.totalSuccessful || 0
          } ok / ${trust?.totalFailed || 0} fail)\n  ID: ${a.id}\n\n`;
        }
        return textResult(text);
      }),
  },
  {
    name: "swarm_send_message",
    description: "Send a direct message to a specific agent in the swarm.",
    category: "swarm",
    tier: "workspace",
    inputSchema: SendMessageSchema.shape,
    handler: async (
      {
        target_agent_id,
        content,
        metadata,
      }: {
        target_agent_id: string;
        content: string;
        metadata?: Record<string, unknown>;
      },
      ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("swarm_send_message", async () => {
        await requireAdminRole(ctx.userId);
        const prisma = (await import("@/lib/prisma")).default;
        const { McpError, McpErrorCode } = await import("@/lib/mcp/errors");
        const target = await prisma.claudeCodeAgent.findUnique({
          where: { id: target_agent_id },
          select: { id: true, displayName: true, deletedAt: true },
        });
        if (!target || target.deletedAt) {
          throw new McpError(
            "Target agent not found or has been stopped.",
            McpErrorCode.WORKSPACE_NOT_FOUND,
            false,
          );
        }
        const msg = await prisma.agentMessage.create({
          data: {
            agentId: target_agent_id,
            role: "AGENT",
            content,
            isRead: false,
            ...(metadata != null
              ? { metadata: metadata as import("@/generated/prisma").Prisma.InputJsonValue }
              : {}),
          },
        });
        return textResult(
          `**Message sent to ${target.displayName}**\n\nMessage ID: ${msg.id}\nTarget: ${target_agent_id}`,
        );
      }),
  },
  {
    name: "swarm_read_messages",
    description:
      "Read messages from an agent's inbox. Can filter by unread only and optionally mark them as read.",
    category: "swarm",
    tier: "workspace",
    inputSchema: ReadMessagesSchema.shape,
    handler: async (
      {
        agent_id,
        unread_only = true,
        limit = 20,
        mark_as_read = true,
      }: {
        agent_id: string;
        unread_only?: boolean;
        limit?: number;
        mark_as_read?: boolean;
      },
      ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("swarm_read_messages", async () => {
        await requireAdminRole(ctx.userId);
        const prisma = (await import("@/lib/prisma")).default;
        const where: { agentId: string; isRead?: boolean } = { agentId: agent_id };
        if (unread_only) where.isRead = false;
        const messages = await prisma.agentMessage.findMany({
          where,
          select: {
            id: true,
            role: true,
            content: true,
            isRead: true,
            metadata: true,
            createdAt: true,
          },
          take: limit,
          orderBy: { createdAt: "desc" },
        });
        if (messages.length === 0) return textResult("No messages found.");
        if (mark_as_read && messages.length > 0) {
          const ids = messages.filter((m) => !m.isRead).map((m) => m.id);
          if (ids.length > 0) {
            await prisma.agentMessage.updateMany({
              where: { id: { in: ids } },
              data: { isRead: true },
            });
          }
        }
        let text = `**Messages (${messages.length}):**\n\n`;
        for (const m of messages) {
          const readLabel = m.isRead ? "READ" : "UNREAD";
          text += `- **[${m.role}]** [${readLabel}] ${m.createdAt.toISOString()}\n  ${m.content.slice(
            0,
            200,
          )}${m.content.length > 200 ? "..." : ""}\n  ID: ${m.id}\n\n`;
        }
        return textResult(text);
      }),
  },
  {
    name: "swarm_delegate_task",
    description: "Delegate a task to another agent in the swarm with priority and context.",
    category: "swarm",
    tier: "workspace",
    inputSchema: DelegateTaskSchema.shape,
    handler: async (
      {
        target_agent_id,
        task_description,
        priority = "medium",
        context,
      }: {
        target_agent_id: string;
        task_description: string;
        priority?: string;
        context?: Record<string, unknown>;
      },
      ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("swarm_delegate_task", async () => {
        await requireAdminRole(ctx.userId);
        const prisma = (await import("@/lib/prisma")).default;
        const { McpError, McpErrorCode } = await import("@/lib/mcp/errors");
        const target = await prisma.claudeCodeAgent.findUnique({
          where: { id: target_agent_id },
          select: { id: true, displayName: true, deletedAt: true },
        });
        if (!target || target.deletedAt) {
          throw new McpError(
            "Target agent not found or has been stopped.",
            McpErrorCode.WORKSPACE_NOT_FOUND,
            false,
          );
        }
        const taskContent = `[TASK:${priority.toUpperCase()}] ${task_description}`;
        const taskMetadata = {
          type: "delegation",
          priority,
          delegated_by: ctx.userId,
          delegated_at: new Date().toISOString(),
          ...(context ? { context } : {}),
        };
        const msg = await prisma.agentMessage.create({
          data: {
            agentId: target_agent_id,
            role: "SYSTEM",
            content: taskContent,
            isRead: false,
            metadata: taskMetadata as import("@/generated/prisma").Prisma.InputJsonValue,
          },
        });
        return textResult(
          `**Task delegated to ${target.displayName}**\n\nPriority: ${priority.toUpperCase()}\nMessage ID: ${msg.id}\nTask: ${task_description.slice(
            0,
            200,
          )}`,
        );
      }),
  },

  // ── Swarm Monitoring ──
  {
    name: "swarm_get_metrics",
    description:
      "Get swarm performance metrics: agents spawned, tasks completed, average task duration, success rate, and resource usage.",
    category: "swarm-monitoring",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: GetMetricsSchema.shape,
    handler: async (
      { period = "24h" }: { period?: string },
      ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("swarm_get_metrics", async () => {
        await requireAdminRole(ctx.userId);
        const prisma = (await import("@/lib/prisma")).default;
        const since = new Date(Date.now() - periodToMs(period));
        const [agents, logs] = await Promise.all([
          prisma.claudeCodeAgent.findMany({
            where: { deletedAt: null },
            select: {
              id: true,
              totalTasksCompleted: true,
              totalTokensUsed: true,
              totalSessionTime: true,
              createdAt: true,
            },
          }),
          prisma.agentAuditLog.findMany({
            where: { createdAt: { gte: since } },
            select: { durationMs: true, isError: true, createdAt: true },
          }),
        ]);
        const agentsSpawned = agents.filter((a) => a.createdAt >= since).length;
        const totalTasksCompleted = agents.reduce((s, a) => s + a.totalTasksCompleted, 0);
        const totalTokensUsed = agents.reduce((s, a) => s + a.totalTokensUsed, 0);
        const totalSessionTimeSeconds = agents.reduce((s, a) => s + a.totalSessionTime, 0);
        const completedLogs = logs.filter((l) => !l.isError);
        const errorLogs = logs.filter((l) => l.isError);
        const avgDurationMs =
          completedLogs.length > 0
            ? Math.round(
                completedLogs.reduce((s, l) => s + (l.durationMs ?? 0), 0) / completedLogs.length,
              )
            : 0;
        const successRate =
          logs.length > 0 ? Math.round((completedLogs.length / logs.length) * 100) : 100;
        return textResult(
          `**Swarm Metrics (${period})**\n\n` +
            `- Agents spawned: ${agentsSpawned}\n- Active agents: ${agents.length}\n` +
            `- Tasks completed: ${totalTasksCompleted}\n` +
            `- Audit log entries: ${logs.length} (${completedLogs.length} ok / ${errorLogs.length} errors)\n` +
            `- Avg task duration: ${avgDurationMs}ms\n- Success rate: ${successRate}%\n` +
            `- Total tokens used: ${totalTokensUsed}\n- Total session time: ${totalSessionTimeSeconds}s`,
        );
      }),
  },
  {
    name: "swarm_get_cost",
    description: "Get token usage and cost breakdown for the swarm.",
    category: "swarm-monitoring",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: GetCostSchema.shape,
    handler: async (
      { agent_id }: { agent_id?: string },
      ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("swarm_get_cost", async () => {
        await requireAdminRole(ctx.userId);
        const prisma = (await import("@/lib/prisma")).default;
        const agents = await prisma.claudeCodeAgent.findMany({
          where: agent_id ? { id: agent_id, deletedAt: null } : { deletedAt: null },
          select: { id: true, displayName: true, totalTokensUsed: true, totalTasksCompleted: true },
          orderBy: { totalTokensUsed: "desc" },
        });
        if (agents.length === 0) {
          return textResult(agent_id ? `Agent ${agent_id} not found.` : "No agents found.");
        }
        const TOKEN_COST_USD = 0.000003;
        const totalTokens = agents.reduce((s, a) => s + a.totalTokensUsed, 0);
        const totalCostUsd = (totalTokens * TOKEN_COST_USD).toFixed(4);
        let text = `**Swarm Token Cost${agent_id ? ` (agent: ${agent_id})` : ""}**\n\n`;
        text += `- Total tokens: ${totalTokens.toLocaleString()}\n- Estimated cost: $${totalCostUsd}\n\n**Breakdown by agent:**\n\n`;
        for (const a of agents) {
          const agentCost = (a.totalTokensUsed * TOKEN_COST_USD).toFixed(4);
          const tasksLabel =
            a.totalTasksCompleted > 0
              ? `${(a.totalTokensUsed / a.totalTasksCompleted).toFixed(0)} tokens/task`
              : "no tasks";
          text += `- **${a.displayName}** — ${a.totalTokensUsed.toLocaleString()} tokens ($${agentCost}) | ${tasksLabel}\n  ID: ${a.id}\n`;
        }
        return textResult(text);
      }),
  },
  {
    name: "swarm_replay",
    description: "Replay an agent's execution history step-by-step.",
    category: "swarm-monitoring",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: ReplaySchema.shape,
    handler: async (
      { agent_id, from_step, to_step }: { agent_id: string; from_step?: number; to_step?: number },
      ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("swarm_replay", async () => {
        await requireAdminRole(ctx.userId);
        const prisma = (await import("@/lib/prisma")).default;
        const agent = await prisma.claudeCodeAgent.findUnique({
          where: { id: agent_id },
          select: { id: true, displayName: true, deletedAt: true },
        });
        if (!agent) return textResult(`Agent ${agent_id} not found.`);
        const allLogs = await prisma.agentAuditLog.findMany({
          where: { agentId: agent_id },
          select: {
            action: true,
            actionType: true,
            createdAt: true,
            durationMs: true,
            isError: true,
            input: true,
          },
          orderBy: { createdAt: "asc" },
        });
        if (allLogs.length === 0) {
          return textResult(`No execution history found for agent ${agent_id}.`);
        }
        const startIdx = from_step ?? 0;
        const endIdx = to_step !== undefined ? to_step + 1 : allLogs.length;
        const slicedLogs = allLogs.slice(startIdx, endIdx);
        if (slicedLogs.length === 0) {
          return textResult(
            `No steps in range [${startIdx}, ${
              to_step ?? allLogs.length - 1
            }] for agent ${agent_id}.`,
          );
        }
        let text = `**Replay: ${agent.displayName}** (steps ${startIdx}–${
          startIdx + slicedLogs.length - 1
        } of ${allLogs.length} total)\n\n`;
        slicedLogs.forEach((log, i) => {
          const stepNum = startIdx + i;
          const errorMarker = log.isError ? " [ERROR]" : "";
          text += `**Step ${stepNum}**${errorMarker}\n  Action: ${log.action}\n  Type: ${log.actionType}\n  Time: ${log.createdAt.toISOString()}\n  Duration: ${
            log.durationMs ?? 0
          }ms\n`;
          if (log.input) {
            const metaStr = JSON.stringify(log.input);
            text += `  Input: ${metaStr.slice(0, 120)}${metaStr.length > 120 ? "..." : ""}\n`;
          }
          text += "\n";
        });
        return textResult(text);
      }),
  },
  {
    name: "swarm_health",
    description:
      "Get health status of all active agents: alive/stuck/errored state, last activity, memory/token usage.",
    category: "swarm-monitoring",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {},
    handler: async (_input: never, ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("swarm_health", async () => {
        await requireAdminRole(ctx.userId);
        const prisma = (await import("@/lib/prisma")).default;
        const now = new Date();
        const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
        const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
        const agents = await prisma.claudeCodeAgent.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            displayName: true,
            lastSeenAt: true,
            totalTokensUsed: true,
            totalTasksCompleted: true,
            projectPath: true,
            _count: { select: { messages: true } },
          },
          orderBy: { lastSeenAt: "desc" },
        });
        if (agents.length === 0) return textResult("No active agents.");
        let aliveCount = 0,
          stuckCount = 0,
          erroredCount = 0;
        let text = `**Swarm Health (${agents.length} agents)**\n\n`;
        for (const a of agents) {
          let health: string;
          if (!a.lastSeenAt) {
            health = "ERRORED";
            erroredCount++;
          } else if (a.lastSeenAt >= fiveMinAgo) {
            health = "ALIVE";
            aliveCount++;
          } else if (a.lastSeenAt >= thirtyMinAgo) {
            health = "STUCK";
            stuckCount++;
          } else {
            health = "ERRORED";
            erroredCount++;
          }
          text += `- **${a.displayName}** [${health}]\n  Last activity: ${
            a.lastSeenAt ? a.lastSeenAt.toISOString() : "never"
          }\n  ${
            a.projectPath ? `Working on: ${a.projectPath}` : "No active task"
          }\n  Memory: ${a.totalTokensUsed.toLocaleString()} tokens used | Tasks: ${a.totalTasksCompleted} | Inbox: ${a._count.messages}\n  ID: ${a.id}\n\n`;
        }
        text += `**Summary:** ${aliveCount} alive, ${stuckCount} stuck, ${erroredCount} errored`;
        return textResult(text);
      }),
  },
];
