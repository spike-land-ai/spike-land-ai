/**
 * Ensure Personal Workspace
 *
 * Creates a personal workspace for a user if one doesn't already exist.
 * Called during signup to give new users 100 AI credits immediately.
 * Credits come from Prisma schema defaults (monthlyAiCredits: 100).
 */

import prisma from "@/lib/prisma";

/**
 * Ensure a personal workspace exists for the given user.
 * Idempotent: if a personal workspace already exists, returns its ID.
 *
 * @param userId - The user's ID
 * @param userName - Optional user name for workspace naming
 * @returns The workspace ID, or null on failure
 */
export async function ensurePersonalWorkspace(
  userId: string,
  userName?: string | null,
): Promise<string | null> {
  // Use a transaction to prevent race conditions between check and create
  const result = await prisma.$transaction(async (tx) => {
    // Check for existing personal workspace first (idempotent)
    const existing = await tx.workspace.findFirst({
      where: {
        isPersonal: true,
        members: {
          some: { userId },
        },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      return existing;
    }

    // Create personal workspace with default credits (100 from schema)
    return tx.workspace.create({
      data: {
        name: `${userName || "User"}'s Workspace`,
        slug: `user-${userId}-${Date.now().toString(36)}`,
        isPersonal: true,
        members: {
          create: {
            userId,
            role: "OWNER",
            joinedAt: new Date(),
          },
        },
      },
      select: { id: true },
    });
  });

  return result.id;
}
