import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { type CreatedApp, CreatedAppStatus } from "@prisma/client";
import { filterHealthyCodespaces } from "./codespace-health";

export type CreatedAppWithUser = CreatedApp & {
  generatedBy: { name: string | null; image: string | null; } | null;
};

export async function getCreatedApp(
  slug: string,
): Promise<CreatedAppWithUser | null> {
  return prisma.createdApp.findUnique({
    where: { slug },
    include: {
      generatedBy: {
        select: {
          name: true,
          image: true,
        },
      },
    },
  });
}

export async function markAsGenerating(
  slug: string,
  path: string[],
  title: string,
  description: string,
  codespaceId: string,
  codespaceUrl: string,
  promptUsed: string,
  userId?: string,
): Promise<CreatedApp> {
  // Verify user exists to avoid FK constraint violation (P2003)
  // This can happen when handleSignIn() allows auth but fails to create the DB record
  let validUserId: string | undefined = undefined;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    validUserId = user ? userId : undefined;
    if (!user) {
      logger.warn(
        `User ${userId} not found in database, creating app without owner`,
      );
    }
  }

  return prisma.createdApp.upsert({
    where: { slug },
    update: {
      status: CreatedAppStatus.GENERATING,
      path,
      title,
      description,
      codespaceId,
      codespaceUrl,
      promptUsed,
      generatedAt: new Date(),
    },
    create: {
      slug,
      path,
      title,
      description,
      codespaceId,
      codespaceUrl,
      status: CreatedAppStatus.GENERATING,
      promptUsed,
      ...(validUserId !== undefined ? { generatedById: validUserId } : {}),
      viewCount: 0,
    },
  });
}

export async function updateAppContent(
  slug: string,
  title: string,
  description: string,
): Promise<CreatedApp> {
  return prisma.createdApp.update({
    where: { slug },
    data: {
      title,
      description,
    },
  });
}

export async function updateAppStatus(
  slug: string,
  status: CreatedAppStatus,
  outgoingLinks?: string[],
): Promise<CreatedApp | null> {
  try {
    return await prisma.createdApp.update({
      where: { slug },
      data: {
        status,
        ...(outgoingLinks ? { outgoingLinks } : {}),
      },
    });
  } catch (error) {
    // P2025: Record not found — can happen if markAsGenerating() failed
    if (
      error instanceof Error
      && error.message.includes("Record to update not found")
    ) {
      logger.error(`Cannot update status for non-existent app: ${slug}`);
      return null;
    }
    throw error;
  }
}

export async function incrementViewCount(slug: string): Promise<void> {
  try {
    await prisma.createdApp.update({
      where: { slug },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });
  } catch (error) {
    // Ignore error if app doesn't exist or other race condition
    logger.error(`Failed to increment view count for ${slug}:`, { error });
  }
}

export async function getTopApps(limit = 10): Promise<CreatedApp[]> {
  // Fetch extra to account for unhealthy ones being filtered out
  const apps = await prisma.createdApp.findMany({
    where: { status: CreatedAppStatus.PUBLISHED },
    orderBy: { viewCount: "desc" },
    take: limit * 2,
  });
  const healthy = await filterHealthyCodespaces(apps);
  return healthy.slice(0, limit);
}

export async function getRecentApps(limit = 10): Promise<CreatedApp[]> {
  const apps = await prisma.createdApp.findMany({
    where: { status: CreatedAppStatus.PUBLISHED },
    orderBy: { generatedAt: "desc" },
    take: limit * 2,
  });
  const healthy = await filterHealthyCodespaces(apps);
  return healthy.slice(0, limit);
}

export async function getRelatedPublishedApps(
  excludeSlug: string,
  limit = 6,
): Promise<CreatedApp[]> {
  const apps = await prisma.createdApp.findMany({
    where: {
      status: CreatedAppStatus.PUBLISHED,
      slug: { not: excludeSlug },
      codespaceId: { not: "" },
    },
    orderBy: { viewCount: "desc" },
    take: limit * 2,
  });
  const healthy = await filterHealthyCodespaces(apps);
  return healthy.slice(0, limit);
}

/**
 * Trigger a re-review of a published app.
 * Transitions to FAILED if unhealthy, marking it for removal from listings.
 */
export async function triggerReReview(
  app: CreatedApp,
): Promise<{ healthy: boolean; }> {
  if (!app.codespaceId) {
    await updateAppStatus(app.slug, CreatedAppStatus.FAILED);
    return { healthy: false };
  }

  const { isCodespaceHealthy } = await import("./codespace-health");
  const healthy = await isCodespaceHealthy(app.codespaceId);

  if (!healthy) {
    logger.info(`Re-review: app ${app.slug} is unhealthy, marking as FAILED`);
    await prisma.createdApp.update({
      where: { slug: app.slug },
      data: {
        status: CreatedAppStatus.FAILED,
        lastError: "Failed re-validation: codespace unhealthy",
        lastReviewedAt: new Date(),
      },
    });
  }

  return { healthy };
}
