/**
 * Tool Builder -- tRPC-grade type-safe MCP tool definitions
 *
 * Immutable builder with composable middleware.
 * Zero `as unknown as` or `any` casts.
 */

export { createProcedure, baseProcedure } from "./builder.js";
export type { Procedure, ToolBuilder } from "./builder.js";
export { middleware } from "./middleware.js";
export type {
  CallToolResult,
  BuiltTool,
  EmptyContext,
  HandlerParams,
  Middleware,
  MiddlewareFn,
  MiddlewareParams,
  ToolMeta,
} from "./types.js";
