/**
 * whatsapp_send_template — Send a template message via WhatsApp.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WhatsAppClient } from "../clients/whatsapp-client.js";
import { errorResult, jsonResult, tryCatch } from "../types.js";

export function registerSendTemplateTool(server: McpServer, client: WhatsAppClient): void {
  server.tool(
    "whatsapp_send_template",
    "Send a pre-approved template message via WhatsApp",
    {
      to: z.string().min(1).describe("Recipient phone number in E.164 format"),
      templateName: z.string().min(1).describe("Template name as registered in Meta Business"),
      languageCode: z.string().min(1).describe("Language code (e.g. en_US)"),
      components: z
        .string()
        .optional()
        .describe("JSON array of template components (optional)"),
    },
    async ({ to, templateName, languageCode, components }) => {
      let parsedComponents: unknown[] | undefined;
      if (components) {
        try {
          parsedComponents = JSON.parse(components) as unknown[];
        } catch {
          return errorResult("INVALID_INPUT", "Invalid JSON in components parameter", false);
        }
      }

      const result = await tryCatch(
        client.sendTemplate(to, templateName, languageCode, parsedComponents as never),
      );
      if (!result.ok) {
        return errorResult("NETWORK_ERROR", result.error.message, true);
      }
      return jsonResult({
        status: "sent",
        messageId: result.data.messages[0]?.id,
        to,
        template: templateName,
      });
    },
  );
}
