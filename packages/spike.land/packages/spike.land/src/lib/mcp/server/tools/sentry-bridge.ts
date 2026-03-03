/**
 * Error Log Bridge MCP Tools
 *
 * Tools for querying application errors from the ErrorLog database table.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

export function registerSentryBridgeTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  registry.register({
    name: "error_issues",
    description: "List recent application errors grouped by message, sorted by frequency.",
    category: "errors",
    tier: "workspace",
    alwaysEnabled: true,
    inputSchema: {
      query: z.string().optional().describe(
        "Search query for filtering error messages",
      ),
      limit: z.number().int().min(1).max(100).optional().default(25),
    },
    handler: async (
      { query, limit = 25 }: { query?: string; limit?: number; },
    ): Promise<CallToolResult> =>
      safeToolCall("error_issues", async () => {
        const { listErrorIssues } = await import("@/lib/bridges/error-log");
        const issues = await listErrorIssues({ query, limit });
        if (issues.length === 0) return textResult("No error issues found.");
        let text = `**Error Issues (${issues.length}):**\n\n`;
        for (const issue of issues) {
          text += `- **${issue.message}** [${issue.environment}${
            issue.errorType ? `/${issue.errorType}` : ""
          }]\n  Count: ${issue.count} | First: ${issue.firstSeen} | Last: ${issue.lastSeen}\n\n`;
        }
        return textResult(text);
      }),
  });

  registry.register({
    name: "error_detail",
    description: "Get detailed information about a specific error log entry by ID.",
    category: "errors",
    tier: "workspace",
    alwaysEnabled: true,
    inputSchema: { error_id: z.string().min(1).describe("Error log entry ID") },
    handler: async (
      { error_id }: { error_id: string; },
    ): Promise<CallToolResult> =>
      safeToolCall("error_detail", async () => {
        const { getErrorDetail } = await import("@/lib/bridges/error-log");
        const error = await getErrorDetail(error_id);
        if (!error) return textResult("Error not found.");
        return textResult(
          `**Error: ${error.message}**\n\n`
            + `- Environment: ${error.environment}\n- Type: ${
              error.errorType ?? "unknown"
            }\n- Code: ${error.errorCode ?? "N/A"}\n`
            + `- Source: ${error.sourceFile ?? "unknown"}${
              error.sourceLine ? `:${error.sourceLine}` : ""
            }\n`
            + `- Caller: ${error.callerName ?? "unknown"}\n- Route: ${error.route ?? "N/A"}\n`
            + `- Timestamp: ${error.timestamp}\n- ID: ${error.id}`
            + (error.stack
              ? `\n\n**Stack:**\n\`\`\`\n${error.stack}\n\`\`\``
              : ""),
        );
      }),
  });

  registry.register({
    name: "error_stats",
    description: "Get error statistics: counts for last 24h, 7d, 30d, grouped by environment.",
    category: "errors",
    tier: "workspace",
    alwaysEnabled: true,
    inputSchema: {},
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("error_stats", async () => {
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
      }),
  });
}
