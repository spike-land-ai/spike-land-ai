/**
 * Timing-safe cron secret validation.
 *
 * Uses crypto.timingSafeEqual to prevent timing-based side-channel attacks
 * when comparing the CRON_SECRET. Plain string equality (===) leaks timing
 * information that can be exploited to brute-force the secret.
 *
 * OWASP reference: A2 - Cryptographic Failures / Broken Authentication
 */
import crypto from "crypto";

/**
 * Returns true when the request carries a valid CRON_SECRET.
 *
 * Accepts two formats used by Vercel Cron and manual callers:
 *   - Authorization: Bearer <secret>
 *   - x-cron-secret: <secret>
 *
 * In development, if CRON_SECRET is not set, access is allowed and a warning
 * is logged.  In production the secret must be present and match.
 */
export function validateCronSecret(request: {
  headers: { get(name: string): string | null; };
}): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[cron-auth] CRON_SECRET not configured — allowing in development mode",
      );
      return true;
    }
    return false;
  }

  const secretBuf = Buffer.from(cronSecret);

  // Check Authorization: Bearer <secret>
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (
      token.length === cronSecret.length
      && crypto.timingSafeEqual(Buffer.from(token), secretBuf)
    ) {
      return true;
    }
  }

  // Check x-cron-secret header (also used by Vercel Cron)
  const cronSecretHeader = request.headers.get("x-cron-secret");
  if (
    cronSecretHeader !== null
    && cronSecretHeader.length === cronSecret.length
    && crypto.timingSafeEqual(Buffer.from(cronSecretHeader), secretBuf)
  ) {
    return true;
  }

  return false;
}
