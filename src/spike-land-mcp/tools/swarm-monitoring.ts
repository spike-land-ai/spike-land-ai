/**
 * Swarm Monitoring MCP Tools (CF Workers)
 *
 * Tools for monitoring AI agent swarm performance, costs, and health status.
 * Runs on Cloudflare Workers with Drizzle ORM.
 *
 * The D1 schema has a simplified claudeCodeAgents table without audit logs,
 * so metrics/replay tools work with available data (agent status + metadata).
 * Docker-based metrics are stubbed.
 */

import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, textResult } from "../procedures/index";
import { agentMessages, claudeCodeAgents } from "../db/schema";
import type { DrizzleDB } from "../db/index";

export function registerSwarmMonitoringTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  // swarm_get_metrics
  registry.registerBuilt(
    t
      .tool(
        "swarm_get_metrics",
        "Get swarm performance metrics: agent count, status breakdown, and activity summary for a given time period.",
        {
          period: z
            .enum(["1h", "24h", "7d", "30d"])
            .optional()
            .default("24h")
            .describe("Time period to aggregate metrics over."),
        },
      )
      .meta({ category: "swarm-monitoring", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { period = "24h" } = input;

        const periodMs: Record<string, number> = {
          "1h": 60 * 60 * 1000,
          "24h": 24 * 60 * 60 * 1000,
          "7d": 7 * 24 * 60 * 60 * 1000,
          "30d": 30 * 24 * 60 * 60 * 1000,
        };
        const since = Date.now() - (periodMs[period] ?? periodMs["24h"]!);

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
          .where(eq(claudeCodeAgents.userId, ctx.userId));

        const agentsSpawned = agents.filter((a) => a.createdAt >= since).length;
        const running = agents.filter((a) => a.status === "running").length;
        const idle = agents.filter((a) => a.status === "idle").length;
        const stopped = agents.filter((a) => a.status === "stopped").length;

        const text =
          `**Swarm Metrics (${period})**\n\n` +
          `- Total agents: ${agents.length}\n` +
          `- Agents spawned in period: ${agentsSpawned}\n` +
          `- Running: ${running}\n` +
          `- Idle: ${idle}\n` +
          `- Stopped: ${stopped}\n\n` +
          `_Note: Detailed audit log metrics (task duration, success rate, token usage) ` +
          `require the spike.land platform. This edge worker provides agent status metrics only._`;

        return textResult(text);
      }),
  );

  // swarm_get_cost
  registry.registerBuilt(
    t
      .tool(
        "swarm_get_cost",
        "Get token usage and cost breakdown for the swarm. Reads usage data from agent metadata.",
        {
          agent_id: z
            .string()
            .optional()
            .describe("Filter by a specific agent ID. Omit for swarm-wide totals."),
        },
      )
      .meta({ category: "swarm-monitoring", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { agent_id } = input;

        const agents = agent_id
          ? await ctx.db
              .select()
              .from(claudeCodeAgents)
              .where(eq(claudeCodeAgents.id, agent_id))
              .limit(1)
          : await ctx.db
              .select()
              .from(claudeCodeAgents)
              .where(eq(claudeCodeAgents.userId, ctx.userId));

        if (agents.length === 0) {
          return textResult(agent_id ? `Agent ${agent_id} not found.` : "No agents found.");
        }

        const TOKEN_COST_USD = 0.000003;
        let totalTokens = 0;

        let text = `**Swarm Token Cost${agent_id ? ` (agent: ${agent_id})` : ""}**\n\n`;
        text += `**Breakdown by agent:**\n\n`;

        for (const a of agents) {
          const meta = JSON.parse(a.metadata || "{}") as Record<string, unknown>;
          const tokens = typeof meta.totalTokensUsed === "number" ? meta.totalTokensUsed : 0;
          totalTokens += tokens;
          const agentCost = (tokens * TOKEN_COST_USD).toFixed(4);
          text += `- **${a.name}** — ${tokens.toLocaleString()} tokens ($${agentCost})\n`;
          text += `  ID: ${a.id}\n`;
        }

        const totalCostUsd = (totalTokens * TOKEN_COST_USD).toFixed(4);
        text =
          `**Swarm Token Cost${agent_id ? ` (agent: ${agent_id})` : ""}**\n\n` +
          `- Total tokens: ${totalTokens.toLocaleString()}\n` +
          `- Estimated cost: $${totalCostUsd}\n\n` +
          `**Breakdown by agent:**\n\n`;

        for (const a of agents) {
          const meta = JSON.parse(a.metadata || "{}") as Record<string, unknown>;
          const tokens = typeof meta.totalTokensUsed === "number" ? meta.totalTokensUsed : 0;
          const agentCost = (tokens * TOKEN_COST_USD).toFixed(4);
          text += `- **${a.name}** — ${tokens.toLocaleString()} tokens ($${agentCost})\n`;
          text += `  ID: ${a.id}\n`;
        }

        return textResult(text);
      }),
  );

  // swarm_replay
  registry.registerBuilt(
    t
      .tool(
        "swarm_replay",
        "Replay an agent's message history step-by-step. Returns timestamped messages with optional range filtering.",
        {
          agent_id: z.string().min(1).describe("ID of the agent to replay."),
          from_step: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe("Start from this step index (inclusive, 0-based)."),
          to_step: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe("Stop at this step index (inclusive, 0-based)."),
        },
      )
      .meta({ category: "swarm-monitoring", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { agent_id, from_step, to_step } = input;

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
        if (!agent) return textResult(`Agent ${agent_id} not found.`);
        if (agent.userId !== ctx.userId) {
          return textResult(`Agent ${agent_id} not found.`);
        }

        const allMessages = await ctx.db
          .select({
            id: agentMessages.id,
            role: agentMessages.role,
            content: agentMessages.content,
            createdAt: agentMessages.createdAt,
          })
          .from(agentMessages)
          .where(eq(agentMessages.agentId, agent_id))
          .orderBy(agentMessages.createdAt);

        if (allMessages.length === 0) {
          return textResult(`No message history found for agent ${agent_id}.`);
        }

        const startIdx = from_step ?? 0;
        const endIdx = to_step !== undefined ? to_step + 1 : allMessages.length;
        const sliced = allMessages.slice(startIdx, endIdx);

        if (sliced.length === 0) {
          return textResult(
            `No steps in range [${startIdx}, ${
              to_step ?? allMessages.length - 1
            }] for agent ${agent_id}.`,
          );
        }

        let text = `**Replay: ${agent.name}** (steps ${startIdx}–${
          startIdx + sliced.length - 1
        } of ${allMessages.length} total)\n\n`;

        sliced.forEach((msg, i) => {
          const stepNum = startIdx + i;
          text += `**Step ${stepNum}**\n`;
          text += `  Role: ${msg.role}\n`;
          text += `  Time: ${new Date(msg.createdAt).toISOString()}\n`;
          text += `  Content: ${msg.content.slice(0, 120)}${
            msg.content.length > 120 ? "..." : ""
          }\n`;
          text += "\n";
        });

        return textResult(text);
      }),
  );

  // swarm_health
  registry.registerBuilt(
    t
      .tool(
        "swarm_health",
        "Get health status of all agents: alive/stuck/errored state, last activity time, and current status.",
        {},
      )
      .meta({ category: "swarm-monitoring", tier: "free" })
      .handler(async ({ ctx }) => {
        const now = Date.now();
        const fiveMinAgo = now - 5 * 60 * 1000;
        const thirtyMinAgo = now - 30 * 60 * 1000;

        const agents = await ctx.db
          .select({
            id: claudeCodeAgents.id,
            name: claudeCodeAgents.name,
            status: claudeCodeAgents.status,
            lastActiveAt: claudeCodeAgents.lastActiveAt,
            metadata: claudeCodeAgents.metadata,
          })
          .from(claudeCodeAgents)
          .where(eq(claudeCodeAgents.userId, ctx.userId))
          .orderBy(desc(claudeCodeAgents.lastActiveAt));

        if (agents.length === 0) return textResult("No agents found.");

        let aliveCount = 0;
        let stuckCount = 0;
        let erroredCount = 0;

        let text = `**Swarm Health (${agents.length} agents)**\n\n`;

        for (const a of agents) {
          let health: string;
          if (a.status === "stopped") {
            health = "STOPPED";
            erroredCount++;
          } else if (!a.lastActiveAt) {
            health = "ERRORED";
            erroredCount++;
          } else if (a.lastActiveAt >= fiveMinAgo) {
            health = "ALIVE";
            aliveCount++;
          } else if (a.lastActiveAt >= thirtyMinAgo) {
            health = "STUCK";
            stuckCount++;
          } else {
            health = "ERRORED";
            erroredCount++;
          }

          const lastActivity = a.lastActiveAt ? new Date(a.lastActiveAt).toISOString() : "never";

          const meta = JSON.parse(a.metadata || "{}") as Record<string, unknown>;
          const currentTask = meta.projectPath
            ? `Working on: ${meta.projectPath}`
            : "No active task";

          text += `- **${a.name}** [${health}]\n`;
          text += `  Last activity: ${lastActivity}\n`;
          text += `  ${currentTask}\n`;
          text += `  ID: ${a.id}\n\n`;
        }

        text += `**Summary:** ${aliveCount} alive, ${stuckCount} stuck, ${erroredCount} errored/stopped`;
        return textResult(text);
      }),
  );
}
