/**
 * Bin Cleanup Utility
 *
 * Handles automatic cleanup of apps that have been in the bin for longer than
 * the retention period (default 30 days).
 */

import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";

export interface BinCleanupOptions {
  /** Number of days to retain apps in bin before cleanup (default: 30) */
  retentionDays?: number;
  /** If true, only report what would be deleted without actually deleting */
  dryRun?: boolean;
  /** Maximum number of apps to process in one run (default: 100) */
  batchSize?: number;
}

export interface CleanupAppResult {
  id: string;
  name: string;
  userId: string;
  deletedAt: Date;
  error?: string;
}

export interface BinCleanupResult {
  totalFound: number;
  deleted: number;
  failed: number;
  dryRun: boolean;
  apps: CleanupAppResult[];
  errors: Array<{ appId: string; error: string; }>;
}

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_BATCH_SIZE = 100;

/**
 * Clean up apps that have been in the bin for longer than the retention period.
 * This function hard-deletes apps and all their related data (cascades).
 */
export async function cleanupExpiredBinApps(
  options: BinCleanupOptions = {},
): Promise<BinCleanupResult> {
  const {
    retentionDays = DEFAULT_RETENTION_DAYS,
    dryRun = false,
    batchSize = DEFAULT_BATCH_SIZE,
  } = options;

  // Calculate the threshold date
  const thresholdDate = new Date(
    Date.now() - retentionDays * 24 * 60 * 60 * 1000,
  );

  // Find expired apps
  const { data: expiredApps, error: fetchError } = await tryCatch(
    prisma.app.findMany({
      where: {
        deletedAt: {
          lte: thresholdDate,
        },
      },
      select: {
        id: true,
        name: true,
        userId: true,
        deletedAt: true,
      },
      take: batchSize,
      orderBy: {
        deletedAt: "asc", // Delete oldest first
      },
    }),
  );

  if (fetchError) {
    logger.error("Error fetching expired bin apps", { error: fetchError });
    throw new Error(`Failed to fetch expired apps: ${fetchError.message}`);
  }

  const result: BinCleanupResult = {
    totalFound: expiredApps.length,
    deleted: 0,
    failed: 0,
    dryRun,
    apps: [],
    errors: [],
  };

  if (expiredApps.length === 0) {
    return result;
  }

  // Process each app
  for (const app of expiredApps) {
    const appResult: CleanupAppResult = {
      id: app.id,
      name: app.name,
      userId: app.userId,
      deletedAt: app.deletedAt as Date,
    };

    if (dryRun) {
      // In dry run mode, just report what would be deleted
      result.apps.push(appResult);
      result.deleted++;
      continue;
    }

    // Actually delete the app
    const { error: deleteError } = await tryCatch(
      prisma.app.delete({
        where: { id: app.id },
      }),
    );

    if (deleteError) {
      logger.error(`Error deleting app ${app.id}`, { error: deleteError });
      appResult.error = deleteError.message;
      result.apps.push(appResult);
      result.errors.push({
        appId: app.id,
        error: deleteError.message,
      });
      result.failed++;
    } else {
      result.apps.push(appResult);
      result.deleted++;
      logger.info(
        `Cleaned up expired bin app: ${app.name} (${app.id}), user: ${app.userId}`,
      );
    }
  }

  return result;
}

/**
 * Get statistics about apps currently in the bin.
 */
export async function getBinStats(): Promise<{
  totalInBin: number;
  expiringWithin7Days: number;
  expiringWithin24Hours: number;
}> {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const retentionMs = DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const { data: stats, error } = await tryCatch(
    prisma.app.groupBy({
      by: ["id"],
      where: {
        deletedAt: { not: null },
      },
      _count: true,
    }),
  );

  if (error) {
    logger.error("Error getting bin stats", { error });
    return {
      totalInBin: 0,
      expiringWithin7Days: 0,
      expiringWithin24Hours: 0,
    };
  }

  // Get apps with their deletedAt to calculate expiry
  const { data: apps } = await tryCatch(
    prisma.app.findMany({
      where: { deletedAt: { not: null } },
      select: { deletedAt: true },
    }),
  );

  let expiringWithin7Days = 0;
  let expiringWithin24Hours = 0;

  for (const app of apps || []) {
    const deletedAt = app.deletedAt as Date;
    const expiresAt = new Date(deletedAt.getTime() + retentionMs);

    if (expiresAt <= in24Hours) {
      expiringWithin24Hours++;
      expiringWithin7Days++;
    } else if (expiresAt <= in7Days) {
      expiringWithin7Days++;
    }
  }

  return {
    totalInBin: stats.length,
    expiringWithin7Days,
    expiringWithin24Hours,
  };
}
