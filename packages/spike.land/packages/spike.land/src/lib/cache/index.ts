import { redis } from "@/lib/upstash/client";
import { logger } from "@/lib/logger";
import { tryCatch } from "@/lib/try-catch";

/**
 * Get a cached value, or compute and cache it using the fetcher.
 * Returns the cached value if present, otherwise calls fetcher,
 * stores the result with the given TTL, and returns it.
 *
 * Gracefully handles Redis failures by falling back to the fetcher.
 */
export async function getCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  // 1. Try to get from Redis
  const { data: cached, error: redisError } = await tryCatch(
    redis.get<T>(key),
  );

  if (redisError) {
    logger.warn(`[Cache] Redis error fetching key "${key}", falling back to fetcher`, {
      error: redisError,
    });
  } else if (cached !== null) {
    return cached;
  }

  // 2. Not in cache (or Redis failed), fetch fresh data
  const value = await fetcher();

  // 3. Store back in Redis (fire and forget, don't block on this)
  if (!redisError) {
    tryCatch(redis.set(key, value, { ex: ttlSeconds })).then(({ error }) => {
      if (error) {
        logger.warn(`[Cache] Failed to set key "${key}" in Redis`, { error });
      }
    });
  }

  return value;
}

/**
 * Get a cached value without a fetcher. Returns null if not found or on error.
 */
export async function getCacheRaw<T>(key: string): Promise<T | null> {
  const { data, error } = await tryCatch(redis.get<T>(key));
  if (error) {
    logger.warn(`[Cache] Redis error fetching raw key "${key}"`, { error });
    return null;
  }
  return data;
}

/**
 * Set a cache value with a TTL.
 */
export async function setCacheRaw(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const { error } = await tryCatch(redis.set(key, value, { ex: ttlSeconds }));
  if (error) {
    logger.warn(`[Cache] Failed to set raw key "${key}" in Redis`, { error });
  }
}

/**
 * Delete a cached value.
 */
export async function invalidateCache(key: string): Promise<void> {
  const { error } = await tryCatch(redis.del(key));
  if (error) {
    logger.warn(`[Cache] Failed to invalidate key "${key}" in Redis`, { error });
  }
}

/**
 * Convenience wrapper around getCache for Prisma queries.
 * Caches the result of a Prisma query with the given key and TTL.
 *
 * On cache hit, returns the cached value without executing the query.
 * On cache miss or Redis error, executes the query and caches the result.
 */
export async function cachedPrismaQuery<T>(
  key: string,
  ttlSeconds: number,
  query: () => Promise<T>,
): Promise<T> {
  return getCache<T>(key, ttlSeconds, query);
}
