/**
 * Sync Monitor
 *
 * Tracks synchronization status for social accounts.
 * Records successful syncs, failures, and consecutive errors.
 *
 * Resolves #586: Implement Account Health Monitor
 */

import type { SocialAccountHealth } from "@prisma/client";

import prisma from "@/lib/prisma";

import { getOrCreateHealth, updateHealth } from "./health-calculator";

/**
 * Record a successful sync for an account
 */
export async function recordSuccessfulSync(
  accountId: string,
): Promise<SocialAccountHealth> {
  // Ensure health record exists
  await getOrCreateHealth(accountId);

  return updateHealth(accountId, {
    lastSuccessfulSync: new Date(),
    lastSyncAttempt: new Date(),
    consecutiveErrors: 0, // Reset on success
  });
}

/**
 * Record a failed sync for an account
 */
export async function recordFailedSync(
  accountId: string,
  errorMessage: string,
): Promise<SocialAccountHealth> {
  const health = await getOrCreateHealth(accountId);

  return updateHealth(accountId, {
    lastSyncAttempt: new Date(),
    lastError: errorMessage,
    lastErrorAt: new Date(),
    consecutiveErrors: health.consecutiveErrors + 1,
    totalErrorsLast24h: health.totalErrorsLast24h + 1,
  });
}

/**
 * Get sync status for an account
 */
export async function getSyncStatus(accountId: string): Promise<{
  lastSuccessfulSync: Date | null;
  lastSyncAttempt: Date | null;
  lastError: string | null;
  consecutiveErrors: number;
  isSyncing: boolean;
  syncHealthy: boolean;
}> {
  const health = await getOrCreateHealth(accountId);

  // Consider sync healthy if last successful sync was within 24 hours
  const syncHealthy = health.lastSuccessfulSync !== null
    && new Date().getTime() - health.lastSuccessfulSync.getTime()
      < 24 * 60 * 60 * 1000;

  return {
    lastSuccessfulSync: health.lastSuccessfulSync,
    lastSyncAttempt: health.lastSyncAttempt,
    lastError: health.lastError,
    consecutiveErrors: health.consecutiveErrors,
    isSyncing: false, // Would need additional state tracking for real-time sync status
    syncHealthy,
  };
}

/**
 * Reset error counters for accounts in a workspace
 * Called daily to refresh totalErrorsLast24h
 */
export async function resetDailyErrorCounters(
  workspaceId: string,
): Promise<number> {
  const result = await prisma.socialAccountHealth.updateMany({
    where: {
      account: { workspaceId },
    },
    data: {
      totalErrorsLast24h: 0,
    },
  });

  return result.count;
}

/**
 * Get accounts with sync issues in a workspace
 */
export async function getAccountsWithSyncIssues(workspaceId: string): Promise<
  Array<{
    accountId: string;
    accountName: string;
    platform: string;
    lastSuccessfulSync: Date | null;
    consecutiveErrors: number;
    lastError: string | null;
  }>
> {
  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  const accounts = await prisma.socialAccount.findMany({
    where: {
      workspaceId,
      health: {
        OR: [
          { lastSuccessfulSync: { lt: staleThreshold } },
          { lastSuccessfulSync: null },
          { consecutiveErrors: { gte: 3 } },
        ],
      },
    },
    include: {
      health: true,
    },
  });

  return accounts
    .filter(account => account.health !== null)
    .map(account => ({
      accountId: account.id,
      accountName: account.accountName,
      platform: account.platform,
      lastSuccessfulSync: account.health!.lastSuccessfulSync,
      consecutiveErrors: account.health!.consecutiveErrors,
      lastError: account.health!.lastError,
    }));
}

/**
 * Check if account needs sync based on last sync time
 */
export async function needsSync(
  accountId: string,
  maxAgeHours: number = 24,
): Promise<boolean> {
  const health = await prisma.socialAccountHealth.findUnique({
    where: { accountId },
  });

  if (!health || !health.lastSuccessfulSync) {
    return true;
  }

  const ageMs = Date.now() - health.lastSuccessfulSync.getTime();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  return ageMs > maxAgeMs;
}

/**
 * Get accounts that need syncing in a workspace
 */
export async function getAccountsNeedingSync(
  workspaceId: string,
  maxAgeHours: number = 24,
): Promise<string[]> {
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  const accounts = await prisma.socialAccount.findMany({
    where: {
      workspaceId,
      status: "ACTIVE",
      OR: [
        { health: null },
        { health: { lastSuccessfulSync: null } },
        { health: { lastSuccessfulSync: { lt: cutoffTime } } },
      ],
    },
    select: { id: true },
  });

  return accounts.map(a => a.id);
}
