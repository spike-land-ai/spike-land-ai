/**
 * Admin Dashboard Business Logic
 *
 * Shared dashboard metrics used by both the admin page and the polling API route.
 */

import { JobStatus, UserRole } from "@prisma/client";
import { logger } from "@/lib/logger";

export interface DashboardMetrics {
  totalUsers: number;
  adminCount: number;
  totalEnhancements: number;
  jobStatus: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    active: number;
  };
  totalCreditsAllocated: number;
  totalCreditsUsed: number;
  totalWorkspaces: number;
  timestamp: string;
}

const DEFAULT_METRICS: DashboardMetrics = {
  totalUsers: 0,
  adminCount: 0,
  totalEnhancements: 0,
  jobStatus: {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    active: 0,
  },
  totalCreditsAllocated: 0,
  totalCreditsUsed: 0,
  totalWorkspaces: 0,
  timestamp: new Date().toISOString(),
};

export function getDefaultMetrics(): DashboardMetrics {
  return { ...DEFAULT_METRICS, timestamp: new Date().toISOString() };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    const prisma = (await import("@/lib/prisma")).default;

    const [
      totalUsers,
      adminCount,
      jobStatusGroups,
      workspaceStats,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          OR: [{ role: UserRole.ADMIN }, { role: UserRole.SUPER_ADMIN }],
        },
      }),
      prisma.imageEnhancementJob.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.workspace.aggregate({
        _count: { _all: true },
        _sum: { monthlyAiCredits: true, usedAiCredits: true },
      }),
    ]);

    const statusCounts = Object.fromEntries(
      jobStatusGroups.map(g => [g.status, g._count]),
    ) as Partial<Record<JobStatus, number>>;
    const pending = statusCounts[JobStatus.PENDING] || 0;
    const processing = statusCounts[JobStatus.PROCESSING] || 0;
    const completed = statusCounts[JobStatus.COMPLETED] || 0;
    const failed = statusCounts[JobStatus.FAILED] || 0;
    const totalEnhancements = jobStatusGroups.reduce(
      (sum, g) => sum + g._count,
      0,
    );

    return {
      totalUsers,
      adminCount,
      totalEnhancements,
      jobStatus: {
        pending,
        processing,
        completed,
        failed,
        active: pending + processing,
      },
      totalCreditsAllocated: workspaceStats._sum.monthlyAiCredits || 0,
      totalCreditsUsed: workspaceStats._sum.usedAiCredits || 0,
      totalWorkspaces: workspaceStats._count._all,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Failed to fetch dashboard metrics:", error);
    return getDefaultMetrics();
  }
}
