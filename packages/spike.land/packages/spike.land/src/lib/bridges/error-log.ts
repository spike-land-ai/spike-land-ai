import logger from "@/lib/logger";

interface ErrorIssue {
  message: string;
  count: number;
  lastSeen: string;
  firstSeen: string;
  environment: string;
  errorType: string | null;
}

interface ErrorDetail {
  id: string;
  message: string;
  stack: string | null;
  sourceFile: string | null;
  sourceLine: number | null;
  sourceColumn: number | null;
  callerName: string | null;
  errorType: string | null;
  errorCode: string | null;
  route: string | null;
  userId: string | null;
  environment: string;
  metadata: unknown;
  timestamp: string;
}

interface ErrorStats {
  last24h: number;
  last7d: number;
  last30d: number;
  byEnvironment: Record<string, number>;
}

export async function listErrorIssues(
  options?: { query?: string; limit?: number; },
): Promise<ErrorIssue[]> {
  const prisma = (await import("@/lib/prisma")).default;
  const limit = options?.limit ?? 25;

  try {
    const where = options?.query
      ? { message: { contains: options.query, mode: "insensitive" as const } }
      : {};

    const grouped = await prisma.errorLog.groupBy({
      by: ["message", "environment", "errorType"],
      where,
      _count: { id: true },
      _max: { timestamp: true },
      _min: { timestamp: true },
      orderBy: { _count: { id: "desc" } },
      take: limit,
    });

    return grouped.map(g => ({
      message: g.message,
      count: g._count.id,
      lastSeen: g._max.timestamp?.toISOString() ?? "",
      firstSeen: g._min.timestamp?.toISOString() ?? "",
      environment: g.environment,
      errorType: g.errorType,
    }));
  } catch (err) {
    logger.warn("ErrorLog query failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export async function getErrorDetail(
  errorId: string,
): Promise<ErrorDetail | null> {
  const prisma = (await import("@/lib/prisma")).default;

  try {
    const record = await prisma.errorLog.findUnique({ where: { id: errorId } });
    if (!record) return null;

    return {
      id: record.id,
      message: record.message,
      stack: record.stack,
      sourceFile: record.sourceFile,
      sourceLine: record.sourceLine,
      sourceColumn: record.sourceColumn,
      callerName: record.callerName,
      errorType: record.errorType,
      errorCode: record.errorCode,
      route: record.route,
      userId: record.userId,
      environment: record.environment,
      metadata: record.metadata,
      timestamp: record.timestamp.toISOString(),
    };
  } catch (err) {
    logger.warn("ErrorLog detail query failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function getErrorStats(): Promise<ErrorStats | null> {
  const prisma = (await import("@/lib/prisma")).default;

  try {
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [last24h, last7d, last30d, byEnv] = await Promise.all([
      prisma.errorLog.count({ where: { timestamp: { gte: h24 } } }),
      prisma.errorLog.count({ where: { timestamp: { gte: d7 } } }),
      prisma.errorLog.count({ where: { timestamp: { gte: d30 } } }),
      prisma.errorLog.groupBy({
        by: ["environment"],
        _count: { id: true },
      }),
    ]);

    const byEnvironment: Record<string, number> = {};
    for (const row of byEnv) {
      byEnvironment[row.environment] = row._count.id;
    }

    return { last24h, last7d, last30d, byEnvironment };
  } catch (err) {
    logger.warn("ErrorLog stats query failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export type { ErrorDetail, ErrorIssue, ErrorStats };
