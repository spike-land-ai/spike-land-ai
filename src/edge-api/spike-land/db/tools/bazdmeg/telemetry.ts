/**
 * BAZDMEG Telemetry MCP Tools (CF Workers)
 *
 * Tool usage statistics and error rate analysis from D1 analytics tables.
 */

import { z } from "zod";
import { and, count, eq, gt, gte, sql, sum } from "drizzle-orm";
import type { ToolRegistry } from "../../../lazy-imports/registry";
import { freeTool, textResult } from "../../../lazy-imports/procedures-index.ts";
import { skillUsageEvents, toolCallDaily } from "../../db/schema";
import type { DrizzleDB } from "../../db/db-index.ts";

export function registerBazdmegTelemetryTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "tool_usage_stats",
        "Get tool call counts and most/least used tools over a given number of days.",
        {
          days: z
            .number()
            .optional()
            .default(7)
            .describe("Number of days to look back (default 7)."),
          limit: z.number().optional().default(20).describe("Max tools to return (default 20)."),
        },
      )
      .meta({ category: "mcp-observability", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { days, limit } = input;

        // tool_call_daily.day stores a UTC midnight millisecond epoch (via Date.UTC).
        // Compute the cutoff as a ms epoch, not a day-index.
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const sinceDay = Date.UTC(
          cutoffDate.getUTCFullYear(),
          cutoffDate.getUTCMonth(),
          cutoffDate.getUTCDate(),
        );

        const rows = await ctx.db
          .select({
            toolName: toolCallDaily.toolName,
            serverName: toolCallDaily.serverName,
            totalCalls: sum(toolCallDaily.callCount).mapWith(Number),
            totalErrors: sum(toolCallDaily.errorCount).mapWith(Number),
            totalMs: sum(toolCallDaily.totalMs).mapWith(Number),
          })
          .from(toolCallDaily)
          .where(gte(toolCallDaily.day, sinceDay))
          .groupBy(toolCallDaily.toolName, toolCallDaily.serverName)
          .orderBy(sql`sum(${toolCallDaily.callCount}) DESC`)
          .limit(limit);

        if (rows.length === 0) {
          return textResult(`**No tool usage data** in the last ${days} day(s).`);
        }

        const totalCalls = rows.reduce((s, r) => s + (r.totalCalls ?? 0), 0);

        const lines = rows.map((r) => {
          const calls = r.totalCalls ?? 0;
          const errors = r.totalErrors ?? 0;
          const avgMs = calls > 0 ? Math.round((r.totalMs ?? 0) / calls) : 0;
          const errorRate = calls > 0 ? ((errors / calls) * 100).toFixed(1) : "0.0";
          return `- **${r.toolName}** (${r.serverName}): ${calls} calls, ${errors} errors (${errorRate}%), avg ${avgMs}ms`;
        });

        return textResult(
          `**Tool Usage Stats (last ${days}d)**\n\n` +
            `**Total calls:** ${totalCalls}\n\n` +
            lines.join("\n"),
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "error_rate",
        "Calculate the error rate (errors per hour) for a service over a given time window.",
        {
          service: z
            .string()
            .optional()
            .describe("Filter by server/service name. Omit for all services."),
          hours: z
            .number()
            .optional()
            .default(24)
            .describe("Number of hours to look back (default 24)."),
        },
      )
      .meta({ category: "mcp-observability", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { service, hours } = input;
        const sinceTs = Date.now() - hours * 60 * 60 * 1000;

        const totalConditions = [gt(skillUsageEvents.createdAt, sinceTs)];
        const errorConditions = [
          gt(skillUsageEvents.createdAt, sinceTs),
          eq(skillUsageEvents.outcome, "error"),
        ];

        if (service) {
          totalConditions.push(eq(skillUsageEvents.serverName, service));
          errorConditions.push(eq(skillUsageEvents.serverName, service));
        }

        const [totalResult] = await ctx.db
          .select({ total: count() })
          .from(skillUsageEvents)
          .where(and(...totalConditions));

        const [errorResult] = await ctx.db
          .select({ errors: count() })
          .from(skillUsageEvents)
          .where(and(...errorConditions));

        const total = totalResult?.total ?? 0;
        const errors = errorResult?.errors ?? 0;
        const errorsPerHour = hours > 0 ? (errors / hours).toFixed(2) : "0.00";
        const errorPct = total > 0 ? ((errors / total) * 100).toFixed(1) : "0.0";

        const svcLabel = service ?? "all services";
        return textResult(
          `**Error Rate (${svcLabel}, last ${hours}h)**\n\n` +
            `- **Total calls:** ${total}\n` +
            `- **Total errors:** ${errors}\n` +
            `- **Error rate:** ${errorsPerHour} errors/hour (${errorPct}%)\n`,
        );
      }),
  );
}
