/**
 * Health Calculator
 *
 * Calculates health scores for social accounts based on multiple factors:
 * - Sync status (30%): Last successful sync time and consecutive errors
 * - Rate limit usage (25%): Current rate limit consumption
 * - Error frequency (25%): Error count in last 24 hours
 * - Token health (20%): Token expiration status
 *
 * Resolves #586: Implement Account Health Monitor
 */

import type { AccountHealthStatus, SocialAccountHealth } from "@prisma/client";

import prisma from "@/lib/prisma";

import {
  DEFAULT_HEALTH_WEIGHTS,
  HEALTH_THRESHOLDS,
  type HealthWeights,
  type UpdateHealthOptions,
} from "./types";

/**
 * Calculate overall health score based on individual component scores
 */
export function calculateHealthScore(
  syncScore: number,
  rateLimitScore: number,
  errorScore: number,
  tokenScore: number,
  weights: HealthWeights = DEFAULT_HEALTH_WEIGHTS,
): number {
  const score = Math.round(
    syncScore * weights.syncStatus
      + rateLimitScore * weights.rateLimitUsage
      + errorScore * weights.errorFrequency
      + tokenScore * weights.tokenHealth,
  );

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate sync status score (0-100)
 * Based on last sync time and consecutive errors
 */
export function calculateSyncScore(
  lastSuccessfulSync: Date | null,
  consecutiveErrors: number,
): number {
  // If never synced, score is 0
  if (!lastSuccessfulSync) {
    return 0;
  }

  const now = new Date();
  const hoursSinceSync = (now.getTime() - lastSuccessfulSync.getTime())
    / (1000 * 60 * 60);

  // Base score from sync time
  let score = 100;
  if (hoursSinceSync > 48) {
    score = 20; // Very stale
  } else if (hoursSinceSync > 24) {
    score = 50; // Stale
  } else if (hoursSinceSync > 12) {
    score = 70; // Somewhat fresh
  } else if (hoursSinceSync > 6) {
    score = 85; // Fairly fresh
  }

  // Deduct for consecutive errors
  score -= consecutiveErrors * 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate rate limit score (0-100)
 * Based on remaining rate limit percentage
 */
export function calculateRateLimitScore(
  remaining: number | null,
  total: number | null,
  isRateLimited: boolean,
): number {
  // If rate limited, score is 0
  if (isRateLimited) {
    return 0;
  }

  // If no rate limit data, assume healthy
  if (remaining === null || total === null || total === 0) {
    return 100;
  }

  const percentUsed = ((total - remaining) / total) * 100;

  if (percentUsed >= 95) {
    return 10; // Critical - nearly exhausted
  } else if (percentUsed >= 85) {
    return 30; // Warning - high usage
  } else if (percentUsed >= 70) {
    return 60; // Moderate usage
  } else if (percentUsed >= 50) {
    return 80; // Normal usage
  }

  return 100; // Low usage
}

/**
 * Calculate error frequency score (0-100)
 * Based on number of errors in last 24 hours
 */
export function calculateErrorScore(totalErrorsLast24h: number): number {
  if (totalErrorsLast24h === 0) {
    return 100;
  } else if (totalErrorsLast24h <= 2) {
    return 80;
  } else if (totalErrorsLast24h <= 5) {
    return 60;
  } else if (totalErrorsLast24h <= 10) {
    return 40;
  } else if (totalErrorsLast24h <= 20) {
    return 20;
  }

  return 0;
}

/**
 * Calculate token health score (0-100)
 * Based on token expiration time
 */
export function calculateTokenScore(
  tokenExpiresAt: Date | null,
  tokenRefreshRequired: boolean,
): number {
  // Token refresh required
  if (tokenRefreshRequired) {
    return 20;
  }

  // No expiration date - assume long-lived token
  if (!tokenExpiresAt) {
    return 100;
  }

  const now = new Date();
  const hoursUntilExpiry = (tokenExpiresAt.getTime() - now.getTime())
    / (1000 * 60 * 60);

  // Already expired
  if (hoursUntilExpiry <= 0) {
    return 0;
  } else if (hoursUntilExpiry <= 6) {
    return 20; // Expiring very soon
  } else if (hoursUntilExpiry <= 24) {
    return 50; // Expiring within a day
  } else if (hoursUntilExpiry <= 72) {
    return 75; // Expiring within 3 days
  } else if (hoursUntilExpiry <= 168) {
    return 90; // Expiring within a week
  }

  return 100; // More than a week until expiry
}

/**
 * Map health score to status
 */
export function scoreToStatus(score: number): AccountHealthStatus {
  if (score >= HEALTH_THRESHOLDS.HEALTHY) {
    return "HEALTHY";
  } else if (score >= HEALTH_THRESHOLDS.DEGRADED) {
    return "DEGRADED";
  } else if (score >= HEALTH_THRESHOLDS.UNHEALTHY) {
    return "UNHEALTHY";
  }
  return "CRITICAL";
}

/**
 * Calculate full health for an account
 */
export function calculateFullHealth(
  health: SocialAccountHealth,
  weights: HealthWeights = DEFAULT_HEALTH_WEIGHTS,
): { score: number; status: AccountHealthStatus; } {
  const syncScore = calculateSyncScore(
    health.lastSuccessfulSync,
    health.consecutiveErrors,
  );

  const rateLimitScore = calculateRateLimitScore(
    health.rateLimitRemaining,
    health.rateLimitTotal,
    health.isRateLimited,
  );

  const errorScore = calculateErrorScore(health.totalErrorsLast24h);

  const tokenScore = calculateTokenScore(
    health.tokenExpiresAt,
    health.tokenRefreshRequired,
  );

  const score = calculateHealthScore(
    syncScore,
    rateLimitScore,
    errorScore,
    tokenScore,
    weights,
  );

  return {
    score,
    status: scoreToStatus(score),
  };
}

/**
 * Create or get health record for an account
 */
export async function getOrCreateHealth(
  accountId: string,
): Promise<SocialAccountHealth> {
  // upsert eliminates the separate findUnique + create round-trip
  return prisma.socialAccountHealth.upsert({
    where: { accountId },
    create: {
      accountId,
      healthScore: 100,
      status: "HEALTHY",
    },
    update: {},
  });
}

/**
 * Update health metrics for an account
 */
export async function updateHealth(
  accountId: string,
  options: UpdateHealthOptions,
): Promise<SocialAccountHealth> {
  // Upsert ensures record exists and applies options atomically (replaces getOrCreateHealth + update)
  const updated = await prisma.socialAccountHealth.upsert({
    where: { accountId },
    create: {
      accountId,
      healthScore: 100,
      status: "HEALTHY",
      ...options,
    },
    update: {
      ...options,
      updatedAt: new Date(),
    },
  });

  // Recalculate health score and write back only if changed
  const { score, status } = calculateFullHealth(updated);

  if (score !== updated.healthScore || status !== updated.status) {
    return prisma.socialAccountHealth.update({
      where: { accountId },
      data: {
        healthScore: score,
        status,
      },
    });
  }

  return updated;
}


