import { filterHealthyCodespaces } from "@/lib/create/codespace-health";
import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import { AppBuildStatus, CreatedAppStatus } from "@prisma/client";

export interface ShowcaseApp {
  id: string;
  title: string;
  description: string;
  slug: string;
  codespaceId: string;
  lastActivity: Date;
  source: "app" | "created-app";
  viewCount?: number;
}

export async function getLatestShowcaseApps(limit = 10): Promise<ShowcaseApp[]> {
  const [appsResult, createdAppsResult] = await Promise.all([
    tryCatch(
      prisma.app.findMany({
        where: {
          isPublic: true,
          status: AppBuildStatus.LIVE,
          codespaceId: { not: null },
          deletedAt: null,
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          slug: true,
          codespaceId: true,
          updatedAt: true,
        },
      }),
    ),
    tryCatch(
      prisma.createdApp.findMany({
        where: {
          status: CreatedAppStatus.PUBLISHED,
          codespaceId: { not: "" },
        },
        orderBy: { generatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          slug: true,
          codespaceId: true,
          generatedAt: true,
          viewCount: true,
        },
      }),
    ),
  ]);

  if (appsResult.error) {
    logger.warn(`Failed to fetch apps: ${appsResult.error.message}`);
  }
  if (createdAppsResult.error) {
    logger.warn(`Failed to fetch created apps: ${createdAppsResult.error.message}`);
  }

  const apps: ShowcaseApp[] = (appsResult.data ?? []).map((app) => ({
    id: app.id,
    title: app.name,
    description: app.description ?? "",
    slug: app.slug ?? app.id,
    codespaceId: app.codespaceId!,
    lastActivity: app.updatedAt,
    source: "app" as const,
  }));

  const createdApps: ShowcaseApp[] = (createdAppsResult.data ?? []).map((app) => ({
    id: app.id,
    title: app.title,
    description: app.description,
    slug: app.slug,
    codespaceId: app.codespaceId,
    lastActivity: app.generatedAt,
    source: "created-app" as const,
    viewCount: app.viewCount,
  }));

  const merged = [...apps, ...createdApps].sort(
    (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime(),
  );

  const seen = new Set<string>();
  const deduplicated: ShowcaseApp[] = [];
  for (const item of merged) {
    if (!seen.has(item.codespaceId)) {
      seen.add(item.codespaceId);
      deduplicated.push(item);
    }
  }

  // Filter out unhealthy codespaces
  const healthy = await filterHealthyCodespaces(deduplicated);
  return healthy.slice(0, limit);
}
