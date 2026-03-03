import { getOrCreateSession } from "@/lib/codespace";
import prisma from "@/lib/prisma";

/**
 * Include options for app queries
 */
export const appIncludeOptions = {
  requirements: {
    orderBy: { createdAt: "asc" as const },
  },
  monetizationModels: {
    orderBy: { createdAt: "asc" as const },
  },
  statusHistory: {
    orderBy: { createdAt: "desc" as const },
    take: 10,
    select: {
      id: true,
      status: true,
      message: true,
      createdAt: true,
    },
  },
  _count: {
    select: {
      messages: true,
      images: true,
    },
  },
};

/**
 * Flexible app lookup that supports multiple identifier types:
 * 1. codespaceId (primary) - the codespace name
 * 2. slug (fallback) - URL-friendly identifier
 * 3. id (backward compat) - database cuid
 *
 * This enables flexible lookups by codespaceId, slug, or database id
 * while maintaining backward compatibility with existing links.
 */
export async function findAppByIdentifier(
  identifier: string,
  userId: string,
) {
  // First, try to find by codespaceId (most common case)
  let app = await prisma.app.findFirst({
    where: {
      codespaceId: identifier,
      userId,
      deletedAt: null,
      status: { not: "ARCHIVED" },
    },
    include: appIncludeOptions,
  });

  if (app) return app;

  // Fallback: try by slug
  app = await prisma.app.findFirst({
    where: {
      slug: identifier,
      userId,
      deletedAt: null,
      status: { not: "ARCHIVED" },
    },
    include: appIncludeOptions,
  });

  if (app) return app;

  // Fallback: try by id if it looks like a cuid (backward compatibility)
  // cuids start with 'c' and are typically 25 characters
  if (/^c[a-z0-9]{20,}$/i.test(identifier)) {
    app = await prisma.app.findFirst({
      where: {
        id: identifier,
        userId,
        deletedAt: null,
        status: { not: "ARCHIVED" },
      },
      include: appIncludeOptions,
    });
  }

  return app;
}

/**
 * Simple app lookup without includes (for validation/existence checks)
 */
export async function findAppByIdentifierSimple(
  identifier: string,
  userId: string,
) {
  // First, try by codespaceId
  let app = await prisma.app.findFirst({
    where: {
      codespaceId: identifier,
      userId,
      deletedAt: null,
      status: { not: "ARCHIVED" },
    },
  });

  if (app) return app;

  // Fallback: try by slug
  app = await prisma.app.findFirst({
    where: {
      slug: identifier,
      userId,
      deletedAt: null,
      status: { not: "ARCHIVED" },
    },
  });

  if (app) return app;

  // Fallback: try by id if it looks like a cuid
  if (/^c[a-z0-9]{20,}$/i.test(identifier)) {
    app = await prisma.app.findFirst({
      where: {
        id: identifier,
        userId,
        deletedAt: null,
        status: { not: "ARCHIVED" },
      },
    });
  }

  return app;
}

/**
 * Check if codespace has actual content (not default placeholder)
 */
export async function checkCodespaceHasContent(
  codeSpace: string,
): Promise<boolean> {
  const DEFAULT_CONTENT = "<div>Write your code here!</div>";

  try {
    const session = await getOrCreateSession(codeSpace);
    const html = session.html;
    return html.trim() !== DEFAULT_CONTENT;
  } catch {
    return false;
  }
}

/**
 * Find a CreatedApp by codespace ID that belongs to a user
 */
export async function findCreatedAppByCodespace(
  codespaceId: string,
  userId: string,
) {
  return prisma.createdApp.findFirst({
    where: {
      codespaceId,
      generatedById: userId,
      status: "PUBLISHED",
    },
  });
}

/**
 * Create an App record from a CreatedApp (claiming it for the user's apps)
 * This allows users to edit apps they generated via /create
 */
export async function claimCreatedApp(
  createdApp: {
    id: string;
    title: string;
    slug: string;
    description: string;
    codespaceId: string;
    codespaceUrl: string;
    promptUsed: string;
  },
  userId: string,
) {
  // Create the App record with initial USER message containing the original prompt
  const app = await prisma.app.create({
    data: {
      name: createdApp.title,
      slug: createdApp.codespaceId, // Use codespaceId as slug for consistency
      description: createdApp.description,
      codespaceId: createdApp.codespaceId,
      codespaceUrl: createdApp.codespaceUrl,
      userId,
      status: "LIVE", // Already working in codespace
      messages: {
        create: {
          role: "USER",
          content: createdApp.promptUsed,
        },
      },
    },
    include: appIncludeOptions,
  });

  return app;
}
