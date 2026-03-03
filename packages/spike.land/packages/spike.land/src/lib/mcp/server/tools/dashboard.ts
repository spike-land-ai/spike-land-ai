/**
 * Dashboard MCP Tools
 *
 * Tools for platform overview, health checks, error monitoring,
 * activity feeds, and widget data.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { requireAdminRole, safeToolCall, textResult } from "./tool-helpers";

const WidgetDataSchema = z.object({
  widget_id: z.enum([
    "metrics",
    "environments",
    "agents",
    "alerts",
    "deployments",
  ]).describe("Widget identifier."),
});

const ErrorsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20).describe(
    "Max errors to return.",
  ),
  hours: z.number().int().min(1).max(168).optional().default(24).describe(
    "Lookback hours (default 24).",
  ),
});

const ActivityFeedSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20).describe(
    "Max items to return.",
  ),
});

export function registerDashboardTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "dash_overview",
    description:
      "Get a high-level overview of the platform: user count, agents, jobs, errors, and credits.",
    category: "dash",
    tier: "workspace",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("dash_overview", async () => {
        await requireAdminRole(userId);
        const prisma = (await import("@/lib/prisma")).default;

        const now = new Date();
        const twentyFourHoursAgo = new Date(
          now.getTime() - 24 * 60 * 60 * 1000,
        );

        const [userCount, agentCount, jobCount, errorCount, creditUsage] = await Promise.all([
          prisma.user.count(),
          prisma.claudeCodeAgent.count({ where: { deletedAt: null } }),
          prisma.mcpGenerationJob.count({ where: { status: "PENDING" } }),
          prisma.agentAuditLog.count({
            where: { isError: true, createdAt: { gte: twentyFourHoursAgo } },
          }),
          prisma.toolInvocation.aggregate({ _sum: { tokensConsumed: true } }),
        ]);

        const totalCredits = creditUsage._sum.tokensConsumed ?? 0;

        return textResult(
          `**Platform Overview**\n\n`
            + `- Users: ${userCount}\n`
            + `- Active Agents: ${agentCount}\n`
            + `- Pending Jobs: ${jobCount}\n`
            + `- Errors (24h): ${errorCount}\n`
            + `- Total Credits Used: ${totalCredits}`,
        );
      }),
  });

  registry.register({
    name: "dash_health",
    description:
      "Check health of core services: database, Redis, and external service configurations.",
    category: "dash",
    tier: "workspace",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("dash_health", async () => {
        await requireAdminRole(userId);

        const services: Array<
          { name: string; status: string; detail: string; }
        > = [];

        // Database health
        try {
          const prisma = (await import("@/lib/prisma")).default;
          const start = Date.now();
          await prisma.$queryRaw`SELECT 1`;
          const latency = Date.now() - start;
          services.push({
            name: "Database",
            status: latency > 3000 ? "DEGRADED" : "HEALTHY",
            detail: `${latency}ms`,
          });
        } catch {
          services.push({
            name: "Database",
            status: "DOWN",
            detail: "Connection failed",
          });
        }

        // Redis health
        try {
          const { redis } = await import("@/lib/upstash/client");
          const start = Date.now();
          await redis.ping();
          const latency = Date.now() - start;
          services.push({
            name: "Redis",
            status: latency > 3000 ? "DEGRADED" : "HEALTHY",
            detail: `${latency}ms`,
          });
        } catch {
          services.push({
            name: "Redis",
            status: "DOWN",
            detail: "Connection failed",
          });
        }

        // External service config checks
        const configChecks = [
          { name: "GitHub", envVar: "GITHUB_TOKEN" },
        ];

        for (const check of configChecks) {
          const configured = !!process.env[check.envVar];
          services.push({
            name: check.name,
            status: configured ? "CONFIGURED" : "UNCONFIGURED",
            detail: configured ? "Token present" : "No token found",
          });
        }

        let text = `**Service Health:**\n\n`;
        for (const svc of services) {
          text += `- **${svc.name}** [${svc.status}] — ${svc.detail}\n`;
        }
        return textResult(text);
      }),
  });

  registry.register({
    name: "dash_errors",
    description: "List recent errors from the agent audit log.",
    category: "dash",
    tier: "workspace",
    inputSchema: ErrorsSchema.shape,
    handler: async (
      { limit = 20, hours = 24 }: z.infer<typeof ErrorsSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("dash_errors", async () => {
        await requireAdminRole(userId);
        const prisma = (await import("@/lib/prisma")).default;
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        const errors = await prisma.agentAuditLog.findMany({
          where: { isError: true, createdAt: { gte: since } },
          select: {
            id: true,
            action: true,
            actionType: true,
            createdAt: true,
            agentId: true,
          },
          take: limit,
          orderBy: { createdAt: "desc" },
        });

        if (errors.length === 0) {
          return textResult(`No errors in the last ${hours}h.`);
        }
        let text = `**Recent Errors (${errors.length}, last ${hours}h):**\n\n`;
        for (const err of errors) {
          text +=
            `- **${err.action}** [${err.actionType}]\n  Agent: ${err.agentId} | ${err.createdAt.toISOString()}\n  ID: ${err.id}\n\n`;
        }
        return textResult(text);
      }),
  });

  registry.register({
    name: "dash_activity_feed",
    description: "Get combined recent activity feed: agents, jobs, and deployments.",
    category: "dash",
    tier: "workspace",
    inputSchema: ActivityFeedSchema.shape,
    handler: async (
      { limit = 20 }: z.infer<typeof ActivityFeedSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("dash_activity_feed", async () => {
        await requireAdminRole(userId);
        const prisma = (await import("@/lib/prisma")).default;

        const [agents, jobs] = await Promise.all([
          prisma.claudeCodeAgent.findMany({
            where: { deletedAt: null },
            select: { id: true, displayName: true, lastSeenAt: true },
            take: Math.ceil(limit / 2),
            orderBy: { lastSeenAt: "desc" },
          }),
          prisma.mcpGenerationJob.findMany({
            select: { id: true, type: true, status: true, createdAt: true },
            take: Math.ceil(limit / 2),
            orderBy: { createdAt: "desc" },
          }),
        ]);

        interface FeedEntry {
          type: string;
          title: string;
          time: Date;
        }
        const entries: FeedEntry[] = [];

        for (const a of agents) {
          if (a.lastSeenAt) {
            entries.push({
              type: "agent",
              title: `Agent ${a.displayName} active`,
              time: a.lastSeenAt,
            });
          }
        }
        for (const j of jobs) {
          entries.push({
            type: "job",
            title: `Job ${j.type} [${j.status}]`,
            time: j.createdAt,
          });
        }

        entries.sort((a, b) => b.time.getTime() - a.time.getTime());
        const trimmed = entries.slice(0, limit);

        if (trimmed.length === 0) return textResult("No recent activity.");
        let text = `**Activity Feed (${trimmed.length}):**\n\n`;
        for (const entry of trimmed) {
          text += `- [${entry.type}] ${entry.title} — ${entry.time.toISOString()}\n`;
        }
        return textResult(text);
      }),
  });

  registry.register({
    name: "dash_widget_data",
    description: "Get data for a specific dashboard widget by its ID.",
    category: "dash",
    tier: "workspace",
    inputSchema: WidgetDataSchema.shape,
    handler: async (
      { widget_id }: z.infer<typeof WidgetDataSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("dash_widget_data", async () => {
        await requireAdminRole(userId);
        const prisma = (await import("@/lib/prisma")).default;

        switch (widget_id) {
          case "metrics": {
            const [users, agents, jobs] = await Promise.all([
              prisma.user.count(),
              prisma.claudeCodeAgent.count({ where: { deletedAt: null } }),
              prisma.mcpGenerationJob.count(),
            ]);
            return textResult(
              `**Metrics Widget**\n\nUsers: ${users}\nAgents: ${agents}\nJobs: ${jobs}`,
            );
          }
          case "agents": {
            const agents = await prisma.claudeCodeAgent.findMany({
              where: { deletedAt: null },
              select: { id: true, displayName: true, lastSeenAt: true },
              take: 10,
              orderBy: { lastSeenAt: "desc" },
            });
            if (agents.length === 0) {
              return textResult("**Agents Widget**\n\nNo active agents.");
            }
            let text = `**Agents Widget (${agents.length}):**\n\n`;
            for (const a of agents) {
              text += `- ${a.displayName} — Last seen: ${a.lastSeenAt?.toISOString() || "never"}\n`;
            }
            return textResult(text);
          }
          case "alerts": {
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const errorCount = await prisma.agentAuditLog.count({
              where: { isError: true, createdAt: { gte: since } },
            });
            return textResult(
              `**Alerts Widget**\n\nErrors (24h): ${errorCount}`,
            );
          }
          case "environments": {
            const { checkAllEnvironments } = await import(
              "@/lib/dashboard/environments"
            );
            const envs = await checkAllEnvironments();
            let text = `**Environments Widget (${envs.length}):**\n\n`;
            for (const env of envs) {
              text += `- **${env.name}** [${env.status}] — ${env.url}\n`;
            }
            return textResult(text);
          }
          case "deployments": {
            return textResult(
              "**Deployments Widget**\n\nDeployments are now managed via AWS ECS. Use the AWS console or CLI to view deployments.",
            );
          }
          default:
            return textResult(`Unknown widget: ${widget_id as string}`);
        }
      }),
  });
}
