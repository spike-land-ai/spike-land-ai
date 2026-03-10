/**
 * Google Ads conversion tracking and GCLID attribution.
 *
 * gtag.js is loaded statically in index.html with Consent Mode v2.
 * This module provides helpers to fire conversion and custom events,
 * and captures the GCLID parameter for offline conversion attribution.
 *
 * Conversion label for sign-up: set VITE_GOOGLE_ADS_CONVERSION_LABEL after
 * creating the conversion action in Google Ads (Tools > Conversions).
 * Purchase conversion label: set VITE_GOOGLE_ADS_PURCHASE_LABEL.
 */

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const GOOGLE_ADS_ID = "AW-17978085462";
const CONVERSION_LABEL: string | undefined = import.meta.env.VITE_GOOGLE_ADS_CONVERSION_LABEL;
const PURCHASE_LABEL: string | undefined = import.meta.env.VITE_GOOGLE_ADS_PURCHASE_LABEL;

const GCLID_STORAGE_KEY = "spike_gclid";
const GCLID_EXPIRY_KEY = "spike_gclid_exp";
const GCLID_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days (Google Ads attribution window)

/** Capture GCLID from URL and store for offline conversion attribution. */
function captureGclid(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const gclid = params.get("gclid");
    if (gclid) {
      localStorage.setItem(GCLID_STORAGE_KEY, gclid);
      localStorage.setItem(GCLID_EXPIRY_KEY, String(Date.now() + GCLID_TTL_MS));
    }
  } catch {
    // localStorage may be unavailable
  }
}

/** Retrieve stored GCLID if still within attribution window. */
export function getStoredGclid(): string | null {
  try {
    const gclid = localStorage.getItem(GCLID_STORAGE_KEY);
    const expiry = localStorage.getItem(GCLID_EXPIRY_KEY);
    if (!gclid || !expiry) return null;
    if (Date.now() > Number(expiry)) {
      localStorage.removeItem(GCLID_STORAGE_KEY);
      localStorage.removeItem(GCLID_EXPIRY_KEY);
      return null;
    }
    return gclid;
  } catch {
    return null;
  }
}

/** Initialize Google Ads: capture GCLID from landing URL. */
export function initGoogleAds(): void {
  captureGclid();
}

/** Track a Google Ads sign-up conversion. */
export function trackSignUpConversion(): void {
  if (!CONVERSION_LABEL || typeof window.gtag !== "function") return;
  window.gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${CONVERSION_LABEL}`,
  });
}

/** Track a Google Ads purchase/subscription conversion with optional value. */
export function trackPurchaseConversion(value?: number, currency = "USD"): void {
  if (!PURCHASE_LABEL || typeof window.gtag !== "function") return;
  window.gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${PURCHASE_LABEL}`,
    ...(value !== undefined && { value, currency }),
  });
}

/** Track a migration service purchase conversion with tier and value. */
export function trackMigrationConversion(
  tier: "blog" | "script" | "mcp",
  value: number,
  currency = "USD",
): void {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/migration_${tier}_checkout`,
    value,
    currency,
    migration_tier: tier,
  });
}

/** Track a custom Google Ads event (e.g. docs engagement, CLI install page). */
export function trackGoogleAdsEvent(eventName: string, params?: Record<string, unknown>): void {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", eventName, params);
}
