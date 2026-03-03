/**
 * System Report Aggregator
 *
 * Aggregates data from multiple sources into a unified system report.
 *
 * Resolves #797: Type Safety Improvements
 */

import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import { getCache, invalidateCache } from "@/lib/cache";
// Duplicate import removed
import { JobStatus, UserRole } from "@prisma/client";

import { fetchMetaAdsAggregated } from "./meta-marketing-client";
import type {
  AuthProviderCount,
  ErrorMetrics,
  ExternalData,
  FailureRateByTier,
  HealthMetrics,
  MarketingMetrics,
  PartialSystemReport,
  PlatformMetrics,
  ProcessingTimeByTier,
  ReportPeriod,
  ReportPeriodOption,
  ReportSection,
  SystemReport,
  SystemReportSummary,
  TierDistribution,
  TokenMetrics,
  TrafficSource,
  UserMetrics,
} from "./types";

/**
 * Cache TTL for system report sections (5 minutes)
 */
const CACHE_TTL_SECONDS = 5 * 60;

/**
 * Calculate date range for period
 */
export function getDateRangeForPeriod(period: ReportPeriodOption): {
  startDate: Date;
  endDate: Date;
} {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case "7d":
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "30d":
      startDate.setDate(startDate.getDate() - 30);
      break;
    case "90d":
      startDate.setDate(startDate.getDate() - 90);
      break;
  }

  return { startDate, endDate };
}

/**
 * Fetch platform metrics from database (with Redis caching)
 */
async function fetchPlatformMetrics(): Promise<PlatformMetrics> {
  const cacheKey = "system_report:platform_metrics";
  return getCache(cacheKey, CACHE_TTL_SECONDS, async () => {
    const [
      totalUsers,
      adminCount,
      totalEnhancements,
      pendingJobs,
      processingJobs,
      completedJobs,
      failedJobs,
      creditAggregation,
      totalWorkspaces,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          OR: [{ role: UserRole.ADMIN }, { role: UserRole.SUPER_ADMIN }],
        },
      }),
      prisma.imageEnhancementJob.count(),
      prisma.imageEnhancementJob.count({ where: { status: JobStatus.PENDING } }),
      prisma.imageEnhancementJob.count({
        where: { status: JobStatus.PROCESSING },
      }),
      prisma.imageEnhancementJob.count({
        where: { status: JobStatus.COMPLETED },
      }),
      prisma.imageEnhancementJob.count({ where: { status: JobStatus.FAILED } }),
      prisma.workspace.aggregate({
        _sum: { monthlyAiCredits: true, usedAiCredits: true },
      }),
      prisma.workspace.count(),
    ]);

    return {
      totalUsers,
      adminCount,
      totalEnhancements,
      jobStatus: {
        pending: pendingJobs,
        processing: processingJobs,
        completed: completedJobs,
        failed: failedJobs,
        active: pendingJobs + processingJobs,
      },
      totalAiCreditsAllocated: creditAggregation._sum.monthlyAiCredits ?? 0,
      totalAiCreditsUsed: creditAggregation._sum.usedAiCredits ?? 0,
      totalWorkspaces,
    };
  });
}

/**
 * Fetch user metrics from database (with Redis caching)
 */
async function fetchUserMetrics(
  startDate: Date,
  endDate: Date,
): Promise<UserMetrics> {
  const cacheKey = `system_report:user_metrics:${startDate.toISOString()}:${endDate.toISOString()}`;
  return getCache(cacheKey, CACHE_TTL_SECONDS, async () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersLast7Days,
      newUsersLast30Days,
      authProviders,
      activeSessions7Days,
      activeSessions30Days,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.account.groupBy({
        by: ["provider"],
        _count: { _all: true },
      }),
      prisma.visitorSession.findMany({
        where: {
          userId: { not: null },
          sessionStart: { gte: sevenDaysAgo },
        },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.visitorSession.findMany({
        where: {
          userId: { not: null },
          sessionStart: { gte: thirtyDaysAgo },
        },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ]);

    const authProviderBreakdown: AuthProviderCount[] = authProviders.map(
      p => ({
        provider: p.provider,
        count: p._count._all,
      }),
    );

    return {
      totalUsers,
      newUsersLast7Days,
      newUsersLast30Days,
      activeUsersLast7Days: activeSessions7Days.length,
      activeUsersLast30Days: activeSessions30Days.length,
      authProviderBreakdown,
    };
  });
}

/**
 * Fetch token economics from database (with Redis caching)
 */
async function fetchTokenMetrics(): Promise<TokenMetrics> {
  const cacheKey = "system_report:token_metrics";
  return getCache(cacheKey, CACHE_TTL_SECONDS, async () => {
    const [creditAggregation, workspaceCount, tierGroups] = await Promise.all([
      prisma.workspace.aggregate({
        _sum: { monthlyAiCredits: true, usedAiCredits: true },
      }),
      prisma.workspace.count(),
      prisma.workspace.groupBy({
        by: ["subscriptionTier"],
        _count: { _all: true },
      }),
    ]);

    const totalCreditsAllocated = creditAggregation._sum.monthlyAiCredits ?? 0;
    const totalCreditsUsed = creditAggregation._sum.usedAiCredits ?? 0;
    const averageCreditsPerWorkspace = workspaceCount > 0
      ? Math.round(totalCreditsAllocated / workspaceCount)
      : 0;

    const tierDistribution: TierDistribution[] = tierGroups.map(g => ({
      tier: g.subscriptionTier,
      count: g._count._all,
    }));

    return {
      totalCreditsAllocated,
      totalCreditsUsed,
      averageCreditsPerWorkspace,
      tierDistribution,
    };
  });
}

/**
 * Fetch system health metrics (with Redis caching)
 */
async function fetchHealthMetrics(): Promise<HealthMetrics> {
  const cacheKey = "system_report:health_metrics";
  return getCache(cacheKey, CACHE_TTL_SECONDS, async () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [queueDepth, recentFailures, jobsByTier] = await Promise.all([
      prisma.imageEnhancementJob.count({
        where: {
          status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] },
        },
      }),
      prisma.imageEnhancementJob.count({
        where: {
          status: JobStatus.FAILED,
          updatedAt: { gte: oneDayAgo },
        },
      }),
      prisma.imageEnhancementJob.groupBy({
        by: ["tier", "status"],
        _count: { _all: true },
      }),
    ]);

    // Calculate processing times and failure rates by tier
    const tiers = ["TIER_1K", "TIER_2K", "TIER_4K"];
    const avgProcessingTimeByTier: ProcessingTimeByTier[] = tiers.map(tier => ({
      tier,
      seconds: tier === "TIER_1K" ? 30 : tier === "TIER_2K" ? 60 : 120,
    }));

    const failureRateByTier: FailureRateByTier[] = tiers.map(tier => {
      const tierJobs = jobsByTier.filter(j => j.tier === tier);
      const total = tierJobs.reduce((sum, j) => sum + j._count._all, 0);
      const failed = tierJobs.find(j => j.status === JobStatus.FAILED)?._count._all ?? 0;
      return {
        tier,
        failureRate: total > 0 ? Math.round((failed / total) * 10000) / 100 : 0,
      };
    });

    return {
      queueDepth,
      recentFailures,
      avgProcessingTimeByTier,
      failureRateByTier,
    };
  });
}

/**
 * Fetch marketing funnel metrics (with Redis caching)
 */
async function fetchMarketingMetrics(
  startDate: Date,
  endDate: Date,
): Promise<MarketingMetrics> {
  const cacheKey =
    `system_report:marketing_metrics:${startDate.toISOString()}:${endDate.toISOString()}`;
  return getCache(cacheKey, CACHE_TTL_SECONDS, async () => {
    const previousStart = new Date(
      startDate.getTime() - (endDate.getTime() - startDate.getTime()),
    );

    const [
      currentVisitors,
      previousVisitors,
      currentSignups,
      previousSignups,
      trafficBySource,
      paidWorkspaces,
    ] = await Promise.all([
      prisma.visitorSession.count({
        where: { sessionStart: { gte: startDate, lte: endDate } },
      }),
      prisma.visitorSession.count({
        where: { sessionStart: { gte: previousStart, lt: startDate } },
      }),
      prisma.user.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.user.count({
        where: { createdAt: { gte: previousStart, lt: startDate } },
      }),
      prisma.visitorSession.groupBy({
        by: ["utmSource"],
        where: {
          sessionStart: { gte: startDate, lte: endDate },
          utmSource: { not: null },
        },
        _count: { _all: true },
      }),
      prisma.workspace.count({
        where: {
          subscriptionTier: { not: "FREE" },
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    const visitorsChange = previousVisitors > 0
      ? Math.round(
        ((currentVisitors - previousVisitors) / previousVisitors) * 10000,
      ) / 100
      : 0;

    const signupsChange = previousSignups > 0
      ? Math.round(
        ((currentSignups - previousSignups) / previousSignups) * 10000,
      ) / 100
      : 0;

    const conversionRate = currentVisitors > 0
      ? Math.round((currentSignups / currentVisitors) * 10000) / 100
      : 0;

    const trafficSources: TrafficSource[] = trafficBySource
      .map(s => ({
        name: s.utmSource ?? "direct",
        value: s._count._all,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Add "direct" if there's remaining traffic
    const trackedTotal = trafficSources.reduce((sum, s) => sum + s.value, 0);
    if (currentVisitors > trackedTotal) {
      trafficSources.push({
        name: "direct",
        value: currentVisitors - trackedTotal,
      });
    }

    return {
      visitors: currentVisitors,
      visitorsChange,
      signups: currentSignups,
      signupsChange,
      conversionRate,
      revenue: paidWorkspaces,
      trafficSources,
    };
  });
}

/**
 * Fetch error metrics (with Redis caching)
 */
async function fetchErrorMetrics(): Promise<ErrorMetrics> {
  const cacheKey = "system_report:error_metrics";
  return getCache(cacheKey, CACHE_TTL_SECONDS, async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [errorCount, errorsByType, errorsByFile] = await Promise.all([
      prisma.errorLog.count({
        where: { timestamp: { gte: oneDayAgo } },
      }),
      prisma.errorLog.groupBy({
        by: ["errorType"],
        where: { timestamp: { gte: oneDayAgo } },
        _count: { _all: true },
        orderBy: { _count: { errorType: "desc" } },
        take: 5,
      }),
      prisma.errorLog.groupBy({
        by: ["sourceFile"],
        where: { timestamp: { gte: oneDayAgo } },
        _count: { _all: true },
        orderBy: { _count: { sourceFile: "desc" } },
        take: 5,
      }),
    ]);

    const topErrorTypes: Record<string, number> = {};
    for (const e of errorsByType) {
      if (e.errorType) {
        topErrorTypes[e.errorType] = e._count._all;
      }
    }

    const topErrorFiles: Record<string, number> = {};
    for (const e of errorsByFile) {
      if (e.sourceFile) {
        topErrorFiles[e.sourceFile] = e._count._all;
      }
    }

    return {
      last24Hours: errorCount,
      topErrorTypes,
      topErrorFiles,
    };
  });
}

/**
 * Fetch external data (Meta Ads) (with Redis caching)
 */
async function fetchExternalData(
  startDate: Date,
  endDate: Date,
  sections: ReportSection[],
): Promise<ExternalData> {
  const external: ExternalData = {};

  if (sections.includes("meta")) {
    const cacheKey = `system_report:meta_ads:${startDate.toISOString()}:${endDate.toISOString()}`;
    const data = await getCache(cacheKey, CACHE_TTL_SECONDS, async () => {
      const { data, error } = await tryCatch(
        fetchMetaAdsAggregated(startDate, endDate),
      );
      if (error) throw error;
      return data;
    }).catch(() => null);

    if (data) {
      external.metaAds = data;
    }
  }

  return external;
}

/**
 * Generate full system report
 */
export async function generateSystemReport(
  period: ReportPeriodOption = "30d",
  sections: ReportSection[] = [
    "platform",
    "users",
    "tokens",
    "health",
    "marketing",
    "errors",
    "meta",
  ],
): Promise<SystemReport | PartialSystemReport> {
  const { startDate, endDate } = getDateRangeForPeriod(period);

  const reportPeriod: ReportPeriod = {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };

  // Fetch all sections in parallel
  const results = await Promise.allSettled([
    sections.includes("platform") ? fetchPlatformMetrics() : null,
    sections.includes("users") ? fetchUserMetrics(startDate, endDate) : null,
    sections.includes("tokens") ? fetchTokenMetrics() : null,
    sections.includes("health") ? fetchHealthMetrics() : null,
    sections.includes("marketing")
      ? fetchMarketingMetrics(startDate, endDate)
      : null,
    sections.includes("errors") ? fetchErrorMetrics() : null,
    sections.includes("meta")
      ? fetchExternalData(startDate, endDate, sections)
      : null,
  ]);

  const report: PartialSystemReport = {
    generatedAt: new Date().toISOString(),
    period: reportPeriod,
  };

  // Extract results
  if (results[0].status === "fulfilled" && results[0].value) {
    report.platform = results[0].value;
  }
  if (results[1].status === "fulfilled" && results[1].value) {
    report.users = results[1].value;
  }
  if (results[2].status === "fulfilled" && results[2].value) {
    report.tokens = results[2].value;
  }
  if (results[3].status === "fulfilled" && results[3].value) {
    report.health = results[3].value;
  }
  if (results[4].status === "fulfilled" && results[4].value) {
    report.marketing = results[4].value;
  }
  if (results[5].status === "fulfilled" && results[5].value) {
    report.errors = results[5].value;
  }
  if (results[6].status === "fulfilled" && results[6].value) {
    report.external = results[6].value;
  }

  return report;
}

/**
 * Generate summary report
 */
export async function generateSystemReportSummary(
  period: ReportPeriodOption = "30d",
): Promise<SystemReportSummary> {
  const report = (await generateSystemReport(period, [
    "platform",
    "users",
    "health",
    "errors",
    "marketing",
    "meta",
  ])) as SystemReport;

  return {
    generatedAt: report.generatedAt,
    period: report.period,
    highlights: {
      totalUsers: report.platform?.totalUsers ?? 0,
      activeUsersLast7Days: report.users?.activeUsersLast7Days ?? 0,
      totalEnhancements: report.platform?.totalEnhancements ?? 0,
      pendingJobs: report.platform?.jobStatus.pending ?? 0,
      failedJobs: report.platform?.jobStatus.failed ?? 0,
      totalAiCreditsUsed: report.platform?.totalAiCreditsUsed ?? 0,
      errorsLast24Hours: report.errors?.last24Hours ?? 0,
      conversionRate: report.marketing?.conversionRate ?? 0,
    },
    external: {
      metaTotalSpend: report.external?.metaAds?.totalSpend,
    },
  };
}

/**
 * Clear the cache (useful for testing)
 */
export async function clearReportCache(): Promise<void> {
  // Static cache keys
  const keys: string[] = [
    "system_report:platform_metrics",
    "system_report:token_metrics",
    "system_report:health_metrics",
    "system_report:error_metrics",
  ];

  // Date-parameterized keys need to be cleared for all standard periods
  const periods: ReportPeriodOption[] = ["7d", "30d", "90d"];
  for (const period of periods) {
    const { startDate, endDate } = getDateRangeForPeriod(period);
    const start = startDate.toISOString();
    const end = endDate.toISOString();
    keys.push(
      `system_report:user_metrics:${start}:${end}`,
      `system_report:marketing_metrics:${start}:${end}`,
      `system_report:meta_ads:${start}:${end}`,
    );
  }

  await Promise.all(keys.map(k => invalidateCache(k)));
}
