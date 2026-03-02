import { checkSessionHealth, checkSessionsHealth } from "@/lib/codespace/session-service";
import logger from "@/lib/logger";
import { tryCatch } from "@/lib/try-catch";

// Cache health check results for 60 seconds
const healthCache = new Map<string, { healthy: boolean; cachedAt: number }>();
const CACHE_TTL_MS = 60_000;

/**
 * Check if a codespace has real, non-default content
 */
export async function isCodespaceHealthy(codespaceId: string): Promise<boolean> {
  // Check cache first
  const cached = healthCache.get(codespaceId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.healthy;
  }

  const { data: healthy, error } = await tryCatch(checkSessionHealth(codespaceId));

  if (error || healthy === undefined) {
    logger.warn(`[codespace-health] No session found for ${codespaceId}`);
    cacheResult(codespaceId, false);
    return false;
  }

  cacheResult(codespaceId, healthy);
  return healthy;
}

function cacheResult(codespaceId: string, healthy: boolean) {
  healthCache.set(codespaceId, { healthy, cachedAt: Date.now() });
}

/**
 * Batch check multiple codespace IDs
 */
export async function filterHealthyCodespaces<T extends { codespaceId: string | null }>(
  items: T[],
): Promise<T[]> {
  const needsCheck = new Set<string>();
  const results = new Map<string, boolean>();

  // First pass: Check local cache
  for (const item of items) {
    if (!item.codespaceId) continue;

    const cached = healthCache.get(item.codespaceId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      results.set(item.codespaceId, cached.healthy);
    } else {
      needsCheck.add(item.codespaceId);
    }
  }

  // Second pass: Batch check missing items
  if (needsCheck.size > 0) {
    const { data: batchResults, error } = await tryCatch(
      checkSessionsHealth(Array.from(needsCheck)),
    );

    if (error) {
      logger.warn(`[codespace-health] Batch health check failed: ${error.message}`);
    }

    if (batchResults) {
      batchResults.forEach((healthy, id) => {
        cacheResult(id, healthy);
        results.set(id, healthy);
      });
    }

    // For any that are still missing (failed or not found), mark as unhealthy and cache it
    needsCheck.forEach((id) => {
      if (!results.has(id)) {
        // Only cache failure if we didn't get a result (e.g. DB error handled inside checkSessionsHealth)
        cacheResult(id, false);
        results.set(id, false);
      }
    });
  }

  return items.filter((item) => {
    if (!item.codespaceId) return false;
    return results.get(item.codespaceId) === true;
  });
}

/**
 * Re-validate a published app by checking its codespace health.
 * Returns true if the app is healthy, false if it should be marked as FAILED.
 * This is a lightweight check intended to be called on page access.
 */
export async function revalidatePublishedApp(codespaceId: string): Promise<boolean> {
  // Bypass cache for revalidation — we want a fresh check
  healthCache.delete(codespaceId);
  return isCodespaceHealthy(codespaceId);
}

// Export for testing
export { healthCache };
