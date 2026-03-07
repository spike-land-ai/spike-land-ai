#!/usr/bin/env node
/**
 * HackerNews MCP Server — Full read + write support.
 *
 * Read: Firebase API (items, users, stories) + Algolia (search)
 * Write: Web scraping (login, submit, vote, comment)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { wrapServerWithLogging, registerFeedbackTool, createErrorShipper } from "@spike-land-ai/mcp-server-base";
import { SessionManager } from "../core-logic/session-manager.js";
import { HNReadClient } from "../core-logic/hn-read-client.js";
import { HNWriteClient } from "../core-logic/hn-write-client.js";
import { registerStoriesTools } from "../core-logic/stories.js";
import { registerItemTools } from "../core-logic/item.js";
import { registerUserTools } from "../core-logic/user.js";
import { registerSearchTools } from "../core-logic/search.js";
import { registerAuthTools } from "../core-logic/auth.js";
import { registerSubmitTools } from "../core-logic/submit.js";
import { registerVoteTools } from "../core-logic/vote.js";
import { registerCommentTools } from "../core-logic/comment.js";

const server = new McpServer({
  name: "hackernews-mcp",
  version: "0.1.0",
});

const shipper = createErrorShipper();
process.on('uncaughtException', (err) => shipper.shipError({ service_name: "hackernews-mcp", message: err.message, stack_trace: err.stack, severity: "high" }));
process.on('unhandledRejection', (err: unknown) => shipper.shipError({ service_name: "hackernews-mcp", message: err instanceof Error ? err.message : String(err), stack_trace: err instanceof Error ? err.stack : undefined, severity: "high" }));

wrapServerWithLogging(server, "hackernews-mcp");

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
registerFeedbackTool(server, { serviceName: "hackernews-mcp", toolName: "hackernews_feedback" });

// Start server on stdio
const transport = new StdioServerTransport();
await server.connect(transport);

process.stderr.write("HackerNews MCP Server running on stdio.\n");
