/**
 * MCP Explorer — Standalone MCP Tools
 *
 * Registry discovery, analytics, documentation generation, and health check.
 * Migrated from: mcp-registry.ts, mcp-analytics.ts
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext, StandaloneToolDefinition } from "../shared/types";
import { safeToolCall, textResult } from "../shared/tool-helpers";

/* ── Schemas ──────────────────────────────────────────────────────────── */

const McpRegistrySearchSchema = z.object({
  query: z.string().min(1).max(200).describe("Search query for MCP servers"),
  limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)"),
});

const McpRegistryGetSchema = z.object({
  serverId: z.string().min(1).describe("Server identifier from search results"),
  source: z.enum(["smithery", "official", "glama"]).describe("Which registry the server came from"),
});

const McpRegistryInstallSchema = z.object({
  serverId: z.string().min(1).describe("Server identifier"),
  source: z.enum(["smithery", "official", "glama"]).describe("Registry source"),
  envVars: z
    .record(z.string(), z.string())
    .optional()
    .describe("Environment variables needed by the server"),
});

const PeriodEnum = z.enum(["24h", "7d", "30d", "all"]);

const ToolUsageStatsSchema = z.object({
  period: PeriodEnum.optional()
    .default("7d")
    .describe("Time period for analytics: 24h, 7d, 30d, or all."),
  category: z
    .string()
    .optional()
    .describe("Filter stats to a specific tool category (e.g. 'chess', 'netsim')."),
});

const GenerateDocsSchema = z.object({
  tool_name: z.string().optional().describe("Specific tool name to generate documentation for."),
  category: z
    .string()
    .optional()
    .describe("Category to generate documentation for (all tools in category)."),
});

const HealthCheckSchema = z.object({});

/* ── Helpers ──────────────────────────────────────────────────────────── */

function periodLabel(period: string): string {
  const map: Record<string, string> = {
    "24h": "last 24 hours",
    "7d": "last 7 days",
    "30d": "last 30 days",
    all: "all time",
  };
  return map[period] ?? period;
}

function periodHours(period: string): number {
  const map: Record<string, number> = {
    "24h": 24,
    "7d": 168,
    "30d": 720,
    all: 87600, // 10 years
  };
  return map[period] ?? 168;
}

/* ── Tools ────────────────────────────────────────────────────────────── */

export const mcpExplorerTools: StandaloneToolDefinition[] = [
  {
    name: "mcp_registry_search",
    description:
      "Search across Smithery, Official MCP Registry, and Glama for MCP servers by keyword. Returns server names, descriptions, and sources.",
    category: "mcp-registry",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: McpRegistrySearchSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall(
        "mcp_registry_search",
        async () => {
          const { query, limit = 10 } = input as z.infer<typeof McpRegistrySearchSchema>;
          const { searchAllRegistries } = await import("@/lib/mcp/services/registry-client");
          const results = await searchAllRegistries(query, limit);
          if (results.length === 0) {
            return textResult("No MCP servers found matching your query.");
          }

          let text = `**MCP Servers Found (${results.length}):**\n\n`;
          for (const server of results) {
            text += `- **${server.name}** (${server.source})\n`;
            text += `  ${server.description.slice(0, 200)}\n`;
            text += `  ID: \`${server.id}\` | Transport: ${server.transport}\n`;
            if (server.homepage) text += `  Homepage: ${server.homepage}\n`;
            text += "\n";
          }
          return textResult(text);
        },
        { timeoutMs: 30_000 },
      ),
  },

  {
    name: "mcp_registry_get",
    description:
      "Get detailed information about a specific MCP server including connection config and required environment variables.",
    category: "mcp-registry",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: McpRegistryGetSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall(
        "mcp_registry_get",
        async () => {
          const { serverId, source } = input as z.infer<typeof McpRegistryGetSchema>;
          const { searchSmithery, searchOfficialRegistry, searchGlama } = await import(
            "@/lib/mcp/services/registry-client"
          );

          let results;
          if (source === "smithery") results = await searchSmithery(serverId, 1);
          else if (source === "official") {
            results = await searchOfficialRegistry(serverId, 1);
          } else results = await searchGlama(serverId, 1);

          const server = results.find((s) => s.id === serverId);
          if (!server) {
            return textResult("**Error: NOT_FOUND**\nMCP server not found.\n**Retryable:** false");
          }

          let text = `**${server.name}**\n\n`;
          text += `**Source:** ${server.source}\n`;
          text += `**Transport:** ${server.transport}\n`;
          text += `**URL:** ${server.url}\n`;
          if (server.homepage) text += `**Homepage:** ${server.homepage}\n`;
          if (server.envVarsRequired.length > 0) {
            text += `**Required Env Vars:** ${server.envVarsRequired.join(", ")}\n`;
          }
          text += `\n**Description:**\n${server.description}\n`;
          return textResult(text);
        },
        { timeoutMs: 30_000 },
      ),
  },

  {
    name: "mcp_registry_install",
    description:
      "Auto-configure an MCP server by generating a .mcp.json entry. Provide the server ID and any required environment variables.",
    category: "mcp-registry",
    tier: "free",
    inputSchema: McpRegistryInstallSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall(
        "mcp_registry_install",
        async () => {
          const { serverId, source, envVars } = input as z.infer<typeof McpRegistryInstallSchema>;
          const { searchSmithery, searchOfficialRegistry, searchGlama } = await import(
            "@/lib/mcp/services/registry-client"
          );

          let results;
          if (source === "smithery") results = await searchSmithery(serverId, 1);
          else if (source === "official") {
            results = await searchOfficialRegistry(serverId, 1);
          } else results = await searchGlama(serverId, 1);

          const server = results.find((s) => s.id === serverId);
          if (!server) {
            return textResult("**Error: NOT_FOUND**\nMCP server not found.\n**Retryable:** false");
          }

          const config = {
            [server.name]: {
              transport: server.transport,
              url: server.url,
              ...(envVars && Object.keys(envVars).length > 0 ? { env: envVars } : {}),
            },
          };

          return textResult(
            `**MCP Server Configured:** ${server.name}\n\n` +
              `Add to your \`.mcp.json\`:\n\`\`\`json\n${JSON.stringify(
                config,
                null,
                2,
              )}\n\`\`\`\n\n` +
              `**Transport:** ${server.transport}\n` +
              `**Source:** ${server.source}`,
          );
        },
        { timeoutMs: 30_000 },
      ),
  },

  {
    name: "mcp_registry_list_installed",
    description: "List all currently configured MCP servers from .mcp.json.",
    category: "mcp-registry",
    tier: "free",
    annotations: { readOnlyHint: true },
    handler: async (_input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("mcp_registry_list_installed", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");

        const mcpJsonPath = path.join(process.cwd(), ".mcp.json");
        if (!fs.existsSync(mcpJsonPath)) {
          return textResult("No .mcp.json found. No MCP servers are configured.");
        }

        const content = fs.readFileSync(mcpJsonPath, "utf-8");
        const config = JSON.parse(content) as Record<string, unknown>;
        const mcpServers = (config.mcpServers ?? config) as Record<string, unknown>;
        const serverNames = Object.keys(mcpServers);

        if (serverNames.length === 0) {
          return textResult("No MCP servers configured in .mcp.json.");
        }

        let text = `**Configured MCP Servers (${serverNames.length}):**\n\n`;
        for (const name of serverNames) {
          const server = mcpServers[name] as Record<string, unknown>;
          text += `- **${name}**: transport=${String(server.transport ?? "unknown")}`;
          if (server.url) text += `, url=${String(server.url)}`;
          text += "\n";
        }
        return textResult(text);
      }),
  },

  {
    name: "mcp_tool_usage_stats",
    description:
      "Get analytics on MCP tool usage: most-called tools, total invocations, average response time, and error rate. Filter by time period (24h, 7d, 30d, all) and optional category.",
    category: "mcp-analytics",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: ToolUsageStatsSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("mcp_tool_usage_stats", async () => {
        const { period, category } = input as z.infer<typeof ToolUsageStatsSchema>;
        const prisma = (await import("@/lib/prisma")).default;
        const hours = periodHours(period ?? "7d");
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        const where = {
          userId: ctx.userId,
          createdAt: { gte: since },
          ...(category ? { tool: { startsWith: category.replace(/-/g, "_") } } : {}),
        };

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

        const topToolNames = perToolStats.map((s) => s.tool);
        const perToolErrors =
          topToolNames.length > 0
            ? await prisma.toolInvocation.groupBy({
                by: ["tool"],
                where: { ...where, isError: true, tool: { in: topToolNames } },
                _count: { tool: true },
              })
            : [];
        const errorMap = new Map(perToolErrors.map((e) => [e.tool, e._count?.tool ?? 0]));

        const topTools = perToolStats.map((stats) => {
          const avgMs = Math.round(stats._avg?.durationMs ?? 0);
          const toolCount = stats._count?.tool ?? 0;
          const errors = errorMap.get(stats.tool) ?? 0;
          const errPct = toolCount > 0 ? ((errors / toolCount) * 100).toFixed(0) : "0";
          return `  - **${stats.tool}**: ${toolCount} calls | avg ${avgMs}ms | ${errPct}% errors`;
        });

        const label = periodLabel(period ?? "7d");
        const categoryLine = category ? ` (category: ${category})` : "";

        return textResult(
          `**MCP Tool Usage Stats — ${label}${categoryLine}**\n\n` +
            `**Total Calls:** ${totalCalls}\n` +
            `**Error Rate:** ${errorRate}%\n` +
            `**Avg Response Time:** ${avgDurationMs}ms\n\n` +
            `**Top Tools by Usage:**\n` +
            topTools.join("\n"),
        );
      }),
  },

  {
    name: "mcp_generate_docs",
    description:
      "Generate markdown documentation for a specific MCP tool or all tools in a category. Includes description, input parameters, example usage, and error codes.",
    category: "mcp-analytics",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: GenerateDocsSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("mcp_generate_docs", async () => {
        const { tool_name, category } = input as z.infer<typeof GenerateDocsSchema>;
        if (!tool_name && !category) {
          return textResult("Provide either `tool_name` or `category` to generate documentation.");
        }

        // In standalone mode, document the tools in this server
        const allTools = mcpExplorerTools;

        if (tool_name) {
          const tool = allTools.find((t) => t.name === tool_name);
          if (!tool) {
            const available = allTools
              .slice(0, 5)
              .map((t) => t.name)
              .join(", ");
            return textResult(
              `Tool "${tool_name}" not found. Examples of available tools: ${available}...`,
            );
          }

          const params = tool.inputSchema
            ? Object.entries(tool.inputSchema)
                .map(([key, schema]) => {
                  const s = schema as { description?: string; _def?: { typeName?: string } };
                  const typeHint = s._def?.typeName?.replace("Zod", "").toLowerCase() ?? "unknown";
                  const desc = s.description ?? "No description";
                  return `  - \`${key}\` (${typeHint}): ${desc}`;
                })
                .join("\n")
            : "  No parameters.";

          return textResult(
            `# ${tool.name}\n\n` +
              `**Category:** ${tool.category}\n` +
              `**Tier:** ${tool.tier}\n\n` +
              `## Description\n\n${tool.description}\n\n` +
              `## Parameters\n\n${params}\n\n` +
              `## Example Usage\n\n` +
              `\`\`\`json\n` +
              `{\n  "name": "${tool.name}",\n  "arguments": {}\n}\n` +
              `\`\`\`\n\n` +
              `## Error Codes\n\n` +
              `- \`INVALID_INPUT\`: Required parameters missing or invalid\n` +
              `- \`PERMISSION_DENIED\`: Insufficient permissions\n` +
              `- \`RATE_LIMITED\`: Too many requests, retry after backoff\n` +
              `- \`UNKNOWN\`: Unexpected error, see message for details`,
          );
        }

        // category docs
        const catTools = allTools.filter((t) => t.category === category);
        if (catTools.length === 0) {
          const categories = [...new Set(allTools.map((t) => t.category))].slice(0, 10).join(", ");
          return textResult(
            `No tools found for category "${category}". Available categories include: ${categories}`,
          );
        }

        const toolDocs = catTools.map((tool) => {
          const paramCount = tool.inputSchema ? Object.keys(tool.inputSchema).length : 0;
          return `### \`${tool.name}\`\n\n${tool.description}\n\n- **Parameters:** ${paramCount}\n- **Tier:** ${tool.tier}`;
        });

        return textResult(
          `# ${category} — Tool Category Documentation\n\n` +
            `**${catTools.length} tool(s)** in this category.\n\n` +
            toolDocs.join("\n\n---\n\n"),
        );
      }),
  },

  {
    name: "mcp_health_check",
    description:
      "Check the health of the MCP service: service status, available tool count, enabled tool count, and last recorded error for the current user.",
    category: "mcp-analytics",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: HealthCheckSchema.shape,
    handler: async (_input: never, ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("mcp_health_check", async () => {
        const startMs = Date.now();
        const prisma = (await import("@/lib/prisma")).default;

        const [lastError, totalInvocations] = await Promise.all([
          prisma.toolInvocation.findFirst({
            where: { userId: ctx.userId, isError: true },
            orderBy: { createdAt: "desc" },
            select: { tool: true, error: true, createdAt: true },
          }),
          prisma.toolInvocation.count({ where: { userId: ctx.userId } }),
        ]);

        const responseMs = Date.now() - startMs;

        // In standalone mode, all tools are enabled
        const totalTools = mcpExplorerTools.length;
        const enabledTools = mcpExplorerTools.length;

        const lastErrorLine = lastError
          ? `**Last Error:**\n` +
            `  - Tool: ${lastError.tool}\n` +
            `  - Message: ${lastError.error ?? "unknown"}\n` +
            `  - At: ${lastError.createdAt.toISOString()}`
          : "**Last Error:** None recorded.";

        return textResult(
          `**MCP Service Health Check**\n\n` +
            `**Status:** healthy\n` +
            `**DB Response Time:** ${responseMs}ms\n` +
            `**Total Tools Registered:** ${totalTools}\n` +
            `**Enabled Tools:** ${enabledTools}\n` +
            `**Total Invocations (this user):** ${totalInvocations}\n\n` +
            lastErrorLine,
        );
      }),
  },
];
