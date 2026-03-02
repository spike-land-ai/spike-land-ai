/**
 * Mock tool registry for testing pixel MCP tools.
 */

import { vi } from "vitest";
import type {
  AnyToolSpec,
  CallToolResult,
  ImageStudioToolRegistry,
  ToolDefinition,
} from "../types.js";

export type MockRegistry = ImageStudioToolRegistry & {
  handlers: Map<
    string,
    (args: Record<string, unknown>) => Promise<CallToolResult> | CallToolResult
  >;
  call: (name: string, args: Record<string, unknown>) => Promise<CallToolResult>;
};

export function createMockRegistry(): MockRegistry {
  const handlers = new Map<
    string,
    (args: Record<string, unknown>) => Promise<CallToolResult> | CallToolResult
  >();

  const registry = {
    register: vi.fn(<T = unknown>(specOrDef: ToolDefinition<T> | AnyToolSpec) => {
      const def = specOrDef as ToolDefinition<unknown>;
      handlers.set(
        def.name,
        def.handler as (args: Record<string, unknown>) => Promise<CallToolResult> | CallToolResult,
      );
    }),
    handlers,
    call: async (name: string, args: Record<string, unknown> = {}) => {
      const handler = handlers.get(name);
      if (!handler) {
        throw new Error(`Mock tool handler not found for ${name}`);
      }

      return handler(args);
    },
  };

  return registry as unknown as MockRegistry;
}

export function getText(result: CallToolResult): string {
  return result.content[0]?.text ?? "";
}

export function isError(result: CallToolResult): boolean {
  return result.isError === true;
}
