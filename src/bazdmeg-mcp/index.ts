#!/usr/bin/env node
/**
 * BAZDMEG MCP Server
 *
 * Workspace isolation, quality gates, and context engineering
 * for Claude Code agents in the spike-land-ai monorepo.
 */

import { createMcpServer, startMcpServer } from "@spike-land-ai/mcp-server-base";
import { registerWorkspaceTools } from "./tools/workspace.js";
import { registerContextTools } from "./tools/context.js";
import { registerGatesTools } from "./tools/gates.js";
import { registerWorkflowTools } from "./tools/workflow.js";
import { registerEscalationTools } from "./tools/escalation.js";
import { registerShipTools } from "./tools/ship.js";
import { registerBuildTools } from "./tools/build.js";
import { registerPublishTools } from "./tools/publish.js";
import { registerDeployTools } from "./tools/deploy.js";
import { registerMirrorTools } from "./tools/mirror.js";
import { registerManifestTools } from "./tools/manifest.js";
import { registerDepGraphTools } from "./tools/deps.js";

const server = createMcpServer({
  name: "bazdmeg-mcp",
  version: "0.1.0",
});

// Register all tool groups
registerWorkspaceTools(server);
registerContextTools(server);
registerGatesTools(server);
registerWorkflowTools(server);
registerEscalationTools(server);
registerShipTools(server);
registerBuildTools(server);
registerPublishTools(server);
registerDeployTools(server);
registerMirrorTools(server);
registerManifestTools(server);
registerDepGraphTools(server);

// Start on stdio
await startMcpServer(server);
