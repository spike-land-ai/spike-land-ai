/**
 * Standalone Tool Registry
 *
 * Lightweight registry for standalone MCP server apps.
 * Enforces dependency graph (pre-call `requires` guard, post-call `enables` hook).
 * Does NOT depend on `@/lib/logger`, `@/lib/tracking`, etc.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext, StandaloneToolDefinition } from "./types";
import { checkRequires, getEnables } from "./dependency-graph";
import { errorResult } from "./tool-helpers";

/**
 * Create an McpServer with all tools registered and dependency enforcement.
 * Tools start enabled by default (no progressive disclosure in standalone mode).
 */
export function createAppServer(
  name: string,
  version: string,
  tools: StandaloneToolDefinition[],
  ctx: ServerContext,
): McpServer {
  const server = new McpServer({ name, version });

  for (const tool of tools) {
    const wrappedHandler = async (input: never) => {
      // Pre-call: check `requires` dependencies
      const reqCheck = checkRequires(tool, ctx.calledTools);
      if (!reqCheck.ok) {
        return errorResult(
          `**Prerequisite tools not called:** ${reqCheck.missing.join(", ")}\n` +
            `You must call these tools first before using \`${tool.name}\`.`,
        );
      }

      // Execute handler
      const result = await tool.handler(input, ctx);

      // Post-call: track successful call and fire `enables`
      if (!result.isError) {
        ctx.calledTools.add(tool.name);
        const _enables = getEnables(tool.dependencies);
        // In standalone mode, all tools are already enabled,
        // but calledTools tracking still matters for `requires` chains.
      }

      return result;
    };

    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      wrappedHandler as Parameters<McpServer["registerTool"]>[2],
    );
  }

  return server;
}
