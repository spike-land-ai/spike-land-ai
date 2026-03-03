/**
 * App-Scoped MCP Server Factory
 *
 * Creates an MCP server that only registers tools belonging to a specific
 * store app. Each app in the store IS its own MCP server — this factory
 * makes that architectural principle concrete.
 *
 * Usage:
 *   const server = createAppMcpServer("chess-arena", userId);
 *   // server only has chess-game, chess-player, chess-challenge, chess-replay tools
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolRegistry } from "./tool-registry";
import { CapabilityFilteredRegistry } from "./capability-filtered-registry";
import { registerGatewayMetaTools } from "./tools/gateway-meta";
import { getToolModulesForApp } from "./app-tool-resolver";
import { getAppBySlug } from "@/app/store/data/store-apps";
import type { CreateMcpServerOptions } from "./mcp-server";

/**
 * Create an MCP server scoped to a specific store app.
 * Only registers gateway-meta tools (for discovery) + the app's own tools.
 *
 * @throws Error if the app slug is not found in the store
 */
export function createAppMcpServer(
  appSlug: string,
  userId: string,
  options?: CreateMcpServerOptions,
): McpServer {
  const app = getAppBySlug(appSlug);
  if (!app) {
    throw new Error(`Unknown app: ${appSlug}`);
  }

  const mcpServer = new McpServer(
    {
      name: `spike-land-${appSlug}`,
      version: app.version ?? "1.0.0",
    },
    {
      capabilities: {
        tools: { listChanged: true },
      },
    },
  );

  const registry = options?.capabilityTokenId
    ? new CapabilityFilteredRegistry(
      mcpServer,
      options.capabilityTokenId,
      options.agentId ?? "",
      userId,
    )
    : new ToolRegistry(mcpServer, userId);

  // Always register gateway-meta for tool discovery within this app's scope
  registerGatewayMetaTools(registry, userId);

  // Register only this app's tool modules
  const appModules = getToolModulesForApp(appSlug);
  for (const entry of appModules) {
    if (!entry.condition || entry.condition()) {
      entry.register(registry, userId);
    }
  }

  return mcpServer;
}
