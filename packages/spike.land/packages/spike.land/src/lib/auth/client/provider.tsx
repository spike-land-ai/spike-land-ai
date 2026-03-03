"use client";

/**
 * Session provider facade.
 *
 * Wraps the auth library's session provider so client components
 * import from `@/lib/auth/client` instead of `next-auth/react`.
 */

import type { AuthSession } from "../core/types";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

interface SessionProviderProps {
  children: React.ReactNode;
  session?: AuthSession | null;
}

export function SessionProvider({ children, session }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider
      session={session as Parameters<typeof NextAuthSessionProvider>[0]["session"]}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
