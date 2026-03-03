/**
 * Admin Bootstrap Logic
 *
 * This module handles the automatic promotion of the first user to ADMIN role.
 * The first registered user becomes ADMIN automatically.
 * All subsequent users get USER role by default.
 */

import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import { UserRole } from "@prisma/client";

/**
 * Checks if any admin exists in the system.
 *
 * @returns Promise<boolean> - true if at least one admin exists, false otherwise
 */
export async function hasAnyAdmin(): Promise<boolean> {
  const adminCount = await prisma.user.count({
    where: {
      OR: [
        { role: UserRole.ADMIN },
        { role: UserRole.SUPER_ADMIN },
      ],
    },
  });

  return adminCount > 0;
}

/**
 * Bootstraps admin role for the first user.
 * If no admin exists and this is a new user, grants ADMIN role.
 *
 * @param userId - The user ID to check and potentially promote
 * @returns Promise<boolean> - true if user was promoted to admin, false otherwise
 */
export async function bootstrapAdminIfNeeded(userId: string): Promise<boolean> {
  // Check if any admin already exists
  const { data: adminExists, error: checkError } = await tryCatch(
    hasAnyAdmin(),
  );

  if (checkError) {
    logger.error("Failed to bootstrap admin", { error: checkError });
    return false;
  }

  // If admin already exists, don't promote this user
  if (adminExists) {
    return false;
  }

  // No admin exists - promote this user to ADMIN
  const { error: updateError } = await tryCatch(
    prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.ADMIN },
    }),
  );

  if (updateError) {
    logger.error("Failed to bootstrap admin", { error: updateError });
    return false;
  }

  logger.info(`First user ${userId} promoted to ADMIN role`);
  return true;
}
