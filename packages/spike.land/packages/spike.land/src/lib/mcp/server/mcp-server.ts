/**
 * Server-Side MCP Server Factory
 *
 * Creates a configured McpServer instance with all tools registered
 * for a specific authenticated user. Used by the Streamable HTTP endpoint.
 *
 * Tool registration is driven by the manifest in tool-manifest.ts.
 * To add a new tool: add an import + entry in TOOL_MODULES there.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolRegistry } from "./tool-registry";
import { CapabilityFilteredRegistry } from "./capability-filtered-registry";
import { registerAllTools } from "./tool-manifest";

/**
 * Options for creating an MCP server with capability restrictions.
 * When capabilityTokenId is provided, all tool calls are filtered
 * through the capability evaluator.
 *
 * enabledCategories: pre-loaded list of categories to restore
 * (e.g. from Redis persistence). Applied after tool registration.
 */
export interface CreateMcpServerOptions {
  capabilityTokenId?: string;
  agentId?: string;
  enabledCategories?: string[];
}

/**
 * Create a fully configured MCP server for a specific user.
 * All tools are registered with the user's identity for authorization.
 *
 * When `options.capabilityTokenId` is provided, tools are wrapped with
 * capability evaluation, audit logging, and budget deduction.
 * Without it, behavior is identical to before (full access).
 */
export function createMcpServer(
  userId: string,
  options?: CreateMcpServerOptions,
): McpServer {
  const mcpServer = new McpServer(
    {
      name: "spike-land",
      version: "1.0.0",
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

  registerAllTools(registry, userId);

  // Restore previously enabled categories (e.g. from Redis persistence)
  if (options?.enabledCategories && options.enabledCategories.length > 0) {
    registry.restoreCategories(options.enabledCategories);
  }

  return mcpServer;
}
