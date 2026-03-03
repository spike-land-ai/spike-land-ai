/**
 * MCP Analytics Tools
 *
 * Analytics, documentation generation, and health check tools
 * for the spike.land MCP platform.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

// --- Zod schemas ---

const PeriodEnum = z.enum(["24h", "7d", "30d", "all"]);

const ToolUsageStatsSchema = z.object({
  period: PeriodEnum.optional().default("7d").describe(
    "Time period for analytics: 24h, 7d, 30d, or all.",
  ),
  category: z.string().optional().describe(
    "Filter stats to a specific tool category (e.g. 'chess', 'netsim').",
  ),
});

const GenerateDocsSchema = z.object({
  tool_name: z.string().optional().describe(
    "Specific tool name to generate documentation for.",
  ),
  category: z.string().optional().describe(
    "Category to generate documentation for (all tools in category).",
  ),
});

const HealthCheckSchema = z.object({});

// --- Period label helpers ---

function periodLabel(period: string): string {
  const map: Record<string, string> = {
    "24h": "last 24 hours",
    "7d": "last 7 days",
    "30d": "last 30 days",
    "all": "all time",
  };
  return map[period] ?? period;
}

function periodHours(period: string): number {
  const map: Record<string, number> = {
    "24h": 24,
    "7d": 168,
    "30d": 720,
    "all": 87600, // 10 years
  };
  return map[period] ?? 168;
}

// --- Registration ---

export function registerMcpAnalyticsTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "mcp_tool_usage_stats",
    description:
      "Get analytics on MCP tool usage: most-called tools, total invocations, average response time, and error rate. Filter by time period (24h, 7d, 30d, all) and optional category.",
    category: "mcp-analytics",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: ToolUsageStatsSchema.shape,
    handler: async (
      { period, category }: z.infer<typeof ToolUsageStatsSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("mcp_tool_usage_stats", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const hours = periodHours(period ?? "7d");
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        const where = {
          userId,
          createdAt: { gte: since },
          ...(category
            ? { tool: { startsWith: category.replace(/-/g, "_") } }
            : {}),
        };

        // Use SQL aggregation instead of loading rows into memory
        const [totalAgg, errorAgg, durationAgg, perToolStats] = await Promise.all([
          prisma.toolInvocation.count({ where }),
          prisma.toolInvocation.count({ where: { ...where, isError: true } }),
          prisma.toolInvocation.aggregate({
            where,
            _avg: { durationMs: true },
          }),
          prisma.toolInvocation.groupBy({
            by: ["tool"],
            where,
            _count: { tool: true },
            _avg: { durationMs: true },
            _sum: { durationMs: true },
            orderBy: { _count: { tool: "desc" } },
            take: 10,
          }),
        ]);

        const totalCalls = totalAgg;
        if (totalCalls === 0) {
          return textResult(
            `No tool invocations found for the ${periodLabel(period ?? "7d")}${
              category ? ` in category "${category}"` : ""
            }.`,
          );
        }

        const errorCalls = errorAgg;
        const errorRate = ((errorCalls / totalCalls) * 100).toFixed(1);
        const avgDurationMs = Math.round(durationAgg._avg.durationMs ?? 0);

        // Per-tool error counts for the top tools
        const topToolNames = perToolStats.map(s => s.tool);
        const perToolErrors = topToolNames.length > 0
          ? await prisma.toolInvocation.groupBy({
            by: ["tool"],
            where: { ...where, isError: true, tool: { in: topToolNames } },
            _count: { tool: true },
          })
          : [];
        const errorMap = new Map(perToolErrors.map(e => [e.tool, e._count?.tool ?? 0]));

        const topTools = perToolStats.map(stats => {
          const avgMs = Math.round(stats._avg?.durationMs ?? 0);
          const toolCount = stats._count?.tool ?? 0;
          const errors = errorMap.get(stats.tool) ?? 0;
          const errPct = toolCount > 0 ? ((errors / toolCount) * 100).toFixed(0) : "0";
          return `  - **${stats.tool}**: ${toolCount} calls | avg ${avgMs}ms | ${errPct}% errors`;
        });

        const label = periodLabel(period ?? "7d");
        const categoryLine = category ? ` (category: ${category})` : "";

        return textResult(
          `**MCP Tool Usage Stats — ${label}${categoryLine}**\n\n`
            + `**Total Calls:** ${totalCalls}\n`
            + `**Error Rate:** ${errorRate}%\n`
            + `**Avg Response Time:** ${avgDurationMs}ms\n\n`
            + `**Top Tools by Usage:**\n`
            + topTools.join("\n"),
        );
      }, { userId }),
  });

  registry.register({
    name: "mcp_generate_docs",
    description:
      "Generate markdown documentation for a specific MCP tool or all tools in a category. Includes description, input parameters, example usage, and error codes.",
    category: "mcp-analytics",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: GenerateDocsSchema.shape,
    handler: async (
      { tool_name, category }: z.infer<typeof GenerateDocsSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("mcp_generate_docs", async () => {
        if (!tool_name && !category) {
          return textResult(
            "Provide either `tool_name` or `category` to generate documentation.",
          );
        }

        const allTools = registry.getToolDefinitions();

        if (tool_name) {
          const tool = allTools.find(t => t.name === tool_name);
          if (!tool) {
            const available = allTools.slice(0, 5).map(t => t.name).join(", ");
            return textResult(
              `Tool "${tool_name}" not found. Examples of available tools: ${available}...`,
            );
          }

          const params = tool.inputSchema
            ? Object.entries(tool.inputSchema)
              .map(([key, schema]) => {
                const s = schema as { description?: string; _def?: { typeName?: string; }; };
                const typeHint = s._def?.typeName?.replace("Zod", "").toLowerCase() ?? "unknown";
                const desc = s.description ?? "No description";
                return `  - \`${key}\` (${typeHint}): ${desc}`;
              })
              .join("\n")
            : "  No parameters.";

          const toolTier = "tier" in tool
            ? (tool as { tier?: string; }).tier ?? "free"
            : "free";

          return textResult(
            `# ${tool.name}\n\n`
              + `**Category:** ${tool.category}\n`
              + `**Tier:** ${toolTier}\n\n`
              + `## Description\n\n${tool.description}\n\n`
              + `## Parameters\n\n${params}\n\n`
              + `## Example Usage\n\n`
              + `\`\`\`json\n`
              + `{\n  "name": "${tool.name}",\n  "arguments": {}\n}\n`
              + `\`\`\`\n\n`
              + `## Error Codes\n\n`
              + `- \`INVALID_INPUT\`: Required parameters missing or invalid\n`
              + `- \`PERMISSION_DENIED\`: Insufficient permissions\n`
              + `- \`RATE_LIMITED\`: Too many requests, retry after backoff\n`
              + `- \`UNKNOWN\`: Unexpected error, see message for details`,
          );
        }

        // category docs
        const catTools = allTools.filter(t => t.category === category);
        if (catTools.length === 0) {
          const categories = [...new Set(allTools.map(t => t.category))].slice(0, 10).join(", ");
          return textResult(
            `No tools found for category "${category}". Available categories include: ${categories}`,
          );
        }

        const toolDocs = catTools.map(tool => {
          const paramCount = tool.inputSchema
            ? Object.keys(tool.inputSchema).length
            : 0;
          const toolTier = "tier" in tool
            ? (tool as { tier?: string; }).tier ?? "free"
            : "free";
          return `### \`${tool.name}\`\n\n${tool.description}\n\n- **Parameters:** ${paramCount}\n- **Tier:** ${toolTier}`;
        });

        return textResult(
          `# ${category} — Tool Category Documentation\n\n`
            + `**${catTools.length} tool(s)** in this category.\n\n`
            + toolDocs.join("\n\n---\n\n"),
        );
      }, { userId }),
  });

  registry.register({
    name: "mcp_health_check",
    description:
      "Check the health of the MCP service: service status, available tool count, enabled tool count, and last recorded error for the current user.",
    category: "mcp-analytics",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: HealthCheckSchema.shape,
    handler: async (_args: z.infer<typeof HealthCheckSchema>): Promise<CallToolResult> =>
      safeToolCall("mcp_health_check", async () => {
        const startMs = Date.now();
        const prisma = (await import("@/lib/prisma")).default;

        const [lastError, totalInvocations] = await Promise.all([
          prisma.toolInvocation.findFirst({
            where: { userId, isError: true },
            orderBy: { createdAt: "desc" },
            select: { tool: true, error: true, createdAt: true },
          }),
          prisma.toolInvocation.count({ where: { userId } }),
        ]);

        const responseMs = Date.now() - startMs;

        const totalTools = registry.getToolCount();
        const enabledTools = registry.getEnabledCount();

        const lastErrorLine = lastError
          ? `**Last Error:**\n`
            + `  - Tool: ${lastError.tool}\n`
            + `  - Message: ${lastError.error ?? "unknown"}\n`
            + `  - At: ${lastError.createdAt.toISOString()}`
          : "**Last Error:** None recorded.";

        return textResult(
          `**MCP Service Health Check**\n\n`
            + `**Status:** healthy\n`
            + `**DB Response Time:** ${responseMs}ms\n`
            + `**Total Tools Registered:** ${totalTools}\n`
            + `**Enabled Tools:** ${enabledTools}\n`
            + `**Total Invocations (this user):** ${totalInvocations}\n\n`
            + lastErrorLine,
        );
      }, { userId }),
  });
}
