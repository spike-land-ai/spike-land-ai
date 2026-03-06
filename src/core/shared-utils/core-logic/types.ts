/**
 * Tool Builder Types
 *
 * Core type definitions for the immutable tool builder system.
 * Compatible with both @modelcontextprotocol/sdk and standalone usage.
 */

import type { z } from "zod";

// ─── MCP-compatible result type ───

export interface CallToolResult {
  content: Array<{
    type: string;
    text?: string | undefined;
    data?: string | undefined;
    mimeType?: string | undefined;
  }>;
  isError?: boolean | undefined;
}

// ─── Empty context marker ───

/** Empty context — the starting point for middleware chains */
export type EmptyContext = Record<string, never>;

// ─── Middleware ───

/** Context passed to every middleware and handler */
export interface MiddlewareParams<TInput, TCtx> {
  input: TInput;
  ctx: TCtx;
  next: <TNewCtx extends TCtx>(newCtx: TNewCtx) => Promise<CallToolResult>;
}

/**
 * Typed middleware definition.
 *
 * Uses a unique symbol brand to carry the output context type
 * while keeping `fn` contravariant in TCtxIn (correct for structural subtyping).
 */
declare const __middlewareCtxOut: unique symbol;

export interface Middleware<TCtxIn, TCtxOut extends TCtxIn> {
  fn: (params: MiddlewareParams<unknown, TCtxIn>) => Promise<CallToolResult>;
  /** Phantom brand — carries TCtxOut for type inference. Never set at runtime. */
  readonly [__middlewareCtxOut]?: TCtxOut;
}

/** A middleware function that can extend context */
export type MiddlewareFn<TCtxIn, _TCtxOut extends TCtxIn> = (
  params: MiddlewareParams<unknown, TCtxIn>,
) => Promise<CallToolResult>;

// ─── Tool metadata ───

export interface ToolExample {
  name: string;
  input: Record<string, unknown>;
  description: string;
  expected_output?: string | undefined;
}

export interface ToolMeta {
  category?: string | undefined;
  tier?: "free" | "workspace" | undefined;
  complexity?: "primitive" | "composed" | "workflow" | undefined;
  annotations?: Record<string, unknown> | undefined;
  alwaysEnabled?: boolean | undefined;
  examples?: ToolExample[] | undefined;
  version?: string | undefined;
  stability?: "stable" | "beta" | "experimental" | "deprecated" | "not-implemented" | undefined;
}

// ─── Built tool (output of builder) ───

export interface BuiltTool<TInput = unknown, TOutput = CallToolResult> {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
  outputSchema?: z.ZodType<TOutput> | undefined;
  meta: ToolMeta;
  handler: (input: TInput, ctx?: Record<string, unknown>) => Promise<CallToolResult>;
}

// ─── Handler params (what the user's handler receives) ───

export interface HandlerParams<TInput, TCtx> {
  input: TInput;
  ctx: TCtx;
}
