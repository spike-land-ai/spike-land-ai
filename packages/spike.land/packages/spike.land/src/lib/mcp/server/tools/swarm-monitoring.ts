/**
 * Swarm Monitoring MCP Tools
 *
 * Tools for monitoring AI agent swarm performance, costs, execution
 * history, and health status.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { requireAdminRole, safeToolCall, textResult } from "./tool-helpers";

const GetMetricsSchema = z.object({
  period: z.enum(["1h", "24h", "7d", "30d"]).optional().default("24h")
    .describe("Time period to aggregate metrics over."),
});

const GetCostSchema = z.object({
  agent_id: z.string().optional().describe(
    "Filter cost breakdown by a specific agent ID. Omit for swarm-wide totals.",
  ),
});

const ReplaySchema = z.object({
  agent_id: z.string().min(1).describe("ID of the agent to replay."),
  from_step: z.number().int().min(0).optional().describe(
    "Start replaying from this step index (inclusive, 0-based).",
  ),
  to_step: z.number().int().min(0).optional().describe(
    "Stop replaying at this step index (inclusive, 0-based).",
  ),
});

function periodToMs(period: string): number {
  const map: Record<string, number> = {
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };
  return map[period] ?? map["24h"]!;
}

export function registerSwarmMonitoringTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "swarm_get_metrics",
    description:
      "Get swarm performance metrics: agents spawned, tasks completed, average task duration, success rate, and resource usage for a given time period.",
    category: "swarm-monitoring",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: GetMetricsSchema.shape,
    handler: async (
      { period = "24h" }: z.infer<typeof GetMetricsSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("swarm_get_metrics", async () => {
        await requireAdminRole(userId);
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
            select: {
              durationMs: true,
              isError: true,
              createdAt: true,
            },
          }),
        ]);

        const agentsSpawned = agents.filter(a => a.createdAt >= since).length;
        const totalTasksCompleted = agents.reduce(
          (sum, a) => sum + a.totalTasksCompleted,
          0,
        );
        const totalTokensUsed = agents.reduce(
          (sum, a) => sum + a.totalTokensUsed,
          0,
        );
        const totalSessionTimeSeconds = agents.reduce(
          (sum, a) => sum + a.totalSessionTime,
          0,
        );

        const completedLogs = logs.filter(l => !l.isError);
        const errorLogs = logs.filter(l => l.isError);
        const avgDurationMs = completedLogs.length > 0
          ? Math.round(
            completedLogs.reduce((sum, l) => sum + (l.durationMs ?? 0), 0)
              / completedLogs.length,
          )
          : 0;
        const successRate = logs.length > 0
          ? Math.round((completedLogs.length / logs.length) * 100)
          : 100;

        const text = `**Swarm Metrics (${period})**\n\n`
          + `- Agents spawned: ${agentsSpawned}\n`
          + `- Active agents: ${agents.length}\n`
          + `- Tasks completed: ${totalTasksCompleted}\n`
          + `- Audit log entries: ${logs.length} (${completedLogs.length} ok / ${errorLogs.length} errors)\n`
          + `- Avg task duration: ${avgDurationMs}ms\n`
          + `- Success rate: ${successRate}%\n`
          + `- Total tokens used: ${totalTokensUsed}\n`
          + `- Total session time: ${totalSessionTimeSeconds}s`;
        return textResult(text);
      }),
  });

  registry.register({
    name: "swarm_get_cost",
    description:
      "Get token usage and cost breakdown for the swarm. Filter by agent_id for per-agent breakdown, or omit for swarm-wide totals.",
    category: "swarm-monitoring",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: GetCostSchema.shape,
    handler: async (
      { agent_id }: z.infer<typeof GetCostSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("swarm_get_cost", async () => {
        await requireAdminRole(userId);
        const prisma = (await import("@/lib/prisma")).default;

        const agents = await prisma.claudeCodeAgent.findMany({
          where: agent_id
            ? { id: agent_id, deletedAt: null }
            : { deletedAt: null },
          select: {
            id: true,
            displayName: true,
            totalTokensUsed: true,
            totalTasksCompleted: true,
          },
          orderBy: { totalTokensUsed: "desc" },
        });

        if (agents.length === 0) {
          return textResult(
            agent_id ? `Agent ${agent_id} not found.` : "No agents found.",
          );
        }

        // Rough cost estimate: $0.000003 per token (approximate blended rate)
        const TOKEN_COST_USD = 0.000003;
        const totalTokens = agents.reduce(
          (sum, a) => sum + a.totalTokensUsed,
          0,
        );
        const totalCostUsd = (totalTokens * TOKEN_COST_USD).toFixed(4);

        let text = `**Swarm Token Cost${agent_id ? ` (agent: ${agent_id})` : ""}**\n\n`;
        text += `- Total tokens: ${totalTokens.toLocaleString()}\n`;
        text += `- Estimated cost: $${totalCostUsd}\n\n`;
        text += `**Breakdown by agent:**\n\n`;

        for (const a of agents) {
          const agentCost = (a.totalTokensUsed * TOKEN_COST_USD).toFixed(4);
          const tasksLabel = a.totalTasksCompleted > 0
            ? `${(a.totalTokensUsed / a.totalTasksCompleted).toFixed(0)} tokens/task`
            : "no tasks";
          text +=
            `- **${a.displayName}** — ${a.totalTokensUsed.toLocaleString()} tokens ($${agentCost}) | ${tasksLabel}\n`;
          text += `  ID: ${a.id}\n`;
        }

        return textResult(text);
      }),
  });

  registry.register({
    name: "swarm_replay",
    description:
      "Replay an agent's execution history step-by-step. Returns timestamped tool calls and results with optional step range filtering.",
    category: "swarm-monitoring",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: ReplaySchema.shape,
    handler: async (
      { agent_id, from_step, to_step }: z.infer<typeof ReplaySchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("swarm_replay", async () => {
        await requireAdminRole(userId);
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
          text += `**Step ${stepNum}**${errorMarker}\n`;
          text += `  Action: ${log.action}\n`;
          text += `  Type: ${log.actionType}\n`;
          text += `  Time: ${log.createdAt.toISOString()}\n`;
          text += `  Duration: ${log.durationMs ?? 0}ms\n`;
          if (log.input) {
            const metaStr = JSON.stringify(log.input);
            text += `  Input: ${metaStr.slice(0, 120)}${metaStr.length > 120 ? "..." : ""}\n`;
          }
          text += "\n";
        });

        return textResult(text);
      }),
  });

  registry.register({
    name: "swarm_health",
    description:
      "Get health status of all active agents: alive/stuck/errored state, last activity time, current task, and memory/token usage.",
    category: "swarm-monitoring",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {},
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("swarm_health", async () => {
        await requireAdminRole(userId);
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

        let aliveCount = 0;
        let stuckCount = 0;
        let erroredCount = 0;

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

          const lastActivity = a.lastSeenAt
            ? a.lastSeenAt.toISOString()
            : "never";
          const currentTask = a.projectPath
            ? `Working on: ${a.projectPath}`
            : "No active task";
          const memLabel = `${a.totalTokensUsed.toLocaleString()} tokens used`;

          text += `- **${a.displayName}** [${health}]\n`;
          text += `  Last activity: ${lastActivity}\n`;
          text += `  ${currentTask}\n`;
          text +=
            `  Memory: ${memLabel} | Tasks: ${a.totalTasksCompleted} | Inbox: ${a._count.messages}\n`;
          text += `  ID: ${a.id}\n\n`;
        }

        text += `**Summary:** ${aliveCount} alive, ${stuckCount} stuck, ${erroredCount} errored`;
        return textResult(text);
      }),
  });
}
