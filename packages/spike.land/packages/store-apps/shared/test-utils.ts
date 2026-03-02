/**
 * Test Utilities for Standalone Store Apps
 *
 * Provides mock registry and context for unit testing standalone tools.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext, StandaloneToolDefinition } from "./types";

/**
 * Create a mock server context for testing.
 */
export function createMockContext(overrides?: Partial<ServerContext>): ServerContext {
  return {
    userId: "test-user-id",
    env: {},
    calledTools: new Set<string>(),
    ...overrides,
  };
}

/**
 * Create a mock registry that can invoke tools directly for testing.
 * Returns a lookup function that finds and calls tools by name.
 */
export function createMockRegistry(tools: StandaloneToolDefinition[]): {
  call: (
    name: string,
    input: Record<string, unknown>,
    ctx?: ServerContext,
  ) => Promise<CallToolResult>;
  getToolNames: () => string[];
  getToolsByCategory: (category: string) => StandaloneToolDefinition[];
} {
  const toolMap = new Map<string, StandaloneToolDefinition>();
  for (const tool of tools) {
    toolMap.set(tool.name, tool);
  }

  return {
    async call(
      name: string,
      input: Record<string, unknown>,
      ctx?: ServerContext,
    ): Promise<CallToolResult> {
      const tool = toolMap.get(name);
      if (!tool) {
        return {
          content: [{ type: "text", text: `Tool not found: ${name}` }],
          isError: true,
        };
      }
      const context = ctx ?? createMockContext();
      return tool.handler(input as never, context);
    },

    getToolNames(): string[] {
      return Array.from(toolMap.keys());
    },

    getToolsByCategory(category: string): StandaloneToolDefinition[] {
      return tools.filter((t) => t.category === category);
    },
  };
}
