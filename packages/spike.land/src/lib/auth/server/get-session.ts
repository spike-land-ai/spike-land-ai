/**
 * Server-side session retrieval facade.
 *
 * This is THE key function — all server code calls this instead of
 * importing from `@/auth` directly. The facade delegates to the
 * active auth provider (Better Auth) and includes E2E bypass logic.
 */

import type { AuthSession } from "../core/types";
import {
  isE2EBypassAllowed,
  isEnvBypassEnabled,
  logBypassAttempt,
  validateBypassHeader,
} from "../e2e/bypass";
import { createMockSession } from "../e2e/mock-session";
import { logger } from "@/lib/errors/structured-logger";
import { tryCatch } from "@/lib/try-catch";

/**
 * Get the current authenticated session.
 *
 * Checks E2E bypass first, then delegates to the auth provider.
 * Returns null if not authenticated.
 */
export async function getSession(): Promise<AuthSession | null> {
  // Check for E2E bypass via env var FIRST (fastest path)
  if (isEnvBypassEnabled()) {
    logger.debug("[Auth] E2E_BYPASS_AUTH is enabled", { route: "/api/auth" });
    const { cookies } = await import("next/headers");
    const { data: cookieStore } = await tryCatch(cookies());

    if (cookieStore) {
      const sessionToken = cookieStore.get("better-auth.session_token")?.value;
      if (sessionToken === "mock-session-token") {
        logBypassAttempt("env", true);
        return createMockSession({
          email: cookieStore.get("e2e-user-email")?.value,
          name: cookieStore.get("e2e-user-name")?.value,
          role: cookieStore.get("e2e-user-role")?.value,
        });
      }
    }

    // In E2E mode without mock session, return null (unauthenticated)
    logger.debug("[Auth] E2E bypass: No mock session token, returning null", {
      route: "/api/auth",
    });
    return null;
  }

  // Check for E2E bypass via header (works on Vercel previews / CI)
  if (isE2EBypassAllowed()) {
    const { headers } = await import("next/headers");
    const { data: headersList } = await tryCatch(headers());
    const bypassHeader = headersList?.get("x-e2e-auth-bypass");
    const e2eBypassSecret = process.env.E2E_BYPASS_SECRET;

    if (bypassHeader && e2eBypassSecret) {
      if (validateBypassHeader(bypassHeader)) {
        logBypassAttempt("header", true);
        const { cookies } = await import("next/headers");
        const { data: cookieStore } = await tryCatch(cookies());
        return createMockSession({
          email: cookieStore?.get("e2e-user-email")?.value,
          name: cookieStore?.get("e2e-user-name")?.value,
          role: cookieStore?.get("e2e-user-role")?.value,
        });
      } else {
        logBypassAttempt("header", false);
      }
    }
  }

  // Use local Better Auth instance
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.session || !session?.user) return null;

  return {
    user: {
      id: session.user.id,
      email: session.user.email || "",
      name: session.user.name || "",
      image: session.user.image || null,
      role: (session.user as unknown as { role?: string }).role || "USER",
    },
    expires: typeof session.session.expiresAt === "string"
      ? session.session.expiresAt
      : session.session.expiresAt?.toISOString?.() || new Date(Date.now() + 86400000).toISOString(),
  } as unknown as AuthSession;
}
