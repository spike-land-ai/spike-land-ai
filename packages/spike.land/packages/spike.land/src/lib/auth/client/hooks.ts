"use client";

/**
 * Client-side auth hooks facade.
 *
 * Re-exports session hooks so client components import
 * from `@/lib/auth/client` instead of `next-auth/react`.
 * Returns the same { data, status, update } shape.
 */

import { useSession as useNextAuthSession } from "next-auth/react";
import type { AuthSession } from "../core/types";

interface UseSessionReturn {
  data: AuthSession | null;
  status: "loading" | "authenticated" | "unauthenticated";
  update: (data?: Record<string, unknown>) => Promise<AuthSession | null>;
}

/**
 * Get the current session on the client side.
 * Must be used within a SessionProvider.
 */
export function useSession(): UseSessionReturn {
  const { data, status, update } = useNextAuthSession();
  return {
    data: data as AuthSession | null,
    status,
    update: update as UseSessionReturn["update"],
  };
}
