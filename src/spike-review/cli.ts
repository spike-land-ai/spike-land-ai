#!/usr/bin/env node

/**
 * Spike Review CLI
 *
 * Starts the MCP server via stdio transport.
 */

import { startServer } from "./index.js";

startServer().catch((err: unknown) => {
  console.error("Failed to start Spike Review server:", err);
  process.exit(1);
});
