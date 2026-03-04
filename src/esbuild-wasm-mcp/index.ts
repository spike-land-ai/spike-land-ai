#!/usr/bin/env node
import { createMcpServer, startMcpServer, wrapServerWithLogging } from "@spike-land-ai/mcp-server-base";
import { registerInitializeTool } from "./tools/initialize.js";
import { registerStatusTool } from "./tools/status.js";
import { registerTransformTool } from "./tools/transform.js";
import { registerBuildTool } from "./tools/build.js";
import { registerAnalyzeTool } from "./tools/analyze.js";
import { registerFormatMessagesTool } from "./tools/format-messages.js";
import { registerContextTool } from "./tools/context.js";

const server = createMcpServer({
  name: "esbuild-wasm-mcp",
  version: "0.27.4",
});

wrapServerWithLogging(server, "esbuild-wasm-mcp");

registerInitializeTool(server);
registerStatusTool(server);
registerTransformTool(server);
registerBuildTool(server);
registerAnalyzeTool(server);
registerFormatMessagesTool(server);
registerContextTool(server);

await startMcpServer(server);
