#!/usr/bin/env node

/**
 * SpacetimeDB Platform MCP Server
 *
 * Provides real-time platform operations: users, apps, tools, content,
 * messaging, and analytics via SpacetimeDB.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLivePlatformClient } from "./client-live.js";
import { registerAnalyticsTools } from "./tools/analytics-tools.js";
import { registerAppTools } from "./tools/app-tools.js";
import { registerContentTools } from "./tools/content-tools.js";
import { registerMessageTools } from "./tools/message-tools.js";
import { registerToolRegistryTools } from "./tools/tool-registry-tools.js";
import { registerUserTools } from "./tools/user-tools.js";

const server = new McpServer({
  name: "spacetimedb-platform",
  version: "0.1.0",
});

const client = createLivePlatformClient();

registerUserTools(server, client);
registerAppTools(server, client);
registerToolRegistryTools(server, client);
registerContentTools(server, client);
registerMessageTools(server, client);
registerAnalyticsTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
