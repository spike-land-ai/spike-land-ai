const SPIKE_LAND_ORIGIN_PATTERN = /^https:\/\/([a-z0-9-]+\.)*spike\.land$/i;
const LOCAL_SPIKE_LAND_ORIGIN_PATTERN = /^https:\/\/local\.spike\.land(:\d+)?$/i;
const LOCALHOST_ORIGIN_PATTERN = /^https?:\/\/localhost(:\d+)?$/i;

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://static.cloudflareinsights.com https://esm.sh https://esm.spike.land https://unpkg.com https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://esm.spike.land https://unpkg.com",
  "img-src 'self' https://*.r2.dev https://*.r2.cloudflarestorage.com https://avatars.githubusercontent.com https://*.googleusercontent.com https://*.basemaps.cartocdn.com https://image-studio-mcp.spike.land https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com data: blob:",
  "font-src 'self' https://fonts.gstatic.com https://esm.spike.land data:",
  "connect-src 'self' https://api.spike.land https://edge.spike.land https://auth-mcp.spike.land https://mcp.spike.land https://js.spike.land https://image-studio-mcp.spike.land https://chat.spike.land https://checkout.stripe.com wss://spike.land wss://chat.spike.land https://esm.sh https://esm.spike.land https://unpkg.com https://local.spike.land:5173 https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://www.google.com https://googleads.g.doubleclick.net blob: data:",
  "worker-src 'self' blob: https://esm.sh https://esm.spike.land",
  "frame-src 'self' https://edge.spike.land https://chat.spike.land https://checkout.stripe.com https://js.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors *",
  "upgrade-insecure-requests",
].join("; ");

export function isAllowedBrowserOrigin(origin: string, configuredOrigins: string[]): boolean {
  return (
    configuredOrigins.includes(origin)
    || SPIKE_LAND_ORIGIN_PATTERN.test(origin)
    || LOCAL_SPIKE_LAND_ORIGIN_PATTERN.test(origin)
    || LOCALHOST_ORIGIN_PATTERN.test(origin)
  );
}

export function applySecurityHeaders(headers: Headers): void {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
}
