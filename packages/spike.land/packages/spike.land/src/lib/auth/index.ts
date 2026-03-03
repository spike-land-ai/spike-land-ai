/**
 * Auth facade barrel export.
 *
 * All server-side code should import from `@/lib/auth` instead of
 * `@/auth` or `next-auth` directly. This enables swapping the
 * underlying auth provider without changing consumer code.
 *
 * Client components should import from `@/lib/auth/client`.
 */

// Core types (framework-agnostic)
export type { AuthSession, AuthUser } from "./core/types";
export { UserRole } from "./core/types";
export { createStableUserId } from "./core/stable-id";

// Server-side session
export { getSession } from "./server/get-session";
export { requireAuth } from "./server/require-auth";

// Admin middleware
export {
  isAdmin,
  isAdminByUserId,
  isSuperAdmin,
  requireAdmin,
  requireAdminByUserId,
  verifyAdminAccess,
} from "./server/admin-middleware";

// Backward compatibility: `auth` is an alias for `getSession`
export { getSession as auth } from "./server/get-session";
