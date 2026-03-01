/**
 * Agent coordination MCP tools — connect, register, list agents, send/receive messages.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpacetimeClient } from "../client.js";
import { errorResult, jsonResult } from "../types.js";

export function registerAgentTools(
  server: McpServer,
  client: SpacetimeClient,
): void {
  // ─── stdb_connect ───

  server.tool(
    "stdb_connect",
    "Connect to a SpacetimeDB Maincloud instance for agent coordination",
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
    "Disconnect from the current SpacetimeDB instance",
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

  // ─── stdb_register_agent ───

  server.tool(
    "stdb_register_agent",
    "Register the current agent with a display name and capabilities",
    {
      displayName: z.string().min(1).describe("Agent display name"),
      capabilities: z.array(z.string()).describe("List of agent capabilities (e.g. ['code-review', 'testing'])"),
    },
    async ({ displayName, capabilities }) => {
      try {
        await client.registerAgent(displayName, capabilities);
        return jsonResult({
          registered: true,
          displayName,
          capabilities,
          identity: client.getState().identity,
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

  // ─── stdb_list_agents ───

  server.tool(
    "stdb_list_agents",
    "List all registered agents with their online status and capabilities",
    {
      onlineOnly: z.boolean().optional().default(false).describe("Only show online agents"),
    },
    async ({ onlineOnly }) => {
      try {
        let agents = client.listAgents();
        if (onlineOnly) {
          agents = agents.filter((a) => a.online);
        }
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
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) {
          return errorResult("NOT_CONNECTED", message, false);
        }
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );

  // ─── stdb_send_message ───

  server.tool(
    "stdb_send_message",
    "Send a message to another agent by identity",
    {
      toAgent: z.string().describe("Target agent identity (hex string)"),
      content: z.string().min(1).describe("Message content"),
    },
    async ({ toAgent, content }) => {
      try {
        await client.sendMessage(toAgent, content);
        return jsonResult({
          sent: true,
          toAgent,
          contentLength: content.length,
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

  // ─── stdb_get_messages ───

  server.tool(
    "stdb_get_messages",
    "Get messages for the current agent (undelivered by default)",
    {
      includeDelivered: z.boolean().optional().default(false).describe("Include already-delivered messages"),
    },
    async ({ includeDelivered }) => {
      try {
        const messages = client.getMessages(!includeDelivered);
        return jsonResult({
          count: messages.length,
          messages: messages.map((m) => ({
            id: m.id.toString(),
            fromAgent: m.fromAgent,
            content: m.content,
            timestamp: m.timestamp.toString(),
            delivered: m.delivered,
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

  // ─── stdb_mark_delivered ───

  server.tool(
    "stdb_mark_delivered",
    "Mark a message as delivered",
    {
      messageId: z.string().describe("Message ID to mark as delivered"),
    },
    async ({ messageId }) => {
      try {
        await client.markDelivered(BigInt(messageId));
        return jsonResult({ marked: true, messageId });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) {
          return errorResult("NOT_CONNECTED", message, false);
        }
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );
}
