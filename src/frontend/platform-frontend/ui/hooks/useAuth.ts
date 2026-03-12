import { useCallback, useEffect, useState } from "react";
import { authClient } from "../../auth/auth";

export interface AppUser {
  sub: string;
  name: string | null;
  email: string | null;
  picture: string | null;
  preferred_username: string | null;
}

interface SessionUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface SessionData {
  user: SessionUser;
}

interface SessionResult {
  data: SessionData | null;
  isPending: boolean;
  error: Error | null;
}

type AuthProvider = "github" | "google";

const VALID_PROVIDERS: ReadonlySet<string> = new Set<AuthProvider>(["github", "google"]);

/**
 * Narrows an unknown value to `Error`. Returns `null` if the value is nullish,
 * wraps plain strings/objects in an `Error` otherwise.
 */
function toError(value: unknown): Error | null {
  if (value == null) return null;
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value);
  return new Error("Authentication error");
}

/**
 * Checks whether a raw value from `authClient.useSession()` has the shape of
 * `SessionData`. Avoids a blind `as` cast.
 */
function isSessionData(value: unknown): value is SessionData {
  if (value == null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (obj["user"] == null || typeof obj["user"] !== "object") return false;
  const user = obj["user"] as Record<string, unknown>;
  return typeof user["id"] === "string" && typeof user["email"] === "string";
}

/**
 * Returns `true` when `provider` is one of the accepted OAuth providers.
 */
function isAuthProvider(provider: string): provider is AuthProvider {
  return VALID_PROVIDERS.has(provider);
}

function useSafeSession(): SessionResult {
  const result = authClient.useSession();
  const [authError, setAuthError] = useState<Error | null>(null);

  useEffect(() => {
    const err = toError(result.error);
    if (err && !authError) {
      setAuthError(err);
    }
  }, [result.error, authError]);

  if (authError) {
    return { data: null, isPending: false, error: authError };
  }

  return {
    data: isSessionData(result.data) ? result.data : null,
    isPending: result.isPending,
    error: toError(result.error),
  };
}

/**
 * Provides authentication state and actions for the current user session.
 *
 * @returns `user` — mapped `AppUser` or `null` when unauthenticated.
 * @returns `isAuthenticated` — `true` when a valid session exists.
 * @returns `isLoading` — `true` while the session is being fetched.
 * @returns `error` — any auth error surfaced from the session provider.
 * @returns `login` — initiates an OAuth sign-in flow.
 * @returns `logout` — signs the current user out.
 */
export function useAuth() {
  const { data: session, isPending, error } = useSafeSession();

  const isAuthenticated = !!session?.user;

  const login = useCallback((provider?: string) => {
    const resolvedProvider: AuthProvider =
      provider && isAuthProvider(provider) ? provider : "github";

    // Validate returnUrl is a relative path to prevent open-redirect (CWE-601)
    const returnParam = new URLSearchParams(window.location.search).get("returnUrl");
    const callbackURL = returnParam && returnParam.startsWith("/") ? returnParam : "/";
    return authClient.signIn.social({
      provider: resolvedProvider,
      callbackURL,
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
