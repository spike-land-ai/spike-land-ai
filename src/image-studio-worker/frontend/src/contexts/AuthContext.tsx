import React, { createContext, useContext, useState } from "react";
import { storage } from "@/services/storage";
import { authClient } from "@/lib/auth";

interface AuthUser {
  name: string | null;
  email: string | null;
  image: string | null;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: AuthUser | null;
  login: (provider?: "google" | "github" | "apple") => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  user: null,
  login: async () => {},
  logout: async () => {},
  loading: true,
  error: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending, error: sessionError } = authClient.useSession();
  const [loginError, setLoginError] = useState<string | null>(null);
  const loading = isPending && !sessionError;
  const isLoggedIn = !!session && !sessionError;
  const authError = loginError || (sessionError ? String(sessionError) : null);
  const user: AuthUser | null = session?.user
    ? { name: session.user.name ?? null, email: session.user.email ?? null, image: session.user.image ?? null }
    : null;

  if (sessionError) {
    console.error("[Auth] Session check failed:", sessionError);
  }
  if (session) {
    console.debug("[Auth] Session active:", session.user?.email);
  }

  const login = async (provider: "google" | "github" | "apple" = "google") => {
    try {
      setLoginError(null);
      const result = await authClient.signIn.social({
        provider: provider,
        callbackURL: window.location.origin,
      });
      if (result.error) {
        const msg = result.error.message || `Sign-in with ${provider} failed`;
        console.error("[Auth] Login error:", msg);
        setLoginError(msg);
        return;
      }
      // Better Auth's redirect plugin should handle this, but as a fallback
      // (the plugin swallows errors in a try/catch), do it explicitly.
      if (result.data?.url && result.data?.redirect) {
        window.location.href = result.data.url;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed unexpectedly";
      console.error("[Auth] Login exception:", msg);
      setLoginError(msg);
    }
  };

  const logout = async () => {
    await authClient.signOut();
    await storage.clearAllLocalData();
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout, loading, error: authError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
