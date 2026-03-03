/**
 * Extract the text from an MCP tool result.
 * Assumes the result has shape `{ content: [{ text: string }] }`.
 */
export function getText(result: unknown): string {
  return (result as { content: Array<{ text: string; }>; }).content[0]!.text;
}

/**
 * Check if an MCP tool result is an error response.
 * Checks for `{ isError: true }` on the result object.
 */
export function isError(result: unknown): boolean {
  return (result as { isError?: boolean; }).isError === true;
}

/**
 * Extract and parse JSON data from the second content block of an MCP tool result.
 * Assumes the result has shape `{ content: [_, { type: "text", text: string }] }`.
 */
export function getJsonData<T = Record<string, unknown>>(result: unknown): T {
  const r = result as { content: Array<{ type: string; text?: string; }>; };
  const block = r.content[1];
  if (!block || block.type !== "text" || typeof block.text !== "string") {
    throw new Error("Expected TextContent at content[1]");
  }
  return JSON.parse(block.text) as T;
}
