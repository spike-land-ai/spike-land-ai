/**
 * Admin Middleware
 *
 * This module provides utilities for checking admin permissions in API routes and UI components.
 * It checks if a user has ADMIN or SUPER_ADMIN role.
 */

import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import { UserRole } from "@prisma/client";
import type { Session } from "next-auth";
import { headers } from "next/headers";
import { logger } from "@/lib/logger";

/**
 * Verified admin access checking both session (for E2E) and database (for Prod).
 * Supports E2E bypass via header or env var.
 */
export async function verifyAdminAccess(
  session: Session | null,
): Promise<boolean> {
  if (!session?.user?.id) {
    return false;
  }

  // Check for E2E bypass
  const headersList = await headers();
  const e2eBypassHeader = headersList.get("x-e2e-auth-bypass");
  const e2eBypassSecret = process.env.E2E_BYPASS_SECRET;

  const isE2EBypass = (process.env.NODE_ENV !== "production"
    && e2eBypassSecret
    && e2eBypassHeader === e2eBypassSecret)
    || (process.env.NODE_ENV !== "production"
      && process.env.E2E_BYPASS_AUTH === "true");

  if (isE2EBypass) {
    // E2E session has role from cookie
    const role = session.user.role as unknown as string;
    return role === "ADMIN" || role === "SUPER_ADMIN"
      || role === UserRole.ADMIN
      || role === UserRole.SUPER_ADMIN;
  }

  return isAdminByUserId(session.user.id);
}

/**
 * Checks if a session has admin privileges (ADMIN or SUPER_ADMIN role).
 * Now that role is included in the session type, this check is reliable.
 *
 * @param session - NextAuth session object
 * @returns boolean - true if user is admin, false otherwise
 */
export function isAdmin(session: Session | null): boolean {
  if (!session?.user?.id) {
    return false;
  }

  // Role is now properly included in session via JWT callback
  const role = session.user.role;
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

/**
 * Checks if a user has admin privileges by fetching from database.
 * Use this when session doesn't have role information.
 *
 * @param userId - User ID to check
 * @returns Promise<boolean> - true if user is admin, false otherwise
 */
export async function isAdminByUserId(userId: string): Promise<boolean> {
  const { data: user, error } = await tryCatch(
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
  );

  if (error) {
    logger.error("Failed to check admin status:", error);
    return false;
  }

  return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
}

/**
 * Requires admin role for API route access.
 * Throws an error if user is not admin.
 *
 * @param session - NextAuth session object
 * @throws Error if user is not authenticated or not admin
 */
export function requireAdmin(session: Session | null): void {
  if (!session?.user?.id) {
    throw new Error("Unauthorized: Authentication required");
  }

  if (!isAdmin(session)) {
    throw new Error("Forbidden: Admin access required");
  }
}

/**
 * Requires admin role by checking database.
 * Use this when session doesn't have role information.
 *
 * @param userId - User ID to check
 * @throws Error if user is not admin
 */
export async function requireAdminByUserId(userId: string): Promise<void> {
  const isUserAdmin = await isAdminByUserId(userId);

  if (!isUserAdmin) {
    throw new Error("Forbidden: Admin access required");
  }
}

/**
 * Checks if a user is super admin.
 *
 * @param userId - User ID to check
 * @returns Promise<boolean> - true if user is super admin, false otherwise
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const { data: user, error } = await tryCatch(
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
  );

  if (error) {
    logger.error("Failed to check super admin status:", error);
    return false;
  }

  return user?.role === UserRole.SUPER_ADMIN;
}
