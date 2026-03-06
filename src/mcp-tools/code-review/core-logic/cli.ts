#!/usr/bin/env node

/**
 * Spike Review CLI
 *
 * Starts the MCP server via stdio transport.
 */

import { startServer } from "../mcp/index.js";

startServer().catch((err: unknown) => {
  process.stderr.write(`Failed to start Spike Review server: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
