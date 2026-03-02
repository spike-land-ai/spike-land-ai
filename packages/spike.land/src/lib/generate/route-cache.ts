import type { GeneratedRoute, Prisma } from "@prisma/client";
import { GeneratedRouteStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";

export async function getRouteBySlug(slug: string): Promise<GeneratedRoute | null> {
  return prisma.generatedRoute.findUnique({ where: { slug } });
}

export async function isRouteCached(slug: string): Promise<boolean> {
  const route = await prisma.generatedRoute.findUnique({
    where: { slug },
    select: { status: true },
  });
  return route?.status === GeneratedRouteStatus.PUBLISHED;
}

export async function getOrCreateRoute(
  slug: string,
  originalUrl: string,
  userId?: string,
): Promise<GeneratedRoute> {
  const existing = await prisma.generatedRoute.findUnique({
    where: { slug },
  });

  if (existing) return existing;

  let validUserId: string | undefined;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    validUserId = user ? userId : undefined;
    if (!user) {
      logger.warn(`User ${userId} not found, creating route without owner`);
    }
  }

  return prisma.generatedRoute.create({
    data: {
      slug,
      originalUrl,
      status: GeneratedRouteStatus.NEW,
      ...(validUserId !== undefined ? { requestedById: validUserId } : {}),
    },
  });
}

export async function updateRouteStatus(
  slug: string,
  status: GeneratedRouteStatus,
  data?: Omit<Prisma.GeneratedRouteUpdateInput, "status" | "requestedBy">,
): Promise<GeneratedRoute> {
  return prisma.generatedRoute.update({
    where: { slug },
    data: {
      status,
      ...(status === GeneratedRouteStatus.PUBLISHED ? { publishedAt: new Date() } : {}),
      ...data,
    },
  });
}

export async function incrementViewCount(slug: string): Promise<void> {
  try {
    await prisma.generatedRoute.update({
      where: { slug },
      data: { viewCount: { increment: 1 } },
    });
  } catch {
    // Ignore - route might not exist
  }
}

export async function incrementAttempts(slug: string): Promise<void> {
  await prisma.generatedRoute.update({
    where: { slug },
    data: { attempts: { increment: 1 } },
  });
}
