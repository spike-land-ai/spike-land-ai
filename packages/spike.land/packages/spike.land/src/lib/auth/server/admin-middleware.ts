/**
 * Admin middleware facade.
 *
 * Thin wrapper that re-exports admin checks from the existing module.
 * This allows API routes to import from `@/lib/auth` consistently.
 */

export {
  isAdmin,
  isAdminByUserId,
  isSuperAdmin,
  requireAdmin,
  requireAdminByUserId,
  verifyAdminAccess,
} from "../admin-middleware";
