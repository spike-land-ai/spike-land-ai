#!/usr/bin/env node

/**
 * SpacetimeDB MCP Server — Agent Coordination
 *
 * Provides real-time agent state, point-to-point messaging,
 * and task coordination via SpacetimeDB.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLiveSpacetimeMcpClient } from "./client.js";
import { registerSwarmTools } from "./tools/swarm-tools.js";

const server = new McpServer({
  name: "spacetimedb-mcp",
  version: "0.1.0",
});

const client = createLiveSpacetimeMcpClient();

registerSwarmTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
