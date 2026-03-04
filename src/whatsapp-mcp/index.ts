#!/usr/bin/env node
/**
 * WhatsApp Cloud API MCP Server.
 *
 * Provides tools for sending messages, templates, and managing read receipts
 * via Meta's WhatsApp Business Cloud API.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WhatsAppClient } from "./clients/whatsapp-client.js";
import { registerSendMessageTool } from "./tools/send-message.js";
import { registerSendTemplateTool } from "./tools/send-template.js";
import { registerListTemplatesTool } from "./tools/list-templates.js";
import { registerMarkReadTool } from "./tools/mark-read.js";

const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

if (!accessToken || !phoneNumberId) {
  console.error(
    "Missing required environment variables: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID",
  );
  process.exit(1);
}

const server = new McpServer({
  name: "whatsapp-mcp",
  version: "0.1.0",
});

const client = new WhatsAppClient({ accessToken, phoneNumberId });

registerSendMessageTool(server, client);
registerSendTemplateTool(server, client);
registerListTemplatesTool(server, client);
registerMarkReadTool(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error("WhatsApp MCP Server running on stdio.");
