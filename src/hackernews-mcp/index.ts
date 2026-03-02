#!/usr/bin/env node
/**
 * HackerNews MCP Server — Full read + write support.
 *
 * Read: Firebase API (items, users, stories) + Algolia (search)
 * Write: Web scraping (login, submit, vote, comment)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLiveSpacetimeMcpClient } from "@spike-land-ai/spacetimedb-mcp/client";
import { SpacetimeServerTransport } from "@spike-land-ai/spacetimedb-mcp/transport";
import { SessionManager } from "./session/session-manager.js";
import { HNReadClient } from "./clients/hn-read-client.js";
import { HNWriteClient } from "./clients/hn-write-client.js";
import { registerStoriesTools } from "./tools/stories.js";
import { registerItemTools } from "./tools/item.js";
import { registerUserTools } from "./tools/user.js";
import { registerSearchTools } from "./tools/search.js";
import { registerAuthTools } from "./tools/auth.js";
import { registerSubmitTools } from "./tools/submit.js";
import { registerVoteTools } from "./tools/vote.js";
import { registerCommentTools } from "./tools/comment.js";

const server = new McpServer({
  name: "hackernews-mcp",
  version: "0.1.0",
});

// Shared state
const session = new SessionManager();
const readClient = new HNReadClient();
const writeClient = new HNWriteClient(session);

// Register all tools
registerStoriesTools(server, readClient);
registerItemTools(server, readClient);
registerUserTools(server, readClient);
registerSearchTools(server, readClient);
registerAuthTools(server, writeClient, session);
registerSubmitTools(server, writeClient);
registerVoteTools(server, writeClient);
registerCommentTools(server, writeClient);

// Start server on SpacetimeDB Swarm
const client = createLiveSpacetimeMcpClient();
await client.connect("ws://localhost:3000", "spike-platform");

const transport = new SpacetimeServerTransport(client, "hackernews");
await server.connect(transport);

console.log("HackerNews MCP Swarm Node Connected to SpacetimeDB.");
