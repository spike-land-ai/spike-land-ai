import { useEffect, useRef, useCallback } from "react";
import { authClient } from "@/lib/auth";
import { stdbClient } from "@/lib/stdb";

export interface AppUser {
  sub: string;
  name: string | null;
  email: string | null;
  picture: string | null;
  preferred_username: string | null;
}

export function useAuth() {
  const { data: session, isPending, error } = authClient.useSession();
  const prevTokenRef = useRef<string | undefined>(undefined);

  const isAuthenticated = !!session?.user;
  const token = session?.session?.token;

  useEffect(() => {
    if (isAuthenticated && token) {
      if (token !== prevTokenRef.current) {
        stdbClient.disconnect();
        stdbClient.connect(token);
        prevTokenRef.current = token;
      }
    } else if (!isAuthenticated && prevTokenRef.current) {
      stdbClient.disconnect();
      prevTokenRef.current = undefined;
    }
  }, [isAuthenticated, token]);

  const login = useCallback(
    (provider?: string) => {
      if (!provider) {
        // Default to github if no provider specified
        provider = "github";
      }
      return authClient.signIn.social({
        provider: provider as "github" | "google",
        callbackURL: "/",
      });
    },
    [],
  );

  const logout = useCallback(async () => {
    stdbClient.disconnect();
    prevTokenRef.current = undefined;
    await authClient.signOut();
  }, []);

  const user: AppUser | null = session?.user
    ? {
        sub: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        picture: session.user.image ?? null,
        preferred_username: session.user.name ?? null,
      }
    : null;

  return {
    user,
    isAuthenticated,
    isLoading: isPending,
    error: error ?? null,
    login,
    logout,
  };
}
