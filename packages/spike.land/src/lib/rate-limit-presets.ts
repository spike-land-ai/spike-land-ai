/**
 * Simple rate limit helper for generation endpoints.
 * Wraps the existing rate-limiter with anonymous/authenticated presets.
 */

import { checkRateLimit } from "@/lib/rate-limiter";

const ANON_GENERATION_CONFIG = {
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
};

const AUTH_GENERATION_CONFIG = {
  maxRequests: 20,
  windowMs: 60 * 60 * 1000, // 1 hour
};

/**
 * Check generation rate limit for a request.
 * @param ip - Client IP address
 * @param authenticated - Whether the user is authenticated
 * @returns Whether the request is allowed and retry-after info
 */
export async function checkGenerationRateLimit(
  ip: string,
  authenticated: boolean,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const config = authenticated ? AUTH_GENERATION_CONFIG : ANON_GENERATION_CONFIG;
  const identifier = `generation:${authenticated ? "auth" : "anon"}:${ip}`;

  const result = await checkRateLimit(identifier, config);

  if (result.isLimited) {
    const retryAfterSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(retryAfterSeconds, 1),
    };
  }

  return { allowed: true };
}

export { getClientIp } from "@/lib/security/ip";
