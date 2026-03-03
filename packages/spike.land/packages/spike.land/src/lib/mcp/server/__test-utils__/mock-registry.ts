import { vi } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";

export type MockRegistry = ToolRegistry & {
  handlers: Map<
    string,
    (args: Record<string, unknown>) => Promise<CallToolResult>
  >;
  call: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<CallToolResult>;
};

export function createMockRegistry(tools: unknown[] = []): MockRegistry {
  const handlers = new Map<
    string,
    (args: Record<string, unknown>) => Promise<CallToolResult>
  >();
  const registry = {
    register: vi.fn(
      (
        def: {
          name: string;
          handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
        },
      ) => {
        handlers.set(def.name, def.handler);
      },
    ),
    handlers,
    call: async (name: string, args: Record<string, unknown>) => {
      const handler = handlers.get(name);
      if (!handler) throw new Error(`Tool ${name} not registered in mock`);
      return handler(args);
    },
  };

  if (tools) {
    tools.forEach(t =>
      registry.register(
        t as {
          name: string;
          handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
        },
      )
    );
  }

  return registry as unknown as MockRegistry;
}
