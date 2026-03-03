/**
 * Aggregate Query Service for Multi-Workspace Management
 *
 * Provides functions for aggregating KPIs and metrics across multiple workspaces.
 */

import prisma from "@/lib/prisma";
import type {
  AggregateKPIs,
  DateRange,
  WorkspaceSummary,
} from "@/types/workspace";

/**
 * Get all workspace IDs that a user has access to
 */
export async function getUserWorkspaceIds(userId: string): Promise<string[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: {
      userId,
      joinedAt: { not: null }, // Only joined workspaces
    },
    select: {
      workspaceId: true,
    },
  });

  return memberships.map(m => m.workspaceId);
}

/**
 * Get aggregate KPIs across specified workspaces
 */
export async function getAggregateKPIs(
  workspaceIds: string[],
  dateRange?: DateRange,
): Promise<AggregateKPIs> {
  if (workspaceIds.length === 0) {
    return {
      totalWorkspaces: 0,
      totalSocialAccounts: 0,
      totalScheduledPosts: 0,
      totalPublishedPosts: 0,
      totalEngagements: 0,
      totalFollowers: 0,
      totalImpressions: 0,
    };
  }

  // Build date filter for posts
  const dateFilter = dateRange
    ? {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    }
    : {};

  // Build date filter for metrics
  const metricsDateFilter = dateRange
    ? {
      date: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    }
    : {};

  // Run aggregate queries in parallel
  const [
    socialAccountCount,
    scheduledPostCount,
    publishedPostCount,
    metricsAggregation,
  ] = await Promise.all([
    // Count social accounts
    prisma.socialAccount.count({
      where: {
        workspaceId: { in: workspaceIds },
      },
    }),

    // Count scheduled posts (pending)
    prisma.scheduledPost.count({
      where: {
        workspaceId: { in: workspaceIds },
        status: "SCHEDULED",
        ...dateFilter,
      },
    }),

    // Count published posts
    prisma.scheduledPost.count({
      where: {
        workspaceId: { in: workspaceIds },
        status: "PUBLISHED",
        ...dateFilter,
      },
    }),

    // Aggregate social metrics using Prisma aggregate
    prisma.socialMetrics.aggregate({
      where: {
        account: {
          workspaceId: { in: workspaceIds },
        },
        ...metricsDateFilter,
      },
      _sum: {
        followers: true,
        impressions: true,
        likes: true,
        comments: true,
        shares: true,
      },
    }),
  ]);

  // Calculate engagements from likes + comments + shares
  const totalEngagements = (metricsAggregation._sum.likes ?? 0)
    + (metricsAggregation._sum.comments ?? 0)
    + (metricsAggregation._sum.shares ?? 0);
  const totalFollowers = metricsAggregation._sum.followers ?? 0;
  const totalImpressions = metricsAggregation._sum.impressions ?? 0;

  return {
    totalWorkspaces: workspaceIds.length,
    totalSocialAccounts: socialAccountCount,
    totalScheduledPosts: scheduledPostCount,
    totalPublishedPosts: publishedPostCount,
    totalEngagements,
    totalFollowers,
    totalImpressions,
  };
}

/**
 * Get per-workspace summaries
 */
export async function getWorkspaceSummaries(
  workspaceIds: string[],
  dateRange?: DateRange,
): Promise<WorkspaceSummary[]> {
  if (workspaceIds.length === 0) {
    return [];
  }

  // Build date filter for posts
  const postsDateFilter = dateRange
    ? {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    }
    : {};

  // Build date filter for metrics
  const metricsDateFilter = dateRange
    ? {
      date: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    }
    : {};

  // Get workspace details with counts
  const workspaces = await prisma.workspace.findMany({
    where: {
      id: { in: workspaceIds },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          socialAccounts: true,
        },
      },
      socialAccounts: {
        select: {
          id: true,
        },
      },
      scheduledPosts: {
        where: postsDateFilter,
        select: {
          status: true,
          createdAt: true,
        },
      },
    },
  });

  // Fetch metrics for all accounts in these workspaces
  const metricsPromises = workspaces.map(async workspace => {
    const accountIds = workspace.socialAccounts.map(a => a.id);
    if (accountIds.length === 0) {
      return {
        workspaceId: workspace.id,
        totalEngagements: 0,
        totalFollowers: 0,
        totalImpressions: 0,
      };
    }

    const aggregation = await prisma.socialMetrics.aggregate({
      where: {
        accountId: { in: accountIds },
        ...metricsDateFilter,
      },
      _sum: {
        followers: true,
        impressions: true,
        likes: true,
        comments: true,
        shares: true,
      },
    });

    return {
      workspaceId: workspace.id,
      totalEngagements: (aggregation._sum.likes ?? 0)
        + (aggregation._sum.comments ?? 0)
        + (aggregation._sum.shares ?? 0),
      totalFollowers: aggregation._sum.followers ?? 0,
      totalImpressions: aggregation._sum.impressions ?? 0,
    };
  });

  const metricsResults = await Promise.all(metricsPromises);
  const metricsMap = new Map(
    metricsResults.map(m => [m.workspaceId, m]),
  );

  return workspaces.map(workspace => {
    const metrics = metricsMap.get(workspace.id) ?? {
      totalEngagements: 0,
      totalFollowers: 0,
      totalImpressions: 0,
    };

    // Count posts by status
    const scheduledPostCount = workspace.scheduledPosts.filter(
      p => p.status === "SCHEDULED",
    ).length;
    const publishedPostCount = workspace.scheduledPosts.filter(
      p => p.status === "PUBLISHED",
    ).length;

    // Find last activity
    const firstPost = workspace.scheduledPosts[0];
    const lastActivityAt = firstPost
      ? workspace.scheduledPosts.reduce(
        (latest, post) => post.createdAt > latest ? post.createdAt : latest,
        firstPost.createdAt,
      )
      : null;

    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      socialAccountCount: workspace._count.socialAccounts,
      scheduledPostCount,
      publishedPostCount,
      totalEngagements: metrics.totalEngagements,
      totalFollowers: metrics.totalFollowers,
      totalImpressions: metrics.totalImpressions,
      lastActivityAt,
    };
  });
}

/**
 * Get favorite workspaces for a user
 */
export async function getUserFavorites(userId: string): Promise<string[]> {
  const favorites = await prisma.workspaceFavorite.findMany({
    where: { userId },
    select: { workspaceId: true },
    orderBy: { createdAt: "desc" },
  });

  return favorites.map(f => f.workspaceId);
}

/**
 * Get recent workspaces for a user
 */
export async function getUserRecentWorkspaces(
  userId: string,
  limit: number = 10,
): Promise<string[]> {
  const recents = await prisma.workspaceRecentAccess.findMany({
    where: { userId },
    select: { workspaceId: true },
    orderBy: { accessedAt: "desc" },
    take: limit,
  });

  return recents.map(r => r.workspaceId);
}

/**
 * Toggle favorite status for a workspace
 */
export async function toggleWorkspaceFavorite(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  // Check if already favorited
  const existing = await prisma.workspaceFavorite.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
  });

  if (existing) {
    // Remove favorite
    await prisma.workspaceFavorite.delete({
      where: { id: existing.id },
    });
    return false;
  } else {
    // Add favorite
    await prisma.workspaceFavorite.create({
      data: {
        userId,
        workspaceId,
      },
    });
    return true;
  }
}

/**
 * Record workspace access (for recent workspaces tracking)
 */
export async function recordWorkspaceAccess(
  userId: string,
  workspaceId: string,
): Promise<void> {
  await prisma.workspaceRecentAccess.upsert({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
    update: {
      accessedAt: new Date(),
    },
    create: {
      userId,
      workspaceId,
    },
  });
}

/**
 * Get workspaces with metadata (favorites and recent access)
 */
export async function getWorkspacesWithMetadata(
  userId: string,
): Promise<{
  workspaceIds: string[];
  favoriteIds: string[];
  recentIds: string[];
}> {
  const [workspaceIds, favoriteIds, recentIds] = await Promise.all([
    getUserWorkspaceIds(userId),
    getUserFavorites(userId),
    getUserRecentWorkspaces(userId),
  ]);

  return {
    workspaceIds,
    favoriteIds,
    recentIds,
  };
}
