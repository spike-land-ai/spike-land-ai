/**
 * Shared auth guard for API routes.
 *
 * Centralizes the repeated pattern of calling `auth()`, checking the session,
 * and returning a 401 response if unauthenticated.
 */
import { auth } from "@/lib/auth";
import { tryCatch } from "@/lib/try-catch";
import { NextResponse } from "next/server";

interface AuthResult {
  session: {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  };
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
  const { data: session, error: authError } = await tryCatch(auth());
  if (authError || !session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { session: session as AuthResult["session"], userId: session.user.id };
}
