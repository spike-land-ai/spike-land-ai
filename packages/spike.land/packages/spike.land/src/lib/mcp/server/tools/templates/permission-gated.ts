/**
 * Permission-Gated Tool Template
 *
 * Reusable pattern for tools that require role-based access control.
 * Checks user role before executing the tool handler.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { safeToolCall, textResult } from "../tool-helpers";

type UserRole = "USER" | "ADMIN";

/**
 * Wrap a tool handler with role-based permission checking.
 * Fetches the user's role from the database and rejects if insufficient.
 *
 * Usage:
 * ```ts
 * handler: permissionGatedHandler(
 *   "admin_delete_user",
 *   userId,
 *   "ADMIN",
 *   async (input) => {
 *     // Only reached if user is ADMIN
 *     return textResult("Deleted");
 *   },
 * )
 * ```
 */
export function permissionGatedHandler<T>(
  toolName: string,
  userId: string,
  requiredRole: UserRole,
  inner: (input: T) => Promise<CallToolResult>,
): (input: T) => Promise<CallToolResult> {
  return (input: T) =>
    safeToolCall(toolName, async () => {
      const prisma = (await import("@/lib/prisma")).default;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        return textResult(
          "**Error: NOT_FOUND**\nUser not found.\n**Retryable:** false",
        );
      }

      const roleHierarchy: Record<UserRole, number> = {
        USER: 0,
        ADMIN: 1,
      };

      const userLevel = roleHierarchy[user.role as UserRole] ?? 0;
      const requiredLevel = roleHierarchy[requiredRole];

      if (userLevel < requiredLevel) {
        return textResult(
          `**Error: PERMISSION_DENIED**\n`
            + `This tool requires **${requiredRole}** role.\n`
            + `Your role: **${user.role}**\n`
            + `**Retryable:** false`,
        );
      }

      return inner(input);
    });
}
