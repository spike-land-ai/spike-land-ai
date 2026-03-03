/**
 * Framework-agnostic auth types.
 *
 * These types decouple the application from any specific auth library
 * (NextAuth, Better Auth, etc.) and work on both Node.js and CF Workers.
 */

/**
 * User roles matching the Prisma UserRole enum.
 * Defined as a const object (not enum) for CF Workers compatibility.
 */
export const UserRole = {
  USER: "USER",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/**
 * Authenticated user object returned in sessions.
 * Shape matches the existing NextAuth session.user exactly.
 */
export interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: UserRole;
}

/**
 * Auth session object.
 * Shape matches the existing NextAuth Session exactly.
 */
export interface AuthSession {
  user: AuthUser;
  expires: string;
}
