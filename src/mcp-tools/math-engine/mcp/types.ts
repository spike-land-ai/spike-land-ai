/**
 * Math Engine MCP Server — Result Helpers
 */

export {
  type CallToolResult,
  errorResult,
  jsonResult,
  tryCatch,
} from "@spike-land-ai/mcp-server-base";

export type MathErrorCode =
  | "PROBLEM_NOT_FOUND"
  | "SESSION_NOT_FOUND"
  | "INVALID_INPUT"
  | "LLM_ERROR"
  | "ORCHESTRATION_ERROR";
