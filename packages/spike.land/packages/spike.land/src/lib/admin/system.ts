/**
 * Admin System Health Business Logic
 *
 * System health metrics, job processing stats, and storage information.
 */

import { formatBytes } from "@/lib/admin/formatters";
import { EnhancementTier, JobStatus } from "@prisma/client";

// ---- Health Metrics ----

export interface TierStat {
  tier: EnhancementTier;
  total: number;
  failed: number;
  failureRate: number;
}

export interface SystemHealthMetrics {
  hourlyJobs: Array<{ hour: string; count: number; }>;
  avgProcessingTime: Array<{ tier: string; seconds: number; }>;
  tierStats: TierStat[];
  queueDepth: number;
  jobsByStatus: Array<{ status: JobStatus; count: number; }>;
  recentFailures: Array<{
    id: string;
    tier: EnhancementTier;
    error: string | null;
    timestamp: string;
  }>;
}

export interface FailureByTier {
  tier: EnhancementTier;
  status: JobStatus;
  _count: number;
}

export function calculateTierStats(
  failuresByTier: FailureByTier[],
): TierStat[] {
  return Object.values(EnhancementTier).map(tier => {
    const tierJobs = failuresByTier.filter(f => f.tier === tier);
    const total = tierJobs.reduce((sum, j) => sum + j._count, 0);
    const failed = tierJobs.find(j => j.status === JobStatus.FAILED)?._count || 0;
    return {
      tier,
      total,
      failed,
      failureRate: total > 0 ? (failed / total) * 100 : 0,
    };
  });
}

export async function getSystemHealthMetrics(): Promise<SystemHealthMetrics> {
  const prisma = (await import("@/lib/prisma")).default;

  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    hourlyJobsRaw,
    avgProcessingTimeRaw,
    failuresByTier,
    queueDepth,
    jobsByStatusRaw,
    recentFailuresRaw,
  ] = await Promise.all([
    prisma
      .$queryRaw<Array<{ hour: Date; count: bigint; }>>`
      SELECT DATE_TRUNC('hour', "createdAt") as hour, COUNT(*)::bigint as count
      FROM image_enhancement_jobs
      WHERE "createdAt" >= ${last24Hours}
      GROUP BY DATE_TRUNC('hour', "createdAt")
      ORDER BY hour ASC
    `
      .catch(() => []),
    prisma
      .$queryRaw<Array<{ tier: string; avg_seconds: number; }>>`
      SELECT
        tier,
        AVG(EXTRACT(EPOCH FROM ("processingCompletedAt" - "processingStartedAt")))::float as avg_seconds
      FROM image_enhancement_jobs
      WHERE status = 'COMPLETED'
        AND "processingStartedAt" IS NOT NULL
        AND "processingCompletedAt" IS NOT NULL
        AND "createdAt" >= ${last7Days}
      GROUP BY tier
    `
      .catch(() => []),
    prisma.imageEnhancementJob
      .groupBy({
        by: ["tier", "status"],
        where: { createdAt: { gte: last7Days } },
        _count: true,
      })
      .catch(() => []),
    prisma.imageEnhancementJob
      .count({
        where: {
          status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] },
        },
      })
      .catch(() => 0),
    prisma.imageEnhancementJob
      .groupBy({
        by: ["status"],
        _count: true,
      })
      .catch(() => []),
    prisma.imageEnhancementJob
      .findMany({
        where: {
          status: JobStatus.FAILED,
          createdAt: { gte: last7Days },
        },
        select: { id: true, tier: true, errorMessage: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
      .catch(() => []),
  ]);

  return {
    hourlyJobs: Array.isArray(hourlyJobsRaw)
      ? hourlyJobsRaw.map(row => ({
        hour: row.hour.toISOString(),
        count: Number(row.count),
      }))
      : [],
    avgProcessingTime: Array.isArray(avgProcessingTimeRaw)
      ? avgProcessingTimeRaw.map(row => ({
        tier: row.tier,
        seconds: Math.round(row.avg_seconds || 0),
      }))
      : [],
    tierStats: calculateTierStats(failuresByTier as FailureByTier[]),
    queueDepth: typeof queueDepth === "number" ? queueDepth : 0,
    jobsByStatus: Array.isArray(jobsByStatusRaw)
      ? jobsByStatusRaw.map(
        (item: { status: JobStatus; _count: number; }) => ({
          status: item.status,
          count: item._count,
        }),
      )
      : [],
    recentFailures: Array.isArray(recentFailuresRaw)
      ? recentFailuresRaw.map(
        (job: {
          id: string;
          tier: EnhancementTier;
          errorMessage: string | null;
          createdAt: Date;
        }) => ({
          id: job.id,
          tier: job.tier,
          error: job.errorMessage?.slice(0, 500) ?? null,
          timestamp: job.createdAt.toISOString(),
        }),
      )
      : [],
  };
}

// ---- Storage Stats ----

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"];

export interface StorageStats {
  totalFiles: number;
  totalSizeBytes: number;
  totalSizeFormatted: string;
  averageSizeBytes: number;
  averageSizeFormatted: string;
  imageStats: { count: number; sizeBytes: number; sizeFormatted: string; };
  byFileType: Record<
    string,
    { count: number; sizeBytes: number; sizeFormatted: string; }
  >;
  isConfigured: boolean;
}

export async function getStorageStats(): Promise<StorageStats> {
  const { isStorageConfigured, listR2StorageStats } = await import(
    "@/lib/storage/r2-client"
  );

  if (!isStorageConfigured()) {
    return {
      totalFiles: 0,
      totalSizeBytes: 0,
      totalSizeFormatted: "0 B",
      averageSizeBytes: 0,
      averageSizeFormatted: "0 B",
      imageStats: { count: 0, sizeBytes: 0, sizeFormatted: "0 B" },
      byFileType: {},
      isConfigured: false,
    };
  }

  const result = await listR2StorageStats();

  if (!result.success || !result.stats) {
    throw new Error(result.error || "Failed to fetch storage stats");
  }

  const { stats } = result;
  let imageCount = 0;
  let imageSizeBytes = 0;

  for (const ext of IMAGE_EXTENSIONS) {
    if (stats.byFileType[ext]) {
      imageCount += stats.byFileType[ext].count;
      imageSizeBytes += stats.byFileType[ext].sizeBytes;
    }
  }

  const byFileTypeFormatted: Record<
    string,
    { count: number; sizeBytes: number; sizeFormatted: string; }
  > = {};

  for (const [ext, data] of Object.entries(stats.byFileType)) {
    byFileTypeFormatted[ext] = {
      count: data.count,
      sizeBytes: data.sizeBytes,
      sizeFormatted: formatBytes(data.sizeBytes),
    };
  }

  return {
    totalFiles: stats.totalFiles,
    totalSizeBytes: stats.totalSizeBytes,
    totalSizeFormatted: formatBytes(stats.totalSizeBytes),
    averageSizeBytes: stats.averageSizeBytes,
    averageSizeFormatted: formatBytes(stats.averageSizeBytes),
    imageStats: {
      count: imageCount,
      sizeBytes: imageSizeBytes,
      sizeFormatted: formatBytes(imageSizeBytes),
    },
    byFileType: byFileTypeFormatted,
    isConfigured: true,
  };
}
