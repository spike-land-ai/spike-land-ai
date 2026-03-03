/**
 * In-Process Tool Provider
 *
 * Duck-type compatible replacement for ServerManager that routes tool calls
 * directly to in-process ToolRegistry handlers. Eliminates child processes,
 * HTTP roundtrips, auth issues, and missing binaries in Docker/production.
 *
 * The spike-cli `runAgentLoop()` only uses two methods:
 *   - getAllTools() → NamespacedTool[]
 *   - callTool(name, args) → CallToolResult
 * Plus closeAll() for pool cleanup.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolRegistry } from "@/lib/mcp/server/tool-registry";
import { registerAllTools } from "@/lib/mcp/server/tool-manifest";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import logger from "@/lib/logger";

/** Matches NamespacedTool from spike-cli ServerManager */
interface NamespacedTool {
  namespacedName: string;
  originalName: string;
  serverName: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/** Matches CallToolResult from spike-cli types */
interface CallToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown; }>;
  isError?: boolean;
}

export class InProcessToolProvider {
  private registry: ToolRegistry;
  private toolCache: NamespacedTool[] | null = null;

  constructor(userId: string) {
    // Create a minimal McpServer — only used for ToolRegistry's registerTool bookkeeping.
    // No actual MCP transport is set up.
    const mcpServer = new McpServer({ name: "in-process", version: "1.0.0" });
    this.registry = new ToolRegistry(mcpServer, userId);

    // Register all 120+ tools
    registerAllTools(this.registry, userId);

    // Enable all tools — skip progressive disclosure for agent loops
    const enabled = this.registry.enableAll();
    logger.info("InProcessToolProvider initialized", {
      totalTools: this.registry.getToolCount(),
      enabledTools: enabled,
      userId,
    });
  }

  /** Returns all tools as NamespacedTool[] (cached after first call). */
  getAllTools(): NamespacedTool[] {
    if (this.toolCache) return this.toolCache;

    const definitions = this.registry.getToolDefinitions();
    this.toolCache = definitions
      .filter(d => d.enabled)
      .map(d => ({
        namespacedName: d.name,
        originalName: d.name,
        serverName: "in-process",
        description: d.description,
        inputSchema: d.inputSchema
          ? (zodToJsonSchema(
            z.object(d.inputSchema) as unknown as Parameters<
              typeof zodToJsonSchema
            >[0],
          ) as Record<string, unknown>)
          : { type: "object", properties: {} },
      }));

    return this.toolCache;
  }

  /** Call a tool by name, routing directly to the in-process handler. */
  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<CallToolResult> {
    return this.registry.callToolDirect(name, args);
  }

  /** Returns server names for compatibility. */
  getServerNames(): string[] {
    return ["in-process"];
  }

  /** No-op — nothing to close for in-process tools. */
  async closeAll(): Promise<void> {
    // No external connections to tear down
  }

  /** Connect is a no-op — tools are already registered. */
  async connectAll(): Promise<void> {
    // Already initialized in constructor
  }
}
