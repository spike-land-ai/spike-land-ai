/**
 * Swarm Tools — Connect, discover tools, and invoke tasks across the MCP Swarm.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpacetimeMcpClient } from "../client.js";
import { errorResult, jsonResult, tryCatch } from "../types.js";

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
      const result = await tryCatch(client.connect(uri, moduleName, token));
      if (!result.ok) {
        if (result.error.message.includes("Already connected")) {
          return errorResult("ALREADY_CONNECTED", result.error.message, false);
        }
        return errorResult("CONNECTION_FAILED", result.error.message, true);
      }
      return jsonResult({
        connected: true,
        identity: result.data.identity,
        token: result.data.token,
        moduleName: result.data.moduleName,
      });
    },
  );

  // ─── stdb_disconnect ───

  server.tool(
    "stdb_disconnect",
    "Disconnect from the current SpacetimeDB Swarm",
    {},
    async () => {
      const result = await tryCatch(Promise.resolve().then(() => client.disconnect()));
      if (!result.ok) return errorResult("NOT_CONNECTED", result.error.message, false);
      return jsonResult({ disconnected: true });
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
      const result = await tryCatch(Promise.resolve(client.listRegisteredTools(category)));
      if (!result.ok) {
        if (result.error.message.includes("Not connected")) {
          return errorResult("NOT_CONNECTED", result.error.message, false);
        }
        return errorResult("QUERY_FAILED", result.error.message, false);
      }
      return jsonResult({
        count: result.data.length,
        tools: result.data.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          providerIdentity: t.providerIdentity,
          category: t.category,
        })),
      });
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
      const result = await tryCatch(client.invokeToolRequest(toolName, argumentsJson));
      if (!result.ok) {
        if (result.error.message.includes("Not connected")) {
          return errorResult("NOT_CONNECTED", result.error.message, false);
        }
        return errorResult("REDUCER_FAILED", result.error.message, true);
      }
      return jsonResult({
        status: "pending",
        message: "Task dispatched to swarm.",
      });
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
      const result = await tryCatch(Promise.resolve(client.listMcpTasks(statusFilter)));
      if (!result.ok) {
        if (result.error.message.includes("Not connected")) {
          return errorResult("NOT_CONNECTED", result.error.message, false);
        }
        return errorResult("QUERY_FAILED", result.error.message, false);
      }
      return jsonResult({
        count: result.data.length,
        tasks: result.data.map((t) => ({
          id: t.id.toString(),
          toolName: t.toolName,
          status: t.status,
          resultJson: t.resultJson,
          error: t.error,
        })),
      });
    },
  );
}
