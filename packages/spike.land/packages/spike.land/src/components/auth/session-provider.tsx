"use client";

import type { AuthSession } from "@/lib/auth/core/types";
import { SessionProvider as NextAuthSessionProvider } from "@/lib/auth/client/provider";

interface SessionProviderProps {
  children: React.ReactNode;
  session?: AuthSession | null;
}

export function SessionProvider({ children, session }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  );
}
