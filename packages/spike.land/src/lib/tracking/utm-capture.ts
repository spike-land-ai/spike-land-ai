/**
 * UTM Parameter Capture Utilities
 *
 * Captures and manages UTM parameters from URLs for campaign tracking.
 * Also captures platform-specific click IDs (gclid, fbclid).
 */

import { cookies } from "next/headers";

/** Cookie name for storing UTM parameters */
const UTM_COOKIE_NAME = "spike_utm_params";

/** Cookie expiry in seconds (30 days) */
const UTM_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * UTM parameters interface for campaign tracking
 */
export interface UTMParams {
  /** Traffic source (e.g., google, facebook, newsletter) */
  utm_source?: string;
  /** Marketing medium (e.g., cpc, email, social) */
  utm_medium?: string;
  /** Campaign name/identifier */
  utm_campaign?: string;
  /** Paid search keywords */
  utm_term?: string;
  /** Content differentiator for A/B testing */
  utm_content?: string;
  /** Google Click ID for Google Ads attribution */
  gclid?: string;
  /** Facebook Click ID for Meta Ads attribution */
  fbclid?: string;
}

/** All recognized UTM and click ID parameter names */
const UTM_PARAM_KEYS: (keyof UTMParams)[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
];

/**
 * Extract UTM parameters from a URL
 *
 * @param url - The URL to extract parameters from
 * @returns UTMParams object with extracted values, or empty object if none found
 *
 * @example
 * ```typescript
 * const url = new URL("https://spike.land?utm_source=google&utm_medium=cpc");
 * const params = captureUTMParams(url);
 * // Returns: { utm_source: "google", utm_medium: "cpc" }
 * ```
 */
export function captureUTMParams(url: URL): UTMParams {
  const params: UTMParams = {};

  for (const key of UTM_PARAM_KEYS) {
    const value = url.searchParams.get(key);
    if (value) {
      params[key] = value;
    }
  }

  return params;
}

import { tryCatchSync } from "@/lib/try-catch";

/**
 * Get stored UTM parameters from cookie (server-side)
 *
 * @returns UTMParams object if found, null otherwise
 *
 * @example
 * ```typescript
 * const params = await getUTMFromCookies();
 * if (params?.utm_campaign) {
 *   console.log(`Campaign: ${params.utm_campaign}`);
 * }
 * ```
 */
export async function getUTMFromCookies(): Promise<UTMParams | null> {
  const cookieStore = await cookies();
  const utmCookie = cookieStore.get(UTM_COOKIE_NAME);

  if (!utmCookie?.value) {
    return null;
  }

  const { data: params } = tryCatchSync<UTMParams>(() => JSON.parse(utmCookie.value));

  if (!params) {
    return null;
  }

  // Validate that at least one UTM param exists
  const hasValidParam = UTM_PARAM_KEYS.some((key) => params[key]);
  return hasValidParam ? params : null;
}

/**
 * Store UTM parameters in a cookie (server-side)
 *
 * Only stores if cookie consent has been given and there are valid parameters.
 * Uses 30-day expiry for attribution tracking.
 *
 * @param params - The UTM parameters to store
 *
 * @example
 * ```typescript
 * const params = captureUTMParams(new URL(request.url));
 * if (Object.keys(params).length > 0) {
 *   await storeUTMParams(params);
 * }
 * ```
 */
export async function storeUTMParams(params: UTMParams): Promise<void> {
  // Check for any valid parameters
  const hasValidParam = UTM_PARAM_KEYS.some((key) => params[key]);
  if (!hasValidParam) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(UTM_COOKIE_NAME, JSON.stringify(params), {
    maxAge: UTM_COOKIE_MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

/**
 * Clear stored UTM parameters from cookie
 *
 * Useful after attribution has been recorded or for testing.
 */
export async function clearUTMCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(UTM_COOKIE_NAME);
}

/**
 * Capture UTM parameters from URL and store in cookie
 *
 * Convenience function that combines capture and store operations.
 * Only stores if there are valid UTM parameters.
 *
 * @param url - The URL to extract parameters from
 * @returns The captured UTM parameters
 *
 * @example
 * ```typescript
 * // In middleware or page load
 * const params = await captureAndStoreUTM(new URL(request.url));
 * ```
 */
export async function captureAndStoreUTM(url: URL): Promise<UTMParams> {
  const params = captureUTMParams(url);

  if (Object.keys(params).length > 0) {
    await storeUTMParams(params);
  }

  return params;
}

/**
 * Determine traffic source platform from UTM parameters
 *
 * @param params - UTM parameters to analyze
 * @returns Platform identifier string
 */
export function getPlatformFromUTM(
  params: UTMParams,
): "FACEBOOK" | "GOOGLE_ADS" | "ORGANIC" | "DIRECT" | "OTHER" {
  // Check click IDs first (most reliable)
  if (params.gclid) {
    return "GOOGLE_ADS";
  }
  if (params.fbclid) {
    return "FACEBOOK";
  }

  // Check UTM source
  const source = params.utm_source?.toLowerCase();
  if (source) {
    if (source.includes("google") || source.includes("gads")) {
      return "GOOGLE_ADS";
    }
    if (
      source.includes("facebook") ||
      source.includes("fb") ||
      source.includes("instagram") ||
      source.includes("meta")
    ) {
      return "FACEBOOK";
    }
    // Has UTM params but not from major ad platforms
    return "OTHER";
  }

  // No tracking params
  return "DIRECT";
}
