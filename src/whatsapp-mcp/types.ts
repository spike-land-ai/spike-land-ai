/**
 * WhatsApp Cloud API MCP Server — Types & Helpers
 */

// ─── Config ───

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  appSecret?: string;
  verifyToken?: string;
}

// ─── API Base ───

export const META_GRAPH_BASE = "https://graph.facebook.com/v21.0";

// ─── Send Message ───

export interface SendMessageResult {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

// ─── Templates ───

export interface WhatsAppTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
  id: string;
}

export interface TemplateListResult {
  data: WhatsAppTemplate[];
  paging?: { cursors: { before: string; after: string }; next?: string };
}

// ─── Template Components ───

export interface TemplateComponent {
  type: string;
  parameters: Array<{ type: string; text?: string; image?: { link: string } }>;
}

// ─── Result Helpers (re-exported from mcp-server-base) ───

export {
  type CallToolResult,
  errorResult,
  jsonResult,
  tryCatch,
} from "@spike-land-ai/mcp-server-base";
