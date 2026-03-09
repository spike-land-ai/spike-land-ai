import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { pipelineTools } from "./pipeline-tools.js";

// Define a minimal interface that matches the expected `addTool` method
interface MinimalServer {
  addTool(tool: Tool): void;
}

export function registerPipelineCategory(server: MinimalServer) {
  for (const tool of pipelineTools) {
    server.addTool(tool);
  }
}
