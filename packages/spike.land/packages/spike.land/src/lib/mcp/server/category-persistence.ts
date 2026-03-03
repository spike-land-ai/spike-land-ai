/**
 * MCP Category Persistence
 *
 * Persists user-enabled tool categories to Redis so they survive
 * across stateless HTTP requests. Key pattern: mcp:enabled-categories:{userId}
 *
 * Fixes: #1537, #1540
 */

import { logger } from "@/lib/logger";

const KEY_PREFIX = "mcp:enabled-categories:";
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function redisKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

/**
 * Load the user's previously enabled categories from Redis.
 * Returns an empty array if Redis is unavailable or no state exists.
 */
export async function loadEnabledCategories(
  userId: string,
): Promise<string[]> {
  try {
    const { redis } = await import("@/lib/upstash/client");
    const raw = await redis.get<string>(redisKey(userId));
    if (!raw) return [];

    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is string => typeof item === "string",
    );
  } catch (err) {
    logger.warn("[MCP] Failed to load enabled categories from Redis", {
      userId,
      error: err,
    });
    return [];
  }
}

/**
 * Save the user's currently enabled categories to Redis.
 * Silently fails if Redis is unavailable.
 */
export async function saveEnabledCategories(
  userId: string,
  categories: string[],
): Promise<void> {
  try {
    const { redis } = await import("@/lib/upstash/client");
    await redis.set(redisKey(userId), JSON.stringify(categories), {
      ex: TTL_SECONDS,
    });
  } catch (err) {
    logger.warn("[MCP] Failed to save enabled categories to Redis", {
      userId,
      error: err,
    });
  }
}
