#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  wrapServerWithLogging,
  registerFeedbackTool,
  createErrorShipper,
} from "@spike-land-ai/mcp-server-base";
import { registerDiscoverTool } from "../core-logic/discover.js";
import { registerAnalyzeTool } from "../core-logic/analyze.js";
import { registerLintTool } from "../core-logic/lint.js";
import { registerApplyTool } from "../core-logic/apply.js";
import { registerStatusTool } from "../core-logic/status.js";

const server = new McpServer({
  name: "reorganize-mcp",
  version: "0.1.0",
});

const shipper = createErrorShipper();
process.on("uncaughtException", (err) =>
  shipper.shipError({
    service_name: "reorganize-mcp",
    message: err.message,
    stack_trace: err.stack,
    severity: "high",
  }),
);
process.on("unhandledRejection", (err: unknown) =>
  shipper.shipError({
    service_name: "reorganize-mcp",
    message: err instanceof Error ? err.message : String(err),
    stack_trace: err instanceof Error ? err.stack : undefined,
    severity: "high",
  }),
);

wrapServerWithLogging(server, "reorganize-mcp");

// Register all tools
registerDiscoverTool(server);
registerAnalyzeTool(server);
registerLintTool(server);
registerApplyTool(server);
registerStatusTool(server);
registerFeedbackTool(server, { serviceName: "reorganize-mcp", toolName: "reorganize_feedback" });

// Start server on stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Reorganize MCP Server running on stdio.\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
