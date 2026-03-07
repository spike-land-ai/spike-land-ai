/**
 * Shared edge cache utility wrapping the Cloudflare Cache API.
 *
 * Usage:
 *   const response = await withEdgeCache(request, safeCtx(c), () => fetchFromR2(...), {
 *     ttl: 3600,
 *     swr: 86400,
 *   });
 */

import type { Context } from "hono";

/** Safely extract ExecutionContext from Hono context (returns undefined in tests) */
export function safeCtx(c: Context): ExecutionContext | undefined {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
}

interface EdgeCacheOptions {
  /** Cache-Control max-age in seconds */
  ttl: number;
  /** Optional stale-while-revalidate window in seconds */
  swr?: number;
  /** Mark as immutable (content-addressed / hashed assets) */
  immutable?: boolean;
  /** Custom cache key (defaults to request URL) */
  cacheKey?: string;
}

/**
 * Wraps a response fetcher with Cloudflare Cache API match/put.
 * Returns cached response on hit, otherwise calls `fetcher`, caches the result
 * via `waitUntil`, and returns it.
 */
export async function withEdgeCache(
  request: Request,
  ctx: ExecutionContext | undefined,
  fetcher: () => Promise<Response | null>,
  options: EdgeCacheOptions,
): Promise<Response | null> {
  // Build Cache-Control value upfront
  let cc = `public, max-age=${options.ttl}`;
  if (options.swr) cc += `, stale-while-revalidate=${options.swr}`;
  if (options.immutable) cc += ", immutable";

  // Try Cache API — gracefully degrade if unavailable (e.g. test env)
  let cache: Cache | undefined;
  let cacheReq: Request | undefined;
  try {
    cache = (caches as unknown as { default: Cache }).default;
    cacheReq = options.cacheKey
      ? new Request(options.cacheKey, { method: "GET" })
      : request;

    const cached = await cache.match(cacheReq);
    if (cached) return cached;
  } catch {
    // Cache API not available — fall through to fetcher
  }

  // Cache miss — call origin
  const response = await fetcher();
  if (!response || !response.ok) return response;

  // Store in edge cache in background
  if (cache && cacheReq) {
    const toCache = new Response(response.clone().body, {
      status: response.status,
      headers: new Headers(response.headers),
    });
    toCache.headers.set("Cache-Control", cc);
    toCache.headers.set("Vary", "Accept-Encoding");

    try {
      ctx?.waitUntil(cache.put(cacheReq, toCache));
    } catch { /* no ExecutionContext in test environment */ }
  }

  // Set cache headers on the live response
  response.headers.set("Cache-Control", cc);
  response.headers.set("Vary", "Accept-Encoding");
  return response;
}
