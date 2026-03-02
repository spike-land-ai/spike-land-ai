/**
 * Mock MCP Server for testing tool registrations.
 * Uses the createMockServer from mcp-server-base.
 */

import { vi } from "vitest";

interface CallToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

type ToolHandler = (args: Record<string, unknown>) => Promise<CallToolResult>;

export interface MockMcpServer {
  tool: ReturnType<typeof vi.fn>;
  handlers: Map<string, ToolHandler>;
  call: (name: string, args?: Record<string, unknown>) => Promise<CallToolResult>;
}

export function createMockServer(): MockMcpServer {
  const handlers = new Map<string, ToolHandler>();

  const toolFn = vi.fn(
    (
      name: string,
      _description: string,
      _schema: Record<string, unknown>,
      handler: ToolHandler,
    ) => {
      handlers.set(name, handler);
    },
  );

  return {
    tool: toolFn,
    handlers,
    call: async (name: string, args: Record<string, unknown> = {}) => {
      const handler = handlers.get(name);
      if (!handler) throw new Error(`Tool "${name}" not registered`);
      return handler(args);
    },
  };
}
