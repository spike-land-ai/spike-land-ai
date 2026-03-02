import type { ErrorCode } from "../types.js";

// Re-export Result<T>, ok, fail, tryCatch from the shared base package
export { type Result, ok, fail, tryCatch } from "@spike-land-ai/mcp-server-base";

/**
 * A standard domain error that can be caught by the ToolBuilder to return structured MCP errors.
 */
export class DomainError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public retryable = false,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
