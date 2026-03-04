/**
 * whatsapp_send_message — Send a text message via WhatsApp.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WhatsAppClient } from "../clients/whatsapp-client.js";
import { errorResult, jsonResult, tryCatch } from "../types.js";

export function registerSendMessageTool(server: McpServer, client: WhatsAppClient): void {
  server.tool(
    "whatsapp_send_message",
    "Send a text message to a WhatsApp number",
    {
      to: z.string().min(1).describe("Recipient phone number in E.164 format (e.g. +1234567890)"),
      body: z.string().min(1).describe("Message text to send"),
    },
    async ({ to, body }) => {
      const result = await tryCatch(client.sendMessage(to, body));
      if (!result.ok) {
        return errorResult("NETWORK_ERROR", result.error.message, true);
      }
      return jsonResult({
        status: "sent",
        messageId: result.data.messages[0]?.id,
        to,
      });
    },
  );
}
