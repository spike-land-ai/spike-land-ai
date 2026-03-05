/**
 * Audit MCP Tools
 *
 * Query audit logs, export records, and inspect activity trails.
 * Runs on Cloudflare Workers with Drizzle ORM.
 */

import { z } from "zod";
import { and, desc, eq, gt, gte, lte } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, textResult } from "../procedures/index";
import { auditLogs } from "../db/schema";
import type { DrizzleDB } from "../db/index";

export function registerAuditTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "audit_query_logs",
        "Query audit logs with optional filters for action and resource type. Logs are retained for 90 days.",
        {
          action: z.string().optional().describe("Filter by action type."),
          resource_type: z.string().optional().describe("Filter by resource type."),
          days: z
            .number()
            .optional()
            .default(7)
            .describe("Number of days to look back (default 7)."),
          limit: z.number().optional().default(50).describe("Max records to return (default 50)."),
        },
      )
      .meta({ category: "audit", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { action, resource_type, days, limit } = input;

        const sinceTs = Date.now() - days * 24 * 60 * 60 * 1000;

        // Build conditions
        const conditions = [eq(auditLogs.userId, ctx.userId), gt(auditLogs.createdAt, sinceTs)];
        if (action) conditions.push(eq(auditLogs.action, action));
        if (resource_type) {
          conditions.push(eq(auditLogs.resourceType, resource_type));
        }

        const logs = await ctx.db
          .select()
          .from(auditLogs)
          .where(and(...conditions))
          .orderBy(desc(auditLogs.createdAt))
          .limit(limit);

        if (logs.length === 0) {
          return textResult("**No audit logs found** matching the given filters.");
        }

        const lines = logs.map(
          (log) =>
            `- [${new Date(
              log.createdAt,
            ).toISOString()}] **${log.action}** on ${log.resourceType ?? "unknown"} (${
              log.resourceId ?? "n/a"
            })`,
        );
        return textResult(`**Audit Logs (${logs.length})**\n\n${lines.join("\n")}`);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("audit_export", "Export audit logs for a date range as a summary.", {
        from_date: z.string().min(1).describe("Start date (ISO string)."),
        to_date: z.string().min(1).describe("End date (ISO string)."),
      })
      .meta({ category: "audit", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { from_date, to_date } = input;
        const fromTs = new Date(from_date).getTime();
        const toTs = new Date(to_date).getTime();

        const logs = await ctx.db
          .select()
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.userId, ctx.userId),
              gte(auditLogs.createdAt, fromTs),
              lte(auditLogs.createdAt, toTs),
            ),
          )
          .orderBy(desc(auditLogs.createdAt));

        // Summarize by action
        const actionCounts = new Map<string, number>();
        for (const log of logs) {
          actionCounts.set(log.action, (actionCounts.get(log.action) ?? 0) + 1);
        }

        let text =
          `**Audit Export Summary**\n\n` +
          `**Date Range:** ${from_date} to ${to_date}\n` +
          `**Total Records:** ${logs.length}\n\n`;

        if (actionCounts.size > 0) {
          text += `**By Action:**\n`;
          for (const [action, count] of actionCounts) {
            text += `- ${action}: ${count}\n`;
          }
        }

        return textResult(text);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("audit_log_event", "Create a new audit log entry.", {
        action: z.string().min(1).describe("Action performed (e.g., 'api_key.created')."),
        resource_type: z.string().optional().describe("Type of resource (e.g., 'api_key')."),
        resource_id: z.string().optional().describe("ID of the affected resource."),
        metadata: z.string().optional().describe("JSON metadata string."),
      })
      .meta({ category: "audit", tier: "free", stability: "not-implemented" })
      .handler(async ({ input, ctx }) => {
        const { action, resource_type, resource_id, metadata } = input;

        const id = crypto.randomUUID();
        await ctx.db.insert(auditLogs).values({
          id,
          userId: ctx.userId,
          action,
          resourceType: resource_type ?? null,
          resourceId: resource_id ?? null,
          metadata: metadata ?? "{}",
          createdAt: Date.now(),
        });

        return textResult(
          `**Audit log created.**\n\n` +
            `**ID:** ${id}\n` +
            `**Action:** ${action}\n` +
            `**Resource:** ${resource_type ?? "n/a"} / ${resource_id ?? "n/a"}`,
        );
      }),
  );
}
