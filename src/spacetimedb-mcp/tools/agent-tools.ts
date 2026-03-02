/**
 * Agent Tools — Connect to SpacetimeDB and coordinate via agents and messages.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpacetimeClient } from "../client.js";
import { errorResult, jsonResult, tryCatch } from "../types.js";

export function registerAgentTools(server: McpServer, client: SpacetimeClient): void {
  // ─── stdb_connect ───

  server.tool(
    "stdb_connect",
    "Connect to a SpacetimeDB instance",
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
    "Disconnect from the current SpacetimeDB instance",
    {},
    async () => {
      const result = await tryCatch(
        (async () => client.disconnect())(),
      );
      if (!result.ok) return errorResult("NOT_CONNECTED", result.error.message, false);
      return jsonResult({ disconnected: true });
    },
  );

  // ─── stdb_register_agent ───

  server.tool(
    "stdb_register_agent",
    "Register this agent with a display name and capabilities",
    {
      displayName: z.string().describe("Human-readable agent name"),
      capabilities: z.array(z.string()).describe("List of capability tags"),
    },
    async ({ displayName, capabilities }) => {
      const state = client.getState();
      if (!state.connected) {
        return errorResult("NOT_CONNECTED", "Not connected to SpacetimeDB", false);
      }
      const result = await tryCatch(client.registerAgent(displayName, capabilities));
      if (!result.ok) return errorResult("REDUCER_FAILED", result.error.message, true);
      return jsonResult({ registered: true, displayName, capabilities });
    },
  );

  // ─── stdb_list_agents ───

  server.tool(
    "stdb_list_agents",
    "List all registered agents, optionally filtering to online-only",
    {
      onlineOnly: z.boolean().optional().describe("Return only online agents"),
    },
    async ({ onlineOnly }) => {
      const state = client.getState();
      if (!state.connected) {
        return errorResult("NOT_CONNECTED", "Not connected to SpacetimeDB", false);
      }
      const result = await tryCatch(
        (async () => client.listAgents())(),
      );
      if (!result.ok) return errorResult("QUERY_FAILED", result.error.message, false);
      const agents = onlineOnly ? result.data.filter((a) => a.online) : result.data;
      return jsonResult({
        count: agents.length,
        agents: agents.map((a) => ({
          identity: a.identity,
          displayName: a.displayName,
          capabilities: a.capabilities,
          online: a.online,
          lastSeen: a.lastSeen.toString(),
        })),
      });
    },
  );

  // ─── stdb_send_message ───

  server.tool(
    "stdb_send_message",
    "Send a direct message to another agent",
    {
      toAgent: z.string().describe("Recipient agent identity"),
      content: z.string().describe("Message content"),
    },
    async ({ toAgent, content }) => {
      const state = client.getState();
      if (!state.connected) {
        return errorResult("NOT_CONNECTED", "Not connected to SpacetimeDB", false);
      }
      const result = await tryCatch(client.sendMessage(toAgent, content));
      if (!result.ok) return errorResult("REDUCER_FAILED", result.error.message, true);
      return jsonResult({ sent: true, toAgent, contentLength: content.length });
    },
  );

  // ─── stdb_get_messages ───

  server.tool(
    "stdb_get_messages",
    "Get messages addressed to this agent",
    {
      includeDelivered: z.boolean().optional().describe("Include already-delivered messages"),
    },
    async ({ includeDelivered }) => {
      const state = client.getState();
      if (!state.connected) {
        return errorResult("NOT_CONNECTED", "Not connected to SpacetimeDB", false);
      }
      const onlyUndelivered = !includeDelivered;
      const result = await tryCatch(
        (async () => client.getMessages(onlyUndelivered))(),
      );
      if (!result.ok) return errorResult("QUERY_FAILED", result.error.message, false);
      return jsonResult({
        count: result.data.length,
        messages: result.data.map((m) => ({
          id: m.id.toString(),
          fromAgent: m.fromAgent,
          toAgent: m.toAgent,
          content: m.content,
          timestamp: m.timestamp.toString(),
          delivered: m.delivered,
        })),
      });
    },
  );

  // ─── stdb_mark_delivered ───

  server.tool(
    "stdb_mark_delivered",
    "Mark a message as delivered",
    {
      messageId: z.string().describe("Message ID to mark as delivered"),
    },
    async ({ messageId }) => {
      const state = client.getState();
      if (!state.connected) {
        return errorResult("NOT_CONNECTED", "Not connected to SpacetimeDB", false);
      }
      const result = await tryCatch(client.markDelivered(BigInt(messageId)));
      if (!result.ok) return errorResult("REDUCER_FAILED", result.error.message, true);
      return jsonResult({ marked: true, messageId });
    },
  );
}
