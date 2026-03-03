/**
 * Metrics Caching Layer
 *
 * Provides caching for campaign analytics metrics using the CampaignMetricsCache
 * Prisma model. Supports TTL-based expiration with automatic cleanup.
 */

import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

/**
 * Get cached metrics by cache key
 *
 * @param cacheKey - Unique identifier for the cached data
 * @returns The cached metrics or null if not found/expired
 */
export async function getCachedMetrics<T>(cacheKey: string): Promise<T | null> {
  const { data: cached, error } = await tryCatch(
    prisma.campaignMetricsCache.findUnique({
      where: { cacheKey },
    }),
  );

  if (error) {
    logger.error("Error fetching cached metrics", error);
    return null;
  }

  if (!cached) {
    return null;
  }

  // Check if cache has expired
  if (new Date() > cached.expiresAt) {
    // Optionally delete expired cache entry
    // Fire and forget, ignore result
    // Use deleteMany to avoid P2025 error if record was already deleted by concurrent cleanup
    void tryCatch(
      prisma.campaignMetricsCache.deleteMany({
        where: { cacheKey },
      }),
    );
    return null;
  }

  return cached.metrics as T;
}

/**
 * Set cached metrics with TTL
 *
 * @param cacheKey - Unique identifier for the cached data
 * @param metrics - The metrics data to cache (must be JSON-serializable)
 * @param ttlSeconds - Time-to-live in seconds (default: 300 / 5 minutes)
 */
export async function setCachedMetrics(
  cacheKey: string,
  metrics: unknown,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  const { error } = await tryCatch(
    prisma.campaignMetricsCache.upsert({
      where: { cacheKey },
      update: {
        metrics: metrics as object,
        computedAt: now,
        expiresAt,
      },
      create: {
        cacheKey,
        metrics: metrics as object,
        computedAt: now,
        expiresAt,
      },
    }),
  );

  if (error) {
    logger.error("Error setting cached metrics", error);
    // Cache failures should not break the main flow
  }
}

/**
 * Invalidate cache entries matching a pattern
 *
 * @param pattern - Optional pattern to match cache keys (uses SQL LIKE syntax)
 *                  If not provided, invalidates all cache entries
 * @returns Number of invalidated entries
 */
export async function invalidateCache(pattern?: string): Promise<number> {
  let result;

  if (pattern) {
    // Use raw query for pattern matching since Prisma doesn't support LIKE on unique fields easily
    result = await tryCatch(
      prisma.campaignMetricsCache.deleteMany({
        where: {
          cacheKey: {
            contains: pattern,
          },
        },
      }),
    );
  } else {
    // Delete all cache entries
    result = await tryCatch(prisma.campaignMetricsCache.deleteMany({}));
  }

  const { data, error } = result;

  if (error) {
    logger.error("Error invalidating cache", error);
    return 0;
  }

  return data?.count || 0;
}

/**
 * Clean up expired cache entries
 *
 * This should be called periodically (e.g., by a cron job)
 *
 * @returns Number of deleted entries
 */
export async function cleanupExpiredCache(): Promise<number> {
  const { data, error } = await tryCatch(
    prisma.campaignMetricsCache.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    }),
  );

  if (error) {
    logger.error("Error cleaning up expired cache", error);
    return 0;
  }

  return data?.count || 0;
}

/**
 * Build a standardized cache key for analytics queries
 *
 * @param prefix - Cache key prefix (e.g., "overview", "campaigns")
 * @param params - Parameters to include in the key
 * @returns Formatted cache key
 */
export function buildCacheKey(
  prefix: string,
  params: Record<string, string | number | undefined>,
): string {
  const parts = [prefix];

  // Sort keys for consistent ordering
  const sortedKeys = Object.keys(params).sort();

  for (const key of sortedKeys) {
    const value = params[key];
    if (value !== undefined) {
      parts.push(`${key}:${value}`);
    }
  }

  return parts.join(":");
}

/**
 * Helper to get or compute cached metrics
 *
 * @param cacheKey - Unique identifier for the cached data
 * @param computeFn - Function to compute metrics if not cached
 * @param ttlSeconds - Time-to-live in seconds
 * @returns The cached or newly computed metrics
 */
export async function getOrComputeMetrics<T>(
  cacheKey: string,
  computeFn: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<T> {
  // Try to get from cache first
  const cached = await getCachedMetrics<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Compute fresh metrics
  const metrics = await computeFn();

  // Cache the result (fire and forget)
  setCachedMetrics(cacheKey, metrics, ttlSeconds).catch(() => {
    // Ignore cache set errors
  });

  return metrics;
}
