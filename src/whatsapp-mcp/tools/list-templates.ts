/**
 * whatsapp_list_templates — List message templates for a business account.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WhatsAppClient } from "../clients/whatsapp-client.js";
import { errorResult, jsonResult, tryCatch } from "../types.js";

export function registerListTemplatesTool(server: McpServer, client: WhatsAppClient): void {
  server.tool(
    "whatsapp_list_templates",
    "List approved message templates for a WhatsApp Business account",
    {
      businessId: z.string().min(1).describe("WhatsApp Business Account ID"),
    },
    async ({ businessId }) => {
      const result = await tryCatch(client.getTemplates(businessId));
      if (!result.ok) {
        return errorResult("NETWORK_ERROR", result.error.message, true);
      }
      return jsonResult({
        templates: result.data.data.map((t) => ({
          name: t.name,
          language: t.language,
          status: t.status,
          category: t.category,
        })),
        count: result.data.data.length,
      });
    },
  );
}
