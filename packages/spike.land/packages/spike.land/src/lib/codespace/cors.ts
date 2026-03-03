/**
 * CORS headers for public codespace API routes.
 *
 * These endpoints are public (no auth) to match the original
 * Cloudflare Worker behavior at /live/{cs}/api/*.
 */

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

/**
 * Standard OPTIONS preflight response for codespace routes.
 */
export function corsOptions(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
