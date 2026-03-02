"use client";

/**
 * Session provider facade.
 *
 * Wraps the auth library's session provider so client components
 * import from `@/lib/auth/client` instead of `next-auth/react`.
 */

import type { AuthSession } from "../core/types";
import { SessionProvider as NextAuthSessionProvider } from "@/lib/auth/client";

interface SessionProviderProps {
  children: React.ReactNode;
  session?: AuthSession | null;
}

export function SessionProvider({ children, session }: SessionProviderProps) {
  const sessionProp = session as
    | Parameters<typeof NextAuthSessionProvider>[0]["session"]
    | undefined;
  return (
    <NextAuthSessionProvider {...(sessionProp !== undefined ? { session: sessionProp } : {})}>
      {children}
    </NextAuthSessionProvider>
  );
}
