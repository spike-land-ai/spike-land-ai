/**
 * MCP Observability Tools
 *
 * Per-tool metrics (call count, latency percentiles, error rate),
 * system health, user analytics, and cost attribution.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import {
    jsonResult,
    requireAdminRole,
    textResult,
} from "./tool-helpers";
import { workspaceTool } from "../tool-builder/procedures.js";

interface ToolMetricRow {
    tool: string;
    call_count: bigint;
    error_count: bigint;
    avg_duration: number;
    p50_duration: number;
    p95_duration: number;
    p99_duration: number;
    total_tokens: bigint;
}

interface UserCostRow {
    userId: string;
    tool: string;
    day: Date;
    call_count: bigint;
    total_tokens: bigint;
    total_duration: bigint;
    error_count: bigint;
}

interface UserSummaryRow {
    userId: string;
    call_count: bigint;
    total_tokens: bigint;
    error_count: bigint;
    unique_tools: bigint;
}

export function registerMcpObservabilityTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        workspaceTool(userId)
            .tool("admin_tool_metrics", "Per-tool MCP metrics: call count, p50/p95/p99 latency, error rate, and token usage.\n"
                + "Query the ToolInvocation table for aggregated metrics over a configurable time window.", {
                period_hours: z.number().int().min(1).max(720).optional().default(24)
                    .describe("Lookback period in hours (default 24, max 720 = 30d)."),
                tool_name: z.string().optional().describe(
                    "Filter to a specific tool name. Omit for all tools.",
                ),
                limit: z.number().int().min(1).max(100).optional().default(20).describe(
                    "Max tools to return (default 20).",
                ),
            })
            .meta({ category: "mcp-observability", tier: "workspace" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    period_hours = 24,
                    tool_name,
                    limit = 20,
                } = input;

                await requireAdminRole(userId);
                const prisma = (await import("@/lib/prisma")).default;
                const since = new Date(Date.now() - period_hours * 60 * 60 * 1000);

                const rows = tool_name
                    ? await prisma.$queryRaw<ToolMetricRow[]>`SELECT
              tool,
              COUNT(*)::bigint AS call_count,
              SUM(CASE WHEN "isError" THEN 1 ELSE 0 END)::bigint AS error_count,
              AVG("durationMs")::float AS avg_duration,
              PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "durationMs")::float AS p50_duration,
              PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "durationMs")::float AS p95_duration,
              PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "durationMs")::float AS p99_duration,
              COALESCE(SUM("tokensConsumed"), 0)::bigint AS total_tokens
            FROM tool_invocations
            WHERE "createdAt" >= ${since} AND tool = ${tool_name}
            GROUP BY tool
            ORDER BY call_count DESC
            LIMIT ${limit}`
                    : await prisma.$queryRaw<ToolMetricRow[]>`SELECT
              tool,
              COUNT(*)::bigint AS call_count,
              SUM(CASE WHEN "isError" THEN 1 ELSE 0 END)::bigint AS error_count,
              AVG("durationMs")::float AS avg_duration,
              PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "durationMs")::float AS p50_duration,
              PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "durationMs")::float AS p95_duration,
              PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "durationMs")::float AS p99_duration,
              COALESCE(SUM("tokensConsumed"), 0)::bigint AS total_tokens
            FROM tool_invocations
            WHERE "createdAt" >= ${since}
            GROUP BY tool
            ORDER BY call_count DESC
            LIMIT ${limit}`;

                if (rows.length === 0) {
                    return textResult(
                        `No tool invocations found in the last ${period_hours}h.`,
                    );
                }

                let text = `**MCP Tool Metrics (last ${period_hours}h)**\n\n`;
                text += `| Tool | Calls | Errors | Error% | p50ms | p95ms | p99ms | Tokens |\n`;
                text += `|------|-------|--------|--------|-------|-------|-------|--------|\n`;

                const metricsData = rows.map(row => {
                    const calls = Number(row.call_count);
                    const errors = Number(row.error_count);
                    const errorRate = calls > 0
                        ? ((errors / calls) * 100).toFixed(1)
                        : "0.0";
                    return {
                        tool: row.tool,
                        calls,
                        errors,
                        errorRate: parseFloat(errorRate),
                        avgMs: Math.round(row.avg_duration),
                        p50Ms: Math.round(row.p50_duration),
                        p95Ms: Math.round(row.p95_duration),
                        p99Ms: Math.round(row.p99_duration),
                        tokens: Number(row.total_tokens),
                    };
                });

                for (const m of metricsData) {
                    text +=
                        `| ${m.tool} | ${m.calls} | ${m.errors} | ${m.errorRate}% | ${m.p50Ms} | ${m.p95Ms} | ${m.p99Ms} | ${m.tokens} |\n`;
                }

                return jsonResult(text, metricsData);
            })
    );

    registry.registerBuilt(
        workspaceTool(userId)
            .tool("admin_system_health", "MCP system health: database/Redis latency, total invocations, error rate, "
                + "active tools, and optionally a per-tool error breakdown.", {
                include_tool_breakdown: z.boolean().optional().default(false).describe(
                    "Include per-tool error breakdown.",
                ),
            })
            .meta({ category: "mcp-observability", tier: "workspace" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    include_tool_breakdown = false,
                } = input;

                await requireAdminRole(userId);
                const prisma = (await import("@/lib/prisma")).default;

                const now = new Date();
                const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                const last1h = new Date(now.getTime() - 60 * 60 * 1000);

                // Parallel health checks
                const [
                    dbHealth,
                    redisHealth,
                    invocationStats,
                    recentErrors,
                    activeTools,
                ] = await Promise.all([
                    (async () => {
                        try {
                            const start = Date.now();
                            await prisma.$queryRaw`SELECT 1`;
                            return {
                                status: "HEALTHY" as const,
                                latencyMs: Date.now() - start,
                            };
                        } catch {
                            return { status: "DOWN" as const, latencyMs: -1 };
                        }
                    })(),
                    (async () => {
                        try {
                            const { redis } = await import("@/lib/upstash/client");
                            const start = Date.now();
                            await redis.ping();
                            return {
                                status: "HEALTHY" as const,
                                latencyMs: Date.now() - start,
                            };
                        } catch {
                            return { status: "DOWN" as const, latencyMs: -1 };
                        }
                    })(),
                    prisma.toolInvocation.aggregate({
                        where: { createdAt: { gte: last24h } },
                        _count: true,
                        _sum: { tokensConsumed: true, durationMs: true },
                        _avg: { durationMs: true },
                    }).catch(() => ({
                        _count: 0,
                        _sum: { tokensConsumed: null, durationMs: null },
                        _avg: { durationMs: null },
                    })),
                    prisma.toolInvocation.count({
                        where: { createdAt: { gte: last24h }, isError: true },
                    }).catch(() => 0),
                    prisma.toolInvocation.groupBy({
                        by: ["tool"],
                        where: { createdAt: { gte: last1h } },
                        _count: true,
                    }).catch(() => []),
                ]);

                const totalCalls = invocationStats._count ?? 0;
                const errorRate = totalCalls > 0
                    ? ((recentErrors / totalCalls) * 100).toFixed(2)
                    : "0.00";

                let text = `**MCP System Health**\n\n`;
                text += `**Infrastructure:**\n`;
                text += `- Database: ${dbHealth.status}${dbHealth.latencyMs >= 0 ? ` (${dbHealth.latencyMs}ms)` : ""
                    }\n`;
                text += `- Redis: ${redisHealth.status}${redisHealth.latencyMs >= 0 ? ` (${redisHealth.latencyMs}ms)` : ""
                    }\n\n`;
                text += `**MCP Metrics (24h):**\n`;
                text += `- Total Invocations: ${totalCalls}\n`;
                text += `- Errors: ${recentErrors} (${errorRate}%)\n`;
                text += `- Avg Latency: ${Math.round(invocationStats._avg?.durationMs ?? 0)}ms\n`;
                text += `- Total Tokens: ${invocationStats._sum?.tokensConsumed ?? 0}\n`;
                text += `- Active Tools (1h): ${activeTools.length}\n`;

                if (include_tool_breakdown && activeTools.length > 0) {
                    text += `\n**Active Tools (last 1h):**\n`;
                    const sorted = [...activeTools].sort((a, b) => (b._count ?? 0) - (a._count ?? 0));
                    for (const t of sorted.slice(0, 20)) {
                        text += `- ${t.tool}: ${t._count} calls\n`;
                    }
                }

                return textResult(text);
            })
    );

    registry.registerBuilt(
        workspaceTool(userId)
            .tool("admin_user_analytics", "Per-user MCP analytics and cost attribution: calls, tokens, errors per user, "
                + "and daily token breakdown per tool per user.", {
                period_hours: z.number().int().min(1).max(720).optional().default(24)
                    .describe("Lookback period in hours (default 24, max 720 = 30d)."),
                user_id: z.string().optional().describe(
                    "Filter to a specific user. Omit for all users.",
                ),
                limit: z.number().int().min(1).max(50).optional().default(20).describe(
                    "Max users to return (default 20).",
                ),
            })
            .meta({ category: "mcp-observability", tier: "workspace" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    period_hours = 24,
                    user_id,
                    limit = 20,
                } = input;

                await requireAdminRole(userId);
                const prisma = (await import("@/lib/prisma")).default;
                const since = new Date(Date.now() - period_hours * 60 * 60 * 1000);

                if (user_id) {
                    // Detailed cost attribution for a single user
                    const rows = await prisma.$queryRaw<UserCostRow[]>`SELECT
              "userId",
              tool,
              DATE("createdAt") AS day,
              COUNT(*)::bigint AS call_count,
              COALESCE(SUM("tokensConsumed"), 0)::bigint AS total_tokens,
              COALESCE(SUM("durationMs"), 0)::bigint AS total_duration,
              SUM(CASE WHEN "isError" THEN 1 ELSE 0 END)::bigint AS error_count
            FROM tool_invocations
            WHERE "createdAt" >= ${since} AND "userId" = ${user_id}
            GROUP BY "userId", tool, DATE("createdAt")
            ORDER BY day DESC, total_tokens DESC`;

                    if (rows.length === 0) {
                        return textResult(
                            `No invocations for user ${user_id} in the last ${period_hours}h.`,
                        );
                    }

                    let text = `**User Cost Attribution: ${user_id} (last ${period_hours}h)**\n\n`;
                    text += `| Date | Tool | Calls | Tokens | Errors |\n`;
                    text += `|------|------|-------|--------|--------|\n`;

                    const costData = rows.map(row => ({
                        date: row.day.toISOString().split("T")[0] ?? "",
                        tool: row.tool,
                        calls: Number(row.call_count),
                        tokens: Number(row.total_tokens),
                        errors: Number(row.error_count),
                    }));

                    for (const c of costData) {
                        text += `| ${c.date} | ${c.tool} | ${c.calls} | ${c.tokens} | ${c.errors} |\n`;
                    }

                    return jsonResult(text, costData);
                }

                // Summary across all users
                const rows = await prisma.$queryRaw<UserSummaryRow[]>`SELECT
            "userId",
            COUNT(*)::bigint AS call_count,
            COALESCE(SUM("tokensConsumed"), 0)::bigint AS total_tokens,
            SUM(CASE WHEN "isError" THEN 1 ELSE 0 END)::bigint AS error_count,
            COUNT(DISTINCT tool)::bigint AS unique_tools
          FROM tool_invocations
          WHERE "createdAt" >= ${since}
          GROUP BY "userId"
          ORDER BY total_tokens DESC
          LIMIT ${limit}`;

                if (rows.length === 0) {
                    return textResult(`No invocations in the last ${period_hours}h.`);
                }

                let text = `**User Analytics (last ${period_hours}h)**\n\n`;
                text += `| User | Calls | Tokens | Errors | Tools |\n`;
                text += `|------|-------|--------|--------|-------|\n`;

                const analyticsData = rows.map(row => ({
                    userId: row.userId,
                    calls: Number(row.call_count),
                    tokens: Number(row.total_tokens),
                    errors: Number(row.error_count),
                    uniqueTools: Number(row.unique_tools),
                }));

                for (const a of analyticsData) {
                    text += `| ${a.userId} | ${a.calls} | ${a.tokens} | ${a.errors} | ${a.uniqueTools} |\n`;
                }

                return jsonResult(text, analyticsData);
            })
    );
}
