#!/usr/bin/env node
/**
 * HackerNews MCP Server — Full read + write support.
 *
 * Read: Firebase API (items, users, stories) + Algolia (search)
 * Write: Web scraping (login, submit, vote, comment)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

// Start server on stdio
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("HackerNews MCP Server running on stdio.");
