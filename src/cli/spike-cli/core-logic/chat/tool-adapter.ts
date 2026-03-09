/**
 * MCP ↔ Claude tool_use bridge.
 * Converts between MCP NamespacedTool format and Claude API tool definitions.
 */

import type { NamespacedTool, ServerManager } from "../multiplexer/server-manager";
import type { Tool } from "../../ai/client";
import { log } from "../util/logger";
import {
  createToolPipeline,
  type ToolExecutorOptions,
  type ToolCallCtx,
  type ToolExecResult,
} from "./tool-pipeline";
import { buildNotFoundError, buildUpstreamError, formatToolError } from "./tool-errors";

/**
 * Ensure input schema has `type: "object"` at top level,
 * as required by Claude's tool_use format.
 */
function normalizeInputSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...schema };
  if (!normalized.type) {
    normalized.type = "object";
  }
  return normalized;
}

/**
 * Convert MCP NamespacedTools to Claude API tool definitions.
 */
export function mcpToolsToClaude(tools: NamespacedTool[]): Tool[] {
  return tools.map((tool) => ({
    name: tool.namespacedName,
    description: tool.description ?? "",
    input_schema: normalizeInputSchema(tool.inputSchema) as Tool["input_schema"],
  }));
}

/** Param metadata returned by getRequiredParams. */
export interface ParamInfo {
  name: string;
  description: string;
  type: string;
}

/**
 * Extract default values from a JSON Schema `inputSchema`.
 * Returns `{ key: defaultValue }` for every property that declares a `"default"`.
 */
export function extractDefaults(inputSchema: Record<string, unknown>): Record<string, unknown> {
  const props = inputSchema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!props) return {};

  const defaults: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(props)) {
    if ("default" in prop) {
      defaults[key] = prop.default;
    }
  }
  return defaults;
}

/**
 * Return metadata for required params that have no default value.
 * These are the params the user must supply.
 */
export function getRequiredParams(inputSchema: Record<string, unknown>): ParamInfo[] {
  const required = (inputSchema.required as string[] | undefined) ?? [];
  const props = inputSchema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!props) return [];

  const defaults = extractDefaults(inputSchema);

  return required
    .filter((name) => !(name in defaults))
    .map((name) => {
      const prop = props[name] ?? {};
      return {
        name,
        description: (prop.description as string) ?? "",
        type: (prop.type as string) ?? "string",
      };
    });
}

/**
 * Execute a tool call by routing through ServerManager.
 * Returns the text result or error string.
 */
export async function executeToolCall(
  manager: ServerManager,
  name: string,
  input: Record<string, unknown>,
): Promise<{ result: string; isError: boolean }> {
  log(`Executing tool: ${name}`);
  try {
    const callResult = await manager.callTool(name, input);
    const text = callResult.content.map((c) => c.text ?? JSON.stringify(c)).join("\n");
    return { result: text, isError: callResult.isError ?? false };
  } catch (err) {
    const structured = buildUpstreamError(name, err);
    return { result: formatToolError(structured), isError: true };
  }
}

/**
 * Create a pipeline-wrapped tool executor that routes through ServerManager.
 * Adds validation, timeout, retry, caching, and logging middleware.
 */
export function createToolExecutor(
  manager: ServerManager,
  options?: ToolExecutorOptions,
): {
  execute: (
    name: string,
    input: Record<string, unknown>,
    schema?: Record<string, unknown>,
  ) => Promise<ToolExecResult>;
} {
  const baseHandler = async (ctx: ToolCallCtx): Promise<ToolExecResult> => {
    try {
      const callResult = await manager.callTool(ctx.toolName, ctx.input);
      const text = callResult.content.map((c) => c.text ?? JSON.stringify(c)).join("\n");
      return { result: text, isError: callResult.isError ?? false };
    } catch (err) {
      const allTools = manager.getAllTools();
      // Check if tool not found
      const toolExists = allTools.some((t) => t.namespacedName === ctx.toolName);
      if (!toolExists) {
        return {
          result: formatToolError(buildNotFoundError(ctx.toolName, allTools)),
          isError: true,
        };
      }
      return { result: formatToolError(buildUpstreamError(ctx.toolName, err)), isError: true };
    }
  };

  const pipeline = createToolPipeline(baseHandler, options);

  return {
    execute: (name: string, input: Record<string, unknown>, schema?: Record<string, unknown>) =>
      pipeline({ toolName: name, input, ...(schema ? { inputSchema: schema } : {}) }),
  };
}
