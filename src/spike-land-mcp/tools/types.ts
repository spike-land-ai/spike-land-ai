/**
 * Shared tool types for spike-land-mcp
 */

import type { BuiltTool } from "@spike-land-ai/shared/tool-builder";

/**
 * Minimal registry interface for tool registration.
 * Compatible with both ToolRegistry and test mocks.
 */
export interface ToolRegistryAdapter {
  registerBuilt<TInput, TOutput>(built: BuiltTool<TInput, TOutput>): void;
}
