/**
 * Auth provider configuration.
 *
 * Centralizes environment variable checks for OAuth providers.
 * Only providers with both client ID and secret configured are enabled.
 */

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
}

export function getGitHubConfig(): OAuthProviderConfig | null {
  const clientId = process.env.GITHUB_ID?.trim();
  const clientSecret = process.env.GITHUB_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function getGoogleConfig(): OAuthProviderConfig | null {
  const clientId = process.env.GOOGLE_ID?.trim();
  const clientSecret = process.env.GOOGLE_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function getAppleConfig(): OAuthProviderConfig | null {
  const clientId = process.env.AUTH_APPLE_ID?.trim();
  const clientSecret = process.env.AUTH_APPLE_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function getFacebookConfig(): OAuthProviderConfig | null {
  const clientId = process.env.AUTH_FACEBOOK_ID?.trim();
  const clientSecret = process.env.AUTH_FACEBOOK_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function getEnabledProviders(): string[] {
  const providers: string[] = [];
  if (getGitHubConfig()) providers.push("github");
  if (getGoogleConfig()) providers.push("google");
  if (getAppleConfig()) providers.push("apple");
  if (getFacebookConfig()) providers.push("facebook");
  return providers;
}
