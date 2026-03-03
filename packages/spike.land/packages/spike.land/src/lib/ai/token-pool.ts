/**
 * Multi-token fallback pool for Claude OAuth tokens.
 *
 * Collects tokens from env vars (CLAUDE_CODE_OAUTH_TOKEN, _2, …, _10),
 * tries last-known-good first, rotates on 401 auth errors, and persists
 * the winner in Redis (1h TTL) + in-memory.
 */

import Anthropic from "@anthropic-ai/sdk";
import { redis } from "@/lib/upstash/client";
import logger from "@/lib/logger";

const REDIS_KEY = "ai:anthropic:last-good-token-idx";
const REDIS_TTL = 3600; // 1 hour
const MAX_SUFFIX = 10;

/** In-memory fallback when Redis is unavailable. */
let memoryLastGoodIdx = 0;

/**
 * Collect unique OAuth tokens from env vars.
 * Checks CLAUDE_CODE_OAUTH_TOKEN, then _2 through _10.
 */
export function resolveTokenPool(): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];

  const primary = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (primary) {
    seen.add(primary);
    tokens.push(primary);
  }

  for (let i = 2; i <= MAX_SUFFIX; i++) {
    const val = process.env[`CLAUDE_CODE_OAUTH_TOKEN_${i}`];
    if (val && !seen.has(val)) {
      seen.add(val);
      tokens.push(val);
    }
  }

  return tokens;
}

/** Read last-good index from Redis, falling back to memory. */
async function getLastGoodIdx(poolSize: number): Promise<number> {
  try {
    const stored = await redis.get<number>(REDIS_KEY);
    if (stored !== null && stored >= 0 && stored < poolSize) {
      memoryLastGoodIdx = stored;
      return stored;
    }
  } catch {
    // Redis unavailable — use memory
  }
  return memoryLastGoodIdx < poolSize ? memoryLastGoodIdx : 0;
}

/** Persist last-good index to Redis + memory. */
async function setLastGoodIdx(idx: number): Promise<void> {
  memoryLastGoodIdx = idx;
  try {
    await redis.set(REDIS_KEY, idx, { ex: REDIS_TTL });
  } catch {
    // Redis unavailable — memory is enough
  }
}

/**
 * Returns true if the error is a 401 authentication error.
 */
function isAuthError(error: unknown): boolean {
  if (error instanceof Anthropic.AuthenticationError) return true;
  if (error instanceof Error) {
    return error.message.includes("authentication_error")
      || error.message.includes("401");
  }
  return false;
}

/**
 * Execute an operation with automatic token fallback.
 *
 * Starts with the last-known-good token, rotates through the pool
 * on 401 auth errors only. Non-auth errors propagate immediately.
 *
 * @param operation - Receives the authToken string, returns a promise.
 */
export async function withTokenFallback<T>(
  operation: (authToken: string) => Promise<T>,
): Promise<T> {
  const pool = resolveTokenPool();
  if (pool.length === 0) {
    throw new Error(
      "No Anthropic auth tokens available. "
        + "Set CLAUDE_CODE_OAUTH_TOKEN or CLAUDE_CODE_OAUTH_TOKEN_2…_10.",
    );
  }

  // Single token — fast path, no fallback logic needed
  if (pool.length === 1) {
    return operation(pool[0]!);
  }

  const startIdx = await getLastGoodIdx(pool.length);
  let lastError: unknown;

  // Try starting from last-good, then wrap around
  for (let attempt = 0; attempt < pool.length; attempt++) {
    const idx = (startIdx + attempt) % pool.length;
    try {
      const result = await operation(pool[idx]!);
      // Success — remember this token
      if (idx !== memoryLastGoodIdx) {
        logger.info(`Token fallback: switched to token index ${idx}`);
        await setLastGoodIdx(idx);
      }
      return result;
    } catch (err) {
      lastError = err;
      if (!isAuthError(err)) {
        // Non-auth error — don't rotate, propagate immediately
        throw err;
      }
      logger.warn(`Token index ${idx} auth failed, trying next`, {
        attempt: attempt + 1,
        poolSize: pool.length,
      });
    }
  }

  // All tokens exhausted
  throw lastError;
}

/**
 * Return the currently preferred (last-known-good) token.
 * Useful for passing to subprocesses or constructing clients.
 */
export function getPreferredToken(): string {
  const pool = resolveTokenPool();
  if (pool.length === 0) {
    throw new Error("No Anthropic auth tokens available.");
  }
  const idx = memoryLastGoodIdx < pool.length ? memoryLastGoodIdx : 0;
  return pool[idx]!;
}

/**
 * Get pool diagnostics (for token-test endpoint).
 */
export async function getPoolInfo(): Promise<{
  poolSize: number;
  activeIndex: number;
  maskedTokens: string[];
}> {
  const pool = resolveTokenPool();
  const activeIndex = await getLastGoodIdx(pool.length || 1);
  return {
    poolSize: pool.length,
    activeIndex,
    maskedTokens: pool.map(maskToken),
  };
}

function maskToken(token: string): string {
  if (token.length <= 16) return "***";
  return `${token.slice(0, 12)}...${token.slice(-4)}`;
}

/** Reset in-memory state (for testing). */
export function _resetForTesting(): void {
  memoryLastGoodIdx = 0;
}
