/**
 * MCP ↔ Claude tool_use bridge.
 * Converts between MCP NamespacedTool format and Claude API tool definitions.
 */

import type {
  NamespacedTool,
  ServerManager,
} from "../multiplexer/server-manager";
import type { Tool } from "./client";
import { log } from "../util/logger";

/**
 * Ensure input schema has `type: "object"` at top level,
 * as required by Claude's tool_use format.
 */
function normalizeInputSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
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
  return tools.map(tool => ({
    name: tool.namespacedName,
    description: tool.description ?? "",
    input_schema: normalizeInputSchema(
      tool.inputSchema,
    ) as Tool["input_schema"],
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
export function extractDefaults(
  inputSchema: Record<string, unknown>,
): Record<string, unknown> {
  const props = inputSchema.properties as
    | Record<string, Record<string, unknown>>
    | undefined;
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
export function getRequiredParams(
  inputSchema: Record<string, unknown>,
): ParamInfo[] {
  const required = (inputSchema.required as string[] | undefined) ?? [];
  const props = inputSchema.properties as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!props) return [];

  const defaults = extractDefaults(inputSchema);

  return required
    .filter(name => !(name in defaults))
    .map(name => {
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
): Promise<{ result: string; isError: boolean; }> {
  log(`Executing tool: ${name}`);
  try {
    const callResult = await manager.callTool(name, input);
    const text = callResult.content
      .map(c => c.text ?? JSON.stringify(c))
      .join("\n");
    return { result: text, isError: callResult.isError ?? false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { result: `Tool error: ${message}`, isError: true };
  }
}
