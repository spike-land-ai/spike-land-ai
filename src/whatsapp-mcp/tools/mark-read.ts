/**
 * whatsapp_mark_read — Mark a message as read.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WhatsAppClient } from "../clients/whatsapp-client.js";
import { errorResult, jsonResult, tryCatch } from "../types.js";

export function registerMarkReadTool(server: McpServer, client: WhatsAppClient): void {
  server.tool(
    "whatsapp_mark_read",
    "Mark a WhatsApp message as read (sends blue checkmarks)",
    {
      messageId: z.string().min(1).describe("The wamid of the message to mark as read"),
    },
    async ({ messageId }) => {
      const result = await tryCatch(client.markAsRead(messageId));
      if (!result.ok) {
        return errorResult("NETWORK_ERROR", result.error.message, true);
      }
      return jsonResult({ status: "read", messageId });
    },
  );
}
