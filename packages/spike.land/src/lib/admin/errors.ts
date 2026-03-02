/**
 * Admin Error Logs Business Logic
 *
 * Error data retrieval and trend analysis.
 */

import type { ErrorEnvironment, Prisma } from "@prisma/client";

export interface ErrorInitialData {
  errors: Array<{
    id: string;
    message: string;
    stack: string | null;
    sourceFile: string | null;
    sourceLine: number | null;
    sourceColumn: number | null;
    callerName: string | null;
    userId: string | null;
    route: string | null;
    environment: ErrorEnvironment;
    errorType: string | null;
    errorCode: string | null;
    metadata: Prisma.JsonValue;
    timestamp: Date;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    total24h: number;
  };
}

export async function getInitialErrorData(): Promise<ErrorInitialData> {
  const prisma = (await import("@/lib/prisma")).default;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [errors, total, stats] = await Promise.all([
    prisma.errorLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 50,
    }),
    prisma.errorLog.count(),
    prisma.errorLog.count({
      where: { timestamp: { gte: twentyFourHoursAgo } },
    }),
  ]);

  return {
    errors,
    pagination: {
      page: 1,
      limit: 50,
      total,
      totalPages: Math.ceil(total / 50),
    },
    stats: { total24h: stats },
  };
}

export type ErrorTrend = "up" | "down" | "stable";

export function calculateTrend(current: number, previous: number): ErrorTrend {
  if (previous > 0) {
    const change = (current - previous) / previous;
    if (change > 0.1) return "up";
    if (change < -0.1) return "down";
    return "stable";
  }
  return current > 0 ? "up" : "stable";
}

export interface ErrorStats {
  lastHour: number;
  last24h: number;
  previous24h: number;
  trend: ErrorTrend;
  topFiles: Array<{ file: string | null; count: number }>;
  topErrors: Array<{ type: string | null; count: number }>;
  byEnvironment: Record<string, number>;
  timestamp: string;
}

export async function getErrorStats(): Promise<ErrorStats> {
  const prisma = (await import("@/lib/prisma")).default;

  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now - 48 * 60 * 60 * 1000);

  const [lastHour, last24h, previous24h, topFiles, topErrors, byEnvironment] = await Promise.all([
    prisma.errorLog.count({ where: { timestamp: { gte: oneHourAgo } } }),
    prisma.errorLog.count({
      where: { timestamp: { gte: twentyFourHoursAgo } },
    }),
    prisma.errorLog.count({
      where: {
        timestamp: { gte: fortyEightHoursAgo, lt: twentyFourHoursAgo },
      },
    }),
    prisma.errorLog.groupBy({
      by: ["sourceFile"],
      _count: { sourceFile: true },
      where: {
        timestamp: { gte: twentyFourHoursAgo },
        sourceFile: { not: null },
      },
      orderBy: { _count: { sourceFile: "desc" } },
      take: 5,
    }),
    prisma.errorLog.groupBy({
      by: ["errorType"],
      _count: { errorType: true },
      where: {
        timestamp: { gte: twentyFourHoursAgo },
        errorType: { not: null },
      },
      orderBy: { _count: { errorType: "desc" } },
      take: 5,
    }),
    prisma.errorLog.groupBy({
      by: ["environment"],
      _count: { environment: true },
      where: { timestamp: { gte: twentyFourHoursAgo } },
    }),
  ]);

  return {
    lastHour,
    last24h,
    previous24h,
    trend: calculateTrend(last24h, previous24h),
    topFiles: topFiles.map((f) => ({
      file: f.sourceFile,
      count: f._count.sourceFile,
    })),
    topErrors: topErrors.map((e) => ({
      type: e.errorType,
      count: e._count.errorType,
    })),
    byEnvironment: Object.fromEntries(
      byEnvironment.map((e) => [e.environment, e._count.environment]),
    ),
    timestamp: new Date().toISOString(),
  };
}
