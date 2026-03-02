import { WebStorageStateStore } from "oidc-client-ts";
import type { AuthProviderProps } from "react-oidc-context";

export const oidcConfig: AuthProviderProps = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY ?? "https://auth.spacetimedb.com/oidc",
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID ?? "spike-platform-client-id",
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: window.location.origin,
  scope: "openid profile email",
  response_type: "code",
  automaticSilentRenew: true,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  monitorSession: true,
  silent_redirect_uri: `${window.location.origin}/silent-renew.html`,
};

export const authProviders = [
  { id: "github", name: "GitHub", icon: "github" },
  { id: "google", name: "Google", icon: "google" },
] as const;

export type AuthProvider = (typeof authProviders)[number];
