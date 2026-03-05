/**
 * Error Query MCP Tools (CF Workers)
 *
 * Query error events from skill_usage_events table (outcome='error').
 * Replaces the Sentry bridge stub with D1-backed error querying.
 */

import { z } from "zod";
import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, textResult } from "../procedures/index";
import { skillUsageEvents } from "../db/schema";
import type { DrizzleDB } from "../db/index";

export function registerSentryBridgeTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "query_errors",
        "Query recent errors from tool usage logs, optionally filtered by service/severity.",
        {
          service: z
            .string()
            .optional()
            .describe("Filter by server/service name (e.g., 'spike-land-mcp')."),
          skill: z.string().optional().describe("Filter by skill/tool name."),
          limit: z
            .number()
            .optional()
            .default(25)
            .describe("Max error records to return (default 25)."),
          since: z
            .string()
            .optional()
            .describe("ISO date string — only return errors after this time."),
        },
      )
      .meta({ category: "mcp-observability", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { service, skill, limit, since } = input;

        const sinceTs = since ? new Date(since).getTime() : Date.now() - 24 * 60 * 60 * 1000;

        const conditions = [
          eq(skillUsageEvents.outcome, "error"),
          gt(skillUsageEvents.createdAt, sinceTs),
        ];
        if (service) conditions.push(eq(skillUsageEvents.serverName, service));
        if (skill) conditions.push(eq(skillUsageEvents.skillName, skill));

        const errors = await ctx.db
          .select()
          .from(skillUsageEvents)
          .where(and(...conditions))
          .orderBy(desc(skillUsageEvents.createdAt))
          .limit(limit);

        if (errors.length === 0) {
          return textResult("**No errors found** matching the given filters.");
        }

        const lines = errors.map(
          (e) =>
            `- [${new Date(e.createdAt).toISOString()}] **${e.skillName}** (${e.serverName}): ${e.errorMessage ?? "no message"}${e.durationMs !== null ? ` [${e.durationMs}ms]` : ""}`,
        );
        return textResult(`**Errors (${errors.length})**\n\n${lines.join("\n")}`);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "error_summary",
        "Aggregated error counts by service and skill for a given time window.",
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

        const rows = await ctx.db
          .select({
            serverName: skillUsageEvents.serverName,
            skillName: skillUsageEvents.skillName,
            errorCount: count(),
          })
          .from(skillUsageEvents)
          .where(
            and(
              eq(skillUsageEvents.outcome, "error"),
              gt(skillUsageEvents.createdAt, sinceTs),
            ),
          )
          .groupBy(skillUsageEvents.serverName, skillUsageEvents.skillName)
          .orderBy(sql`count(*) DESC`);

        if (rows.length === 0) {
          return textResult(`**No errors** in the last ${hours} hour(s).`);
        }

        const totalErrors = rows.reduce((sum, r) => sum + r.errorCount, 0);
        const lines = rows.map(
          (r) => `- **${r.serverName}** / ${r.skillName}: ${r.errorCount} error(s)`,
        );

        return textResult(
          `**Error Summary (last ${hours}h)**\n\n` +
            `**Total errors:** ${totalErrors}\n\n` +
            lines.join("\n"),
        );
      }),
  );
}
