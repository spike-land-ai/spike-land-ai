import { type NextRequest } from "next/server";

/**
 * Extract the client IP address from request headers.
 * Prioritizes headers set by trusted proxies (Cloudflare, Vercel) to prevent spoofing.
 *
 * Security Note:
 * Simply reading x-forwarded-for without validation allows IP spoofing if the
 * application is directly exposed or the proxy doesn't overwrite it.
 * However, on platforms like Vercel and Cloudflare, these headers are
 * generally trustworthy when configured correctly.
 */
export function getClientIp(request: NextRequest | Request | Headers): string {
  let headers: Headers;

  // Safer check for Next.js internal Headers objects (ReadonlyHeaders) which might not strict-equal Headers.
  // Request and NextRequest objects have a 'headers' property.
  // Headers objects do not.
  if ("headers" in request) {
    headers = request.headers;
  } else {
    headers = request as Headers;
  }

  // 1. Cloudflare / Vercel (most reliable if present)
  const xClientIp = headers.get("x-client-ip");
  if (xClientIp) return xClientIp.trim();

  // 2. Cloudflare specific
  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  // 3. Standard forwarded (take the first one as it's the client IP added by the edge)
  // Vercel ensures the first IP in x-forwarded-for is the client IP.
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0];
    if (firstIp) return firstIp.trim();
  }

  // 4. Fallback (some proxies/hosting)
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}
