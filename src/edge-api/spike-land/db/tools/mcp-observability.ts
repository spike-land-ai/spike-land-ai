/**
 * MCP Observability Tools (CF Workers)
 *
 * System-level observability: tool latency percentiles, health overview,
 * and per-user analytics from D1 tables.
 */

import { z } from "zod";
import { and, count, desc, eq, gte, sql, sum } from "drizzle-orm";
import type { ToolRegistry } from "../../lazy-imports/registry";
import { freeTool, textResult } from "../../lazy-imports/procedures-index.ts";
import { skillUsageEvents, toolCallDaily } from "../db/schema";
import type { DrizzleDB } from "../db/db-index.ts";

export function registerMcpObservabilityTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "observability_health",
        "Get a high-level health overview: total calls, error rate, and top error sources.",
        {
          hours: z
            .number()
            .optional()
            .default(24)
            .describe("Number of hours to look back (default 24)."),
        },
      )
      .meta({ category: "mcp-observability", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { hours } = input;
        const sinceTs = Date.now() - hours * 60 * 60 * 1000;

        const [totals] = await ctx.db
          .select({
            total: count(),
            errors:
              sql<number>`sum(case when ${skillUsageEvents.outcome} = 'error' then 1 else 0 end)`.mapWith(
                Number,
              ),
          })
          .from(skillUsageEvents)
          .where(gte(skillUsageEvents.createdAt, sinceTs));

        const total = totals?.total ?? 0;
        const errors = totals?.errors ?? 0;
        const errorPct = total > 0 ? ((errors / total) * 100).toFixed(1) : "0.0";

        const topErrors = await ctx.db
          .select({
            skillName: skillUsageEvents.skillName,
            errorCount: count(),
          })
          .from(skillUsageEvents)
          .where(
            and(eq(skillUsageEvents.outcome, "error"), gte(skillUsageEvents.createdAt, sinceTs)),
          )
          .groupBy(skillUsageEvents.skillName)
          .orderBy(sql`count(*) DESC`)
          .limit(5);

        let text =
          `**System Health (last ${hours}h)**\n\n` +
          `- **Total calls:** ${total}\n` +
          `- **Errors:** ${errors} (${errorPct}%)\n`;

        if (topErrors.length > 0) {
          text += `\n**Top Error Sources:**\n`;
          for (const row of topErrors) {
            text += `- ${row.skillName}: ${row.errorCount} error(s)\n`;
          }
        }

        return textResult(text);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("observability_latency", "Get tool latency statistics from daily rollup data.", {
        days: z.number().optional().default(7).describe("Number of days to look back (default 7)."),
        tool_name: z.string().optional().describe("Filter by specific tool name."),
      })
      .meta({ category: "mcp-observability", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { days, tool_name } = input;
        // tool_call_daily.day stores a UTC midnight millisecond epoch (via Date.UTC).
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const sinceDay = Date.UTC(
          cutoffDate.getUTCFullYear(),
          cutoffDate.getUTCMonth(),
          cutoffDate.getUTCDate(),
        );

        const conditions = [gte(toolCallDaily.day, sinceDay)];
        if (tool_name) conditions.push(eq(toolCallDaily.toolName, tool_name));

        const rows = await ctx.db
          .select({
            toolName: toolCallDaily.toolName,
            totalCalls: sum(toolCallDaily.callCount).mapWith(Number),
            totalMs: sum(toolCallDaily.totalMs).mapWith(Number),
          })
          .from(toolCallDaily)
          .where(and(...conditions))
          .groupBy(toolCallDaily.toolName)
          .orderBy(
            desc(sql`sum(${toolCallDaily.totalMs}) / nullif(sum(${toolCallDaily.callCount}), 0)`),
          )
          .limit(20);

        if (rows.length === 0) {
          return textResult(`**No latency data** in the last ${days} day(s).`);
        }

        const lines = rows.map((r) => {
          const calls = r.totalCalls ?? 0;
          const avgMs = calls > 0 ? Math.round((r.totalMs ?? 0) / calls) : 0;
          return `- **${r.toolName}**: avg ${avgMs}ms (${calls} calls)`;
        });

        return textResult(`**Tool Latency (last ${days}d)**\n\n` + lines.join("\n"));
      }),
  );
}
