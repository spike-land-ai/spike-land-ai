import { createAuthClient } from "better-auth/react";

const baseURL = import.meta.env.VITE_AUTH_URL || "";

export const authClient = createAuthClient({
  baseURL,
});

export const authProviders = [
  { id: "github", name: "GitHub", icon: "github" },
  { id: "google", name: "Google", icon: "google" },
] as const;

export type AuthProvider = (typeof authProviders)[number];
