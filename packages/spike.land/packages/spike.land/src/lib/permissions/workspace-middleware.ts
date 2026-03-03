/**
 * Workspace Permission Middleware
 *
 * Server-side utilities for checking workspace permissions in API routes.
 * Follows the pattern established in admin-middleware.ts
 */

import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import type { WorkspaceRole } from "@prisma/client";
import type { Session } from "next-auth";
import { headers } from "next/headers";
import { hasPermission, type WorkspaceAction } from "./permissions";
import { logger } from "@/lib/logger";

/**
 * Workspace member info returned from permission checks
 */
export interface WorkspaceMemberInfo {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

function constantTimeCompare(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let result = aBytes.length ^ bBytes.length;

  for (let i = 0; i < maxLen; i++) {
    result |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }

  return result === 0;
}

function getBypassMembershipRole(session: Session): WorkspaceRole {
  const role = session.user.role as string | undefined;
  if (
    role === "OWNER" || role === "ADMIN" || role === "MEMBER"
    || role === "VIEWER"
  ) {
    return role;
  }

  // Default for E2E bypass sessions that don't include workspace role.
  return "MEMBER";
}

async function getE2EBypassMembership(
  session: Session,
  workspaceId: string,
): Promise<WorkspaceMemberInfo | null> {
  const headersList = await headers();
  const bypassHeader = headersList.get("x-e2e-auth-bypass");
  const bypassSecret = process.env.E2E_BYPASS_SECRET;

  // Mirror auth.ts behavior: allow bypass outside strict production.
  // Use environment variable for domain check to prevent Host header injection
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const isStagingDomain = appUrl === "https://next.spike.land"
    || appUrl.includes("localhost");
  const isStrictProduction = process.env.NODE_ENV === "production"
    && process.env.APP_ENV === "production"
    && !isStagingDomain;

  const headerBypassEnabled = !isStrictProduction
    && !!bypassSecret
    && !!bypassHeader
    && constantTimeCompare(bypassHeader, bypassSecret);

  const envBypassEnabled = process.env.NODE_ENV !== "production"
    && process.env.E2E_BYPASS_AUTH === "true";

  if (!headerBypassEnabled && !envBypassEnabled) {
    return null;
  }

  return {
    workspaceId,
    userId: session.user.id!,
    role: getBypassMembershipRole(session),
  };
}

/**
 * Get user's membership in a workspace by workspace ID
 *
 * @param userId - User ID to check
 * @param workspaceId - Workspace ID to check membership in
 * @returns Membership info or null if not a member
 */
export async function getWorkspaceMembership(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceMemberInfo | null> {
  const { data: membership, error } = await tryCatch(
    prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
        joinedAt: { not: null }, // Must be accepted member
      },
      select: {
        workspaceId: true,
        userId: true,
        role: true,
      },
    }),
  );

  if (error) {
    return null;
  }

  return membership;
}

/**
 * Get user's membership in a workspace by workspace slug
 *
 * @param userId - User ID to check
 * @param workspaceSlug - Workspace slug to check membership in
 * @returns Membership info or null if not a member
 */
export async function getWorkspaceMembershipBySlug(
  userId: string,
  workspaceSlug: string,
): Promise<WorkspaceMemberInfo | null> {
  const { data: workspace, error: wsError } = await tryCatch(
    prisma.workspace.findUnique({
      where: { slug: workspaceSlug, deletedAt: null },
      select: { id: true },
    }),
  );

  if (wsError || !workspace) {
    return null;
  }

  return getWorkspaceMembership(userId, workspace.id);
}

/**
 * Check if user has permission in workspace
 *
 * @param userId - User ID to check
 * @param workspaceId - Workspace ID to check permission in
 * @param action - Action to check permission for
 * @returns true if user has permission
 */
export async function hasWorkspacePermission(
  userId: string,
  workspaceId: string,
  action: WorkspaceAction,
): Promise<boolean> {
  const membership = await getWorkspaceMembership(userId, workspaceId);

  if (!membership) {
    return false;
  }

  return hasPermission(membership.role, action);
}

/**
 * Require specific permission for API route access.
 * Throws an error if user lacks permission.
 *
 * @param session - NextAuth session object
 * @param workspaceId - Workspace ID to check permission in
 * @param action - Required action permission
 * @returns Membership info if authorized
 * @throws Error if user lacks permission
 *
 * @example
 * ```ts
 * export async function PATCH(request: NextRequest, { params }) {
 *   const session = await auth();
 *   const { workspaceId } = await params;
 *
 *   const { error } = await tryCatch(
 *     requireWorkspacePermission(session, workspaceId, "workspace:settings:write")
 *   );
 *
 *   if (error) {
 *     const status = error.message.includes("Unauthorized") ? 401 : 403;
 *     return NextResponse.json({ error: error.message }, { status });
 *   }
 *
 *   // Proceed with authorized action...
 * }
 * ```
 */
export async function requireWorkspacePermission(
  session: Session | null,
  workspaceId: string,
  action: WorkspaceAction,
): Promise<WorkspaceMemberInfo> {
  if (!session?.user?.id) {
    throw new Error("Unauthorized: Authentication required");
  }

  const bypassMembership = await getE2EBypassMembership(session, workspaceId);
  if (bypassMembership) {
    if (!hasPermission(bypassMembership.role, action)) {
      throw new Error(`Forbidden: Requires ${action} permission`);
    }

    return bypassMembership;
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);

  if (!membership) {
    logger.warn(
      `[WorkspaceMiddleware] Access denied: User ${session.user.id} is not a member of workspace ${workspaceId}`,
    );
    throw new Error("Forbidden: Not a workspace member");
  }

  if (!hasPermission(membership.role, action)) {
    logger.warn(
      `[WorkspaceMiddleware] Access denied: User ${session.user.id} (role: ${membership.role}) lacks ${action} permission for workspace ${workspaceId}`,
    );
    throw new Error(`Forbidden: Requires ${action} permission`);
  }

  return membership;
}

/**
 * Require workspace membership (any role)
 *
 * @param session - NextAuth session object
 * @param workspaceId - Workspace ID to check membership in
 * @returns Membership info if authorized
 * @throws Error if not a member
 */
export async function requireWorkspaceMembership(
  session: Session | null,
  workspaceId: string,
): Promise<WorkspaceMemberInfo> {
  if (!session?.user?.id) {
    throw new Error("Unauthorized: Authentication required");
  }

  const bypassMembership = await getE2EBypassMembership(session, workspaceId);
  if (bypassMembership) {
    return bypassMembership;
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);

  if (!membership) {
    logger.warn(
      `[WorkspaceMiddleware] Access denied: User ${session.user.id} is not a member of workspace ${workspaceId}`,
    );
    throw new Error("Forbidden: Not a workspace member");
  }

  return membership;
}

/**
 * Check if user is workspace owner
 *
 * @param userId - User ID to check
 * @param workspaceId - Workspace ID to check
 * @returns true if user is owner
 */
export async function isWorkspaceOwner(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const membership = await getWorkspaceMembership(userId, workspaceId);
  return membership?.role === "OWNER";
}

/**
 * Check if user is workspace admin or owner
 *
 * @param userId - User ID to check
 * @param workspaceId - Workspace ID to check
 * @returns true if user is admin or owner
 */
export async function isWorkspaceAdmin(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const membership = await getWorkspaceMembership(userId, workspaceId);
  return membership?.role === "OWNER" || membership?.role === "ADMIN";
}

/**
 * Get user's role in a workspace
 *
 * @param userId - User ID to check
 * @param workspaceId - Workspace ID to check
 * @returns User's role or null if not a member
 */
export async function getWorkspaceRole(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceRole | null> {
  const membership = await getWorkspaceMembership(userId, workspaceId);
  return membership?.role ?? null;
}

/**
 * Resolve workspace slug, verify membership, and check permission — all in a
 * single Prisma query.  Callers no longer need a separate
 * `prisma.workspace.findFirst` before calling `requireWorkspacePermission`.
 *
 * @param session - NextAuth session object
 * @param workspaceSlug - URL slug of the workspace
 * @param action - Required workspace action permission
 * @returns Object with the resolved workspace id and full membership info
 * @throws Error if workspace not found, user not a member, or lacks permission
 *
 * @example
 * ```ts
 * const { workspaceId } = await requireWorkspacePermissionBySlug(
 *   session, workspaceSlug, "social:read"
 * );
 * ```
 */
export async function requireWorkspacePermissionBySlug(
  session: Session | null,
  workspaceSlug: string,
  action: WorkspaceAction,
): Promise<WorkspaceMemberInfo> {
  if (!session?.user?.id) {
    throw new Error("Unauthorized: Authentication required");
  }

  const { data: workspace, error: wsError } = await tryCatch(
    prisma.workspace.findUnique({
      where: { slug: workspaceSlug, deletedAt: null },
      select: {
        id: true,
        members: {
          where: {
            userId: session.user.id,
            joinedAt: { not: null },
          },
          select: { workspaceId: true, userId: true, role: true },
          take: 1,
        },
      },
    }),
  );

  if (wsError || !workspace) {
    throw new Error("Not found: Workspace does not exist");
  }

  const bypassMembership = await getE2EBypassMembership(session, workspace.id);
  if (bypassMembership) {
    if (!hasPermission(bypassMembership.role, action)) {
      throw new Error(`Forbidden: Requires ${action} permission`);
    }
    return bypassMembership;
  }

  const member = workspace.members[0];
  if (!member) {
    logger.warn(
      `[WorkspaceMiddleware] Access denied: User ${session.user.id} is not a member of workspace ${workspace.id} (slug: ${workspaceSlug})`,
    );
    throw new Error("Forbidden: Not a workspace member");
  }

  if (!hasPermission(member.role, action)) {
    logger.warn(
      `[WorkspaceMiddleware] Access denied: User ${session.user.id} (role: ${member.role}) lacks ${action} permission for workspace ${workspace.id}`,
    );
    throw new Error(`Forbidden: Requires ${action} permission`);
  }

  return member;
}
