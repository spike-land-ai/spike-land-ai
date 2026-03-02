/**
 * Tool registry MCP tools — search, enable, disable, categories, usage stats.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpacetimePlatformClient } from "../client.js";
import { errorResult, jsonResult } from "../types.js";

export function registerToolRegistryTools(
  server: McpServer,
  client: SpacetimePlatformClient,
): void {
  // ─── stdb_search_tools ───

  server.tool(
    "stdb_search_tools",
    "Search for tools by query and/or category",
    {
      query: z.string().optional().describe("Search query (matches name and description)"),
      category: z.string().optional().describe("Filter by category"),
    },
    async ({ query, category }) => {
      try {
        const tools = client.searchTools(query, category);
        return jsonResult({
          count: tools.length,
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            category: t.category,
            enabled: t.enabled,
          })),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );

  // ─── stdb_enable_tool ───

  server.tool(
    "stdb_enable_tool",
    "Enable a tool by name",
    {
      name: z.string().min(1).describe("Tool name to enable"),
    },
    async ({ name }) => {
      try {
        await client.enableTool(name);
        return jsonResult({ enabled: true, name });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_disable_tool ───

  server.tool(
    "stdb_disable_tool",
    "Disable a tool by name",
    {
      name: z.string().min(1).describe("Tool name to disable"),
    },
    async ({ name }) => {
      try {
        await client.disableTool(name);
        return jsonResult({ disabled: true, name });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_list_tool_categories ───

  server.tool("stdb_list_tool_categories", "List all tool categories", {}, async () => {
    try {
      const categories = client.listCategories();
      return jsonResult({ count: categories.length, categories });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
      return errorResult("QUERY_FAILED", message, false);
    }
  });

  // ─── stdb_tool_usage_stats ───

  server.tool(
    "stdb_tool_usage_stats",
    "Get tool usage statistics",
    {
      toolName: z.string().optional().describe("Filter stats by tool name"),
    },
    async ({ toolName }) => {
      try {
        const stats = client.getToolUsageStats(toolName);
        return jsonResult({
          count: stats.length,
          stats: stats.map((s) => ({
            id: s.id.toString(),
            toolName: s.toolName,
            durationMs: s.durationMs,
            success: s.success,
            timestamp: s.timestamp.toString(),
          })),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );
}
