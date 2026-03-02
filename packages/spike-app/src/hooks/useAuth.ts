import { useAuth as useOidcAuth } from "react-oidc-context";
import { useEffect, useRef, useCallback } from "react";
import { stdbClient } from "@/lib/stdb";

export interface AppUser {
  sub: string;
  name: string | null;
  email: string | null;
  picture: string | null;
  preferred_username: string | null;
}

function mapProfile(profile: Record<string, unknown>): AppUser {
  return {
    sub: String(profile.sub ?? ""),
    name: (profile.name as string) ?? null,
    email: (profile.email as string) ?? null,
    picture: (profile.picture as string) ?? null,
    preferred_username: (profile.preferred_username as string) ?? (profile.login as string) ?? null,
  };
}

export function useAuth() {
  const auth = useOidcAuth();
  const prevTokenRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const token = auth.user?.id_token ?? auth.user?.access_token;

    if (auth.isAuthenticated && token) {
      if (token !== prevTokenRef.current) {
        // Token changed (initial login or silent renew) — reconnect
        stdbClient.disconnect();
        stdbClient.connect(token);
        prevTokenRef.current = token;
      }
    } else if (!auth.isAuthenticated && prevTokenRef.current) {
      stdbClient.disconnect();
      prevTokenRef.current = undefined;
    }
  }, [auth.isAuthenticated, auth.user?.id_token, auth.user?.access_token]);

  const login = useCallback(
    (provider?: string) => {
      const extraParams: Record<string, string> = {};
      if (provider) {
        extraParams.identity_provider = provider;
      }
      return auth.signinRedirect({ extraQueryParams: extraParams });
    },
    [auth],
  );

  const logout = useCallback(() => {
    stdbClient.disconnect();
    prevTokenRef.current = undefined;
    return auth.signoutRedirect();
  }, [auth]);

  return {
    user: auth.user?.profile ? mapProfile(auth.user.profile) : null,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error ?? null,
    login,
    logout,
  };
}
