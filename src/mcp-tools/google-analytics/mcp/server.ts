#!/usr/bin/env node
/**
 * Google Analytics 4 MCP Server
 *
 * Provides read-only access to GA4 Data API (reports, realtime, metadata)
 * and GA4 Admin API (list properties) via OAuth2 refresh-token flow.
 *
 * Required environment variables:
 *   GOOGLE_CLIENT_ID        — OAuth2 client ID
 *   GOOGLE_CLIENT_SECRET    — OAuth2 client secret
 *   GOOGLE_REFRESH_TOKEN    — Long-lived refresh token
 *   GA_PROPERTY_ID          — GA4 property ID (numeric, without "properties/" prefix)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  wrapServerWithLogging,
  registerFeedbackTool,
  createErrorShipper,
} from "@spike-land-ai/mcp-server-base";
import { GoogleAuthClient } from "../core-logic/google-oauth.js";
import { registerReportTools } from "./reports.js";
import { registerRealtimeTool } from "./realtime.js";
import { registerMetadataTools } from "./metadata.js";

const SERVICE_NAME = "google-analytics-mcp";

// ── Validate required environment variables ─────────────────────────────────

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GA_PROPERTY_ID } =
  process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
  process.stderr.write(
    `[${SERVICE_NAME}] ERROR: Missing required OAuth2 credentials.\n` +
      `Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.\n`,
  );
  process.exit(1);
}

if (!GA_PROPERTY_ID) {
  process.stderr.write(
    `[${SERVICE_NAME}] ERROR: GA_PROPERTY_ID is required (numeric property ID, e.g. "123456789").\n`,
  );
  process.exit(1);
}

// ── Build auth client ────────────────────────────────────────────────────────

const auth = new GoogleAuthClient({
  clientId: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  refreshToken: GOOGLE_REFRESH_TOKEN,
});

// ── Create MCP server ────────────────────────────────────────────────────────

const server = new McpServer({
  name: SERVICE_NAME,
  version: "0.1.0",
});

// ── Error handling ───────────────────────────────────────────────────────────

const shipper = createErrorShipper();

process.on("uncaughtException", (err) => {
  shipper.shipError({
    service_name: SERVICE_NAME,
    message: err.message,
    stack_trace: err.stack,
    severity: "high",
  });
});

process.on("unhandledRejection", (err: unknown) => {
  shipper.shipError({
    service_name: SERVICE_NAME,
    message: err instanceof Error ? err.message : String(err),
    stack_trace: err instanceof Error ? err.stack : undefined,
    severity: "high",
  });
});

// ── Register tools ───────────────────────────────────────────────────────────

wrapServerWithLogging(server, SERVICE_NAME);

registerReportTools(server, auth, GA_PROPERTY_ID);
registerRealtimeTool(server, auth, GA_PROPERTY_ID);
registerMetadataTools(server, auth, GA_PROPERTY_ID);
registerFeedbackTool(server, {
  serviceName: SERVICE_NAME,
  toolName: "google_analytics_feedback",
});

// ── Start ────────────────────────────────────────────────────────────────────

void (async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`${SERVICE_NAME} running on stdio.\n`);
})();
