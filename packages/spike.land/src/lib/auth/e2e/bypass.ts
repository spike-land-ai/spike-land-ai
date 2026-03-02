/**
 * E2E test bypass logic.
 *
 * Extracted from src/auth.ts to be reusable across auth providers.
 * Supports two bypass mechanisms:
 * 1. Environment variable: E2E_BYPASS_AUTH=true (local dev)
 * 2. Header: x-e2e-auth-bypass matching E2E_BYPASS_SECRET (CI/CD)
 */

import { secureCompare } from "@/lib/security/timing";
import { logger } from "@/lib/errors/structured-logger";

/**
 * Check if the current environment allows E2E bypass.
 * Never enabled in production unless it's a staging domain.
 */
export function isE2EBypassAllowed(): boolean {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const isStagingDomain = appUrl === "https://next.spike.land" || appUrl.includes("localhost");
  const isProduction =
    process.env.NODE_ENV === "production" &&
    process.env.APP_ENV === "production" &&
    !isStagingDomain;
  return !isProduction;
}

/**
 * Check if E2E bypass is enabled via environment variable.
 */
export function isEnvBypassEnabled(): boolean {
  return process.env.E2E_BYPASS_AUTH === "true";
}

/**
 * Validate the E2E bypass header against the secret.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function validateBypassHeader(headerValue: string | null): boolean {
  if (!headerValue) return false;
  const secret = process.env.E2E_BYPASS_SECRET;
  if (!secret) return false;
  if (!isE2EBypassAllowed()) return false;
  return secureCompare(headerValue, secret);
}

/**
 * Log E2E bypass attempt for security monitoring.
 */
export function logBypassAttempt(method: "env" | "header", success: boolean): void {
  if (success) {
    logger.debug(`[Auth] E2E bypass via ${method}`, { route: "/api/auth" });
  } else {
    logger.error(`[Auth] E2E bypass FAILED via ${method}`, undefined, { route: "/api/auth" });
  }
}
