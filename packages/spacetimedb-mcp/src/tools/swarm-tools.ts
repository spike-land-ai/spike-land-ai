/**
 * Swarm Tools — Connect, discover tools, and invoke tasks across the MCP Swarm.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpacetimeMcpClient } from "../client.js";
import { errorResult, jsonResult } from "../types.js";

export function registerSwarmTools(server: McpServer, client: SpacetimeMcpClient): void {
  // ─── stdb_connect ───

  server.tool(
    "stdb_connect",
    "Connect to the SpacetimeDB MCP Swarm instance",
    {
      uri: z.string().describe("WebSocket URI (e.g. wss://maincloud.spacetimedb.com)"),
      moduleName: z.string().describe("Module name published to SpacetimeDB"),
      token: z.string().optional().describe("Auth token for reconnection"),
    },
    async ({ uri, moduleName, token }) => {
      try {
        const state = await client.connect(uri, moduleName, token);
        return jsonResult({
          connected: true,
          identity: state.identity,
          token: state.token,
          moduleName: state.moduleName,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Already connected")) {
          return errorResult("ALREADY_CONNECTED", message, false);
        }
        return errorResult("CONNECTION_FAILED", message, true);
      }
    },
  );

  // ─── stdb_disconnect ───

  server.tool(
    "stdb_disconnect",
    "Disconnect from the current SpacetimeDB Swarm",
    {},
    async () => {
      try {
        client.disconnect();
        return jsonResult({ disconnected: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return errorResult("NOT_CONNECTED", message, false);
      }
    },
  );

  // ─── stdb_list_tools ───

  server.tool(
    "stdb_list_tools",
    "List all available tools in the swarm, optionally filtered by category",
    {
      category: z.string().optional().describe("Category filter (e.g. 'code', 'image')"),
    },
    async ({ category }) => {
      try {
        const tools = client.listRegisteredTools(category);
        return jsonResult({
          count: tools.length,
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
            providerIdentity: t.providerIdentity,
            category: t.category,
          })),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) {
          return errorResult("NOT_CONNECTED", message, false);
        }
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );

  // ─── stdb_invoke_tool ───

  server.tool(
    "stdb_invoke_tool",
    "Invoke a remote tool via the swarm",
    {
      toolName: z.string().describe("The name of the tool to invoke"),
      argumentsJson: z.string().describe("JSON string of the tool arguments"),
    },
    async ({ toolName, argumentsJson }) => {
      try {
        await client.invokeToolRequest(toolName, argumentsJson);
        return jsonResult({
          status: "pending",
          message: "Task dispatched to swarm.",
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) {
          return errorResult("NOT_CONNECTED", message, false);
        }
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_list_tasks ───

  server.tool(
    "stdb_list_tasks",
    "List tasks in the swarm, to check status of invoked tools",
    {
      statusFilter: z.string().optional().describe("Filter by 'pending', 'claimed', 'completed', 'failed'"),
    },
    async ({ statusFilter }) => {
      try {
        const tasks = client.listMcpTasks(statusFilter);
        return jsonResult({
          count: tasks.length,
          tasks: tasks.map((t) => ({
            id: t.id.toString(),
            toolName: t.toolName,
            status: t.status,
            resultJson: t.resultJson,
            error: t.error,
          })),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) {
          return errorResult("NOT_CONNECTED", message, false);
        }
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );
}
