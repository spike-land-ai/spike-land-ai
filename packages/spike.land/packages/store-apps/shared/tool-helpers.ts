/**
 * Portable Tool Helpers
 *
 * Error wrapper and result formatters for standalone MCP tool modules.
 * No `@/` imports — works outside the Next.js monorepo context.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const MAX_RESPONSE_SIZE = 8192;

/**
 * Format a text result, truncating if too long.
 */
export function textResult(text: string): CallToolResult {
  const truncated =
    text.length > MAX_RESPONSE_SIZE
      ? text.slice(0, MAX_RESPONSE_SIZE) + "\n...(truncated, response exceeded 8KB)"
      : text;
  return { content: [{ type: "text", text: truncated }] };
}

/**
 * Format a result with both a summary text and JSON data.
 */
export function jsonResult(text: string, data: unknown): CallToolResult {
  return {
    content: [
      { type: "text", text },
      { type: "text", text: JSON.stringify(data, null, 2) },
    ],
  };
}

/**
 * Format an error result.
 */
export function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

/**
 * Wrap a tool handler with error catching and structured error responses.
 * Portable version — does not record invocations or fire reactions.
 */
export async function safeToolCall(
  toolName: string,
  handler: () => Promise<CallToolResult>,
  options?: { timeoutMs?: number },
): Promise<CallToolResult> {
  try {
    const handlerPromise = handler();
    const result = options?.timeoutMs
      ? await Promise.race([
          handlerPromise,
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Tool ${toolName} timed out after ${options.timeoutMs}ms`)),
              options.timeoutMs,
            ),
          ),
        ])
      : await handlerPromise;

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResult(`**Error in ${toolName}:** ${message}`);
  }
}
