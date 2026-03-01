/**
 * Direct message MCP tools — send, list, mark read.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpacetimePlatformClient } from "../client.js";
import { errorResult, jsonResult } from "../types.js";

export function registerMessageTools(
  server: McpServer,
  client: SpacetimePlatformClient,
): void {
  // ─── stdb_send_dm ───

  server.tool(
    "stdb_send_dm",
    "Send a direct message to another user",
    {
      toIdentity: z.string().min(1).describe("Recipient user identity"),
      content: z.string().min(1).describe("Message content"),
    },
    async ({ toIdentity, content }) => {
      try {
        await client.sendDM(toIdentity, content);
        return jsonResult({ sent: true, toIdentity, contentLength: content.length });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_list_dms ───

  server.tool(
    "stdb_list_dms",
    "List direct messages, optionally filtered by conversation partner",
    {
      withIdentity: z.string().optional().describe("Filter to conversation with this user"),
      unreadOnly: z.boolean().optional().default(false).describe("Only show unread messages"),
    },
    async ({ withIdentity, unreadOnly }) => {
      try {
        let messages = client.listDMs(withIdentity);
        if (unreadOnly) {
          messages = messages.filter((m) => !m.read);
        }
        return jsonResult({
          count: messages.length,
          messages: messages.map((m) => ({
            id: m.id.toString(),
            fromIdentity: m.fromIdentity,
            toIdentity: m.toIdentity,
            content: m.content,
            read: m.read,
            timestamp: m.timestamp.toString(),
          })),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );

  // ─── stdb_mark_dm_read ───

  server.tool(
    "stdb_mark_dm_read",
    "Mark a direct message as read",
    {
      messageId: z.string().describe("Message ID to mark as read"),
    },
    async ({ messageId }) => {
      try {
        await client.markDMRead(BigInt(messageId));
        return jsonResult({ marked: true, messageId });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );
}
