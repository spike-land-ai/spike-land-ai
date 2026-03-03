import { useCallback } from "react";
import { authClient } from "@/lib/auth";

export interface AppUser {
  sub: string;
  name: string | null;
  email: string | null;
  picture: string | null;
  preferred_username: string | null;
}

export function useAuth() {
  const { data: session, isPending, error } = authClient.useSession();

  const isAuthenticated = !!session?.user;

  const login = useCallback((provider?: string) => {
    if (!provider) {
      // Default to github if no provider specified
      provider = "github";
    }
    return authClient.signIn.social({
      provider: provider as "github" | "google",
      callbackURL: "/",
    });
  }, []);

  const logout = useCallback(async () => {
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
