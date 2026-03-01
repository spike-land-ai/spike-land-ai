/**
 * Error Log Bridge MCP Tools
 *
 * Tools for querying application errors from the ErrorLog database table.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { workspaceTool } from "../tool-builder/procedures";

export function registerSentryBridgeTools(
    registry: ToolRegistry,
    _userId: string,
): void {
    registry.registerBuilt(
        workspaceTool(_userId)
            .tool("error_issues", "List recent application errors grouped by message, sorted by frequency.", {
                query: z.string().optional().describe(
                    "Search query for filtering error messages",
                ),
                limit: z.number().int().min(1).max(100).optional().default(25),
            })
            .meta({ category: "errors", tier: "workspace" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { query, limit = 25 } = input;

                const { listErrorIssues } = await import("@/lib/bridges/error-log");
                const issues = await listErrorIssues({ ...(query !== undefined ? { query } : {}), limit });
                if (issues.length === 0) return textResult("No error issues found.");
                let text = `**Error Issues (${issues.length}):**\n\n`;
                for (const issue of issues) {
                    text += `- **${issue.message}** [${issue.environment}${issue.errorType ? `/${issue.errorType}` : ""
                        }]\n  Count: ${issue.count} | First: ${issue.firstSeen} | Last: ${issue.lastSeen}\n\n`;
                }
                return textResult(text);
            })
    );

    registry.registerBuilt(
        workspaceTool(_userId)
            .tool("error_detail", "Get detailed information about a specific error log entry by ID.", { error_id: z.string().min(1).describe("Error log entry ID") })
            .meta({ category: "errors", tier: "workspace" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { error_id } = input;

                const { getErrorDetail } = await import("@/lib/bridges/error-log");
                const error = await getErrorDetail(error_id);
                if (!error) return textResult("Error not found.");
                return textResult(
                    `**Error: ${error.message}**\n\n`
                    + `- Environment: ${error.environment}\n- Type: ${error.errorType ?? "unknown"
                    }\n- Code: ${error.errorCode ?? "N/A"}\n`
                    + `- Source: ${error.sourceFile ?? "unknown"}${error.sourceLine ? `:${error.sourceLine}` : ""
                    }\n`
                    + `- Caller: ${error.callerName ?? "unknown"}\n- Route: ${error.route ?? "N/A"}\n`
                    + `- Timestamp: ${error.timestamp}\n- ID: ${error.id}`
                    + (error.stack
                        ? `\n\n**Stack:**\n\`\`\`\n${error.stack}\n\`\`\``
                        : ""),
                );
            })
    );

    registry.registerBuilt(
        workspaceTool(_userId)
            .tool("error_stats", "Get error statistics: counts for last 24h, 7d, 30d, grouped by environment.", {})
            .meta({ category: "errors", tier: "workspace" })
            .handler(async ({ input: _input, ctx: _ctx }) => {
                const { getErrorStats } = await import("@/lib/bridges/error-log");
                const stats = await getErrorStats();
                if (!stats) return textResult("Could not fetch error stats.");
                const envLines = Object.entries(stats.byEnvironment)
                    .map(([env, count]) => `  - ${env}: ${count}`)
                    .join("\n");
                return textResult(
                    `**Error Stats:**\n\n`
                    + `- Last 24h: ${stats.last24h}\n- Last 7d: ${stats.last7d}\n- Last 30d: ${stats.last30d}\n`
                    + (envLines ? `\n**By Environment:**\n${envLines}` : ""),
                );
            })
    );
}
