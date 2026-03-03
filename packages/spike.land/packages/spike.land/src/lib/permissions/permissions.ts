/**
 * Workspace Permission System
 *
 * Defines the permission matrix for Orbit workspace roles.
 * Four-tier role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
 */

import type { WorkspaceRole } from "@prisma/client";

/**
 * All possible workspace actions that can be permission-checked
 */
export type WorkspaceAction =
  // Workspace management
  | "workspace:delete"
  | "workspace:settings:read"
  | "workspace:settings:write"
  | "workspace:transfer"
  // Member management
  | "members:invite"
  | "members:remove"
  | "members:role:change"
  | "members:list"
  // Content management
  | "content:create"
  | "content:edit:own"
  | "content:edit:any"
  | "content:delete:own"
  | "content:delete:any"
  | "content:publish"
  // Streams & Calendar
  | "streams:create"
  | "streams:manage"
  | "calendar:create"
  | "calendar:manage"
  // AI Agents
  | "agents:create"
  | "agents:configure"
  | "agents:use"
  // Analytics
  | "analytics:view"
  | "analytics:export"
  // Inbox
  | "inbox:view"
  | "inbox:respond"
  | "inbox:manage"
  // Brand Brain
  | "brand:read"
  | "brand:write"
  | "brand:delete"
  // Asset Library
  | "asset:read"
  | "asset:write"
  | "asset:delete"
  | "asset:analyze"
  // Social Accounts
  | "social:view"
  | "social:connect"
  | "social:disconnect"
  | "social:post"
  | "social:read"
  // Notifications
  | "notifications:view"
  | "notifications:manage";

/**
 * Role hierarchy - higher index = more permissions
 */
const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

/**
 * Permission matrix - maps actions to minimum required role
 */
const PERMISSION_MATRIX: Record<WorkspaceAction, WorkspaceRole> = {
  // Workspace management - OWNER only for destructive actions
  "workspace:delete": "OWNER",
  "workspace:transfer": "OWNER",
  "workspace:settings:read": "ADMIN",
  "workspace:settings:write": "ADMIN",

  // Member management - ADMIN and above
  "members:invite": "ADMIN",
  "members:remove": "ADMIN",
  "members:role:change": "ADMIN",
  "members:list": "MEMBER",

  // Content management
  "content:create": "MEMBER",
  "content:edit:own": "MEMBER",
  "content:edit:any": "ADMIN",
  "content:delete:own": "MEMBER",
  "content:delete:any": "ADMIN",
  "content:publish": "MEMBER",

  // Streams & Calendar
  "streams:create": "MEMBER",
  "streams:manage": "ADMIN",
  "calendar:create": "MEMBER",
  "calendar:manage": "ADMIN",

  // AI Agents
  "agents:create": "ADMIN",
  "agents:configure": "ADMIN",
  "agents:use": "MEMBER",

  // Analytics
  "analytics:view": "MEMBER",
  "analytics:export": "ADMIN",

  // Inbox - only action available to VIEWER
  "inbox:view": "VIEWER",
  "inbox:respond": "MEMBER",
  "inbox:manage": "ADMIN",

  // Brand Brain
  "brand:read": "MEMBER",
  "brand:write": "ADMIN",
  "brand:delete": "ADMIN",

  // Asset Library
  "asset:read": "MEMBER",
  "asset:write": "MEMBER",
  "asset:delete": "MEMBER",
  "asset:analyze": "MEMBER",

  // Social Accounts
  "social:view": "MEMBER",
  "social:connect": "ADMIN",
  "social:disconnect": "ADMIN",
  "social:post": "MEMBER",
  "social:read": "MEMBER",

  // Notifications
  "notifications:view": "MEMBER",
  "notifications:manage": "ADMIN",
};

/**
 * Check if a role has permission for an action
 *
 * @param role - The user's workspace role
 * @param action - The action to check permission for
 * @returns true if the role has permission for the action
 *
 * @example
 * ```ts
 * hasPermission("ADMIN", "workspace:settings:write") // true
 * hasPermission("MEMBER", "workspace:delete") // false
 * ```
 */
export function hasPermission(
  role: WorkspaceRole,
  action: WorkspaceAction,
): boolean {
  const requiredRole = PERMISSION_MATRIX[action];
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Get all actions a role can perform
 *
 * @param role - The workspace role to check
 * @returns Array of permitted actions
 */
export function getPermittedActions(role: WorkspaceRole): WorkspaceAction[] {
  return (Object.entries(PERMISSION_MATRIX) as [
    WorkspaceAction,
    WorkspaceRole,
  ][])
    .filter(
      ([, requiredRole]) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole],
    )
    .map(([action]) => action);
}

/**
 * Get minimum role required for an action
 *
 * @param action - The action to check
 * @returns The minimum required role
 */
export function getRequiredRole(action: WorkspaceAction): WorkspaceRole {
  return PERMISSION_MATRIX[action];
}

/**
 * Get all available workspace actions
 *
 * @returns Array of all defined actions
 */
export function getAllActions(): WorkspaceAction[] {
  return Object.keys(PERMISSION_MATRIX) as WorkspaceAction[];
}

/**
 * Check if user can modify another user's role
 *
 * Rules:
 * - Must have members:role:change permission
 * - Only OWNER can promote to OWNER (transfer)
 * - ADMIN cannot modify OWNER or other ADMIN roles
 * - ADMIN can only change between MEMBER and VIEWER
 *
 * @param actorRole - The role of the user making the change
 * @param targetCurrentRole - The current role of the user being changed
 * @param targetNewRole - The new role to assign
 * @returns true if the role change is allowed
 */
export function canModifyRole(
  actorRole: WorkspaceRole,
  targetCurrentRole: WorkspaceRole,
  targetNewRole: WorkspaceRole,
): boolean {
  // Must have members:role:change permission
  if (!hasPermission(actorRole, "members:role:change")) {
    return false;
  }

  // No change needed
  if (targetCurrentRole === targetNewRole) {
    return false;
  }

  // Only owner can promote to owner (ownership transfer)
  if (targetNewRole === "OWNER" && actorRole !== "OWNER") {
    return false;
  }

  // Owner can modify anyone except themselves to a lower role
  // (self-demotion without transfer is not allowed via this function)
  if (actorRole === "OWNER") {
    return true;
  }

  // Admin restrictions
  if (actorRole === "ADMIN") {
    // Admin cannot modify owner
    if (targetCurrentRole === "OWNER") {
      return false;
    }
    // Admin cannot modify other admins
    if (targetCurrentRole === "ADMIN") {
      return false;
    }
    // Admin cannot promote to admin or owner
    if (targetNewRole === "ADMIN" || targetNewRole === "OWNER") {
      return false;
    }
  }

  return true;
}

/**
 * Compare two roles to determine hierarchy
 *
 * @param role1 - First role
 * @param role2 - Second role
 * @returns positive if role1 > role2, negative if role1 < role2, 0 if equal
 */
export function compareRoles(
  role1: WorkspaceRole,
  role2: WorkspaceRole,
): number {
  return ROLE_HIERARCHY[role1] - ROLE_HIERARCHY[role2];
}

/**
 * Check if a role is at or above a minimum level
 *
 * @param role - The role to check
 * @param minimumRole - The minimum required role
 * @returns true if role is at or above minimum
 */
export function isAtLeast(
  role: WorkspaceRole,
  minimumRole: WorkspaceRole,
): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimumRole];
}
