/**
 * Shared auth guard for API routes.
 *
 * Facade that replaces `src/lib/api/require-auth.ts`.
 * Uses the auth facade instead of importing NextAuth directly.
 */

import { NextResponse } from "next/server";
import type { AuthSession } from "../core/types";
import { getSession } from "./get-session";

interface AuthResult {
  session: AuthSession;
  userId: string;
}

/**
 * Require an authenticated session. Returns the session and userId,
 * or a 401 NextResponse if unauthenticated.
 *
 * Usage:
 * ```ts
 * const result = await requireAuth();
 * if (result instanceof NextResponse) return result;
 * const { session, userId } = result;
 * ```
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { session, userId: session.user.id };
}
