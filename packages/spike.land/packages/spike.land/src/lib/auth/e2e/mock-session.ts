/**
 * Mock session creation for E2E testing.
 *
 * Extracted from src/auth.ts to be reusable across auth providers.
 * Creates mock sessions based on E2E cookies.
 */

import type { AuthSession } from "../core/types";
import { UserRole } from "../core/types";

/**
 * Known test email → ID mappings for E2E test consistency.
 */
const TEST_USER_MAP: Record<string, { id: string; role?: UserRole; }> = {
  "admin@example.com": { id: "admin-user-id", role: UserRole.ADMIN },
  "newuser@example.com": { id: "new-user-id" },
  "no-orders@example.com": { id: "new-user-id" },
};

/**
 * Create a mock session for E2E testing.
 *
 * @param options - Optional overrides from cookies
 */
export function createMockSession(options?: {
  email?: string;
  name?: string;
  role?: string;
}): AuthSession {
  const email = options?.email || "test@example.com";
  const name = options?.name || "Test User";

  // Validate role against UserRole values
  const validRoles = Object.values(UserRole);
  let role: UserRole = validRoles.includes(options?.role as UserRole)
    ? (options!.role as UserRole)
    : UserRole.USER;

  // Map known test emails to seeded IDs
  let id = "test-user-id";
  const mapping = TEST_USER_MAP[email];
  if (mapping) {
    id = mapping.id;
    if (mapping.role) {
      role = mapping.role;
    }
  }

  return {
    user: {
      id,
      name,
      email,
      image: null,
      role,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}
