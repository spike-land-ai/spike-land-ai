export const PLATFORM_HOSTS = {
  site: "spike.land",
  www: "www.spike.land",
  analytics: "analytics.spike.land",
  api: "api.spike.land",
  edge: "edge.spike.land",
  authMcp: "auth-mcp.spike.land",
  imageStudioMcp: "image-studio-mcp.spike.land",
  chat: "chat.spike.land",
  mcp: "mcp.spike.land",
  js: "js.spike.land",
  status: "status.spike.land",
  gov: "gov.spike.land",
} as const;

export const MAIN_SITE_HOSTS = [
  PLATFORM_HOSTS.site,
  PLATFORM_HOSTS.www,
  PLATFORM_HOSTS.analytics,
  PLATFORM_HOSTS.gov,
] as const;

const AUTH_HOSTS = [
  PLATFORM_HOSTS.site,
  PLATFORM_HOSTS.analytics,
  PLATFORM_HOSTS.gov,
  PLATFORM_HOSTS.imageStudioMcp,
  PLATFORM_HOSTS.authMcp,
] as const;

export const AUTH_ALLOWED_ORIGINS = AUTH_HOSTS.map((host) => `https://${host}`);
export const LOCAL_AUTH_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
] as const;
export const AUTH_TRUSTED_ORIGINS = [...AUTH_ALLOWED_ORIGINS, ...LOCAL_AUTH_ALLOWED_ORIGINS];
