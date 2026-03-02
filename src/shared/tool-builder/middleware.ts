/**
 * Middleware Factory
 *
 * Creates typed middleware that can extend the context.
 * Each middleware receives { input, ctx, next } and must call next() with the new context.
 */

import type { CallToolResult, Middleware, MiddlewareParams } from "./types.js";

/**
 * Create a typed middleware.
 *
 * TCtxIn: minimum context properties this middleware requires
 * TCtxOut: context after this middleware runs (must extend TCtxIn)
 *
 * @example
 * ```ts
 * const withUserId = (id: string) => middleware<{}, { userId: string }>(
 *   async ({ ctx, next }) => next({ ...ctx, userId: id })
 * );
 * ```
 */
export function middleware<TCtxIn extends Record<string, unknown>, TCtxOut extends TCtxIn>(
  fn: (params: MiddlewareParams<unknown, TCtxIn>) => Promise<CallToolResult>,
): Middleware<TCtxIn, TCtxOut> {
  // Only the `fn` property is set at runtime.
  // The symbol-branded phantom type is never assigned — it exists only for inference.
  return { fn } as Middleware<TCtxIn, TCtxOut>;
}
