/**
 * Google Ads gtag.js integration for conversion tracking.
 *
 * Loads gtag.js dynamically only when cookie consent is accepted.
 * Conversion label for sign-up: set VITE_GOOGLE_ADS_CONVERSION_LABEL after
 * creating the conversion action in Google Ads (Tools > Conversions).
 */

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const GOOGLE_ADS_ID = "AW-17978085462";
const CONVERSION_LABEL: string | undefined = import.meta.env.VITE_GOOGLE_ADS_CONVERSION_LABEL;

let gtagLoaded = false;

function hasConsent(): boolean {
  try {
    return localStorage.getItem("cookie_consent") === "accepted";
  } catch {
    return false;
  }
}

function gtag(...args: unknown[]): void {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

function loadGtagScript(): void {
  if (gtagLoaded || !GOOGLE_ADS_ID) return;
  gtagLoaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", GOOGLE_ADS_ID, {
    // Respect user consent — don't store cookies until explicit consent
    anonymize_ip: true,
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
  document.head.appendChild(script);
}

/** Initialize Google Ads tracking. Call once on app mount. Only loads if consent is given. */
export function initGoogleAds(): void {
  if (!hasConsent()) return;
  loadGtagScript();
}

/** Track a Google Ads sign-up conversion. */
export function trackSignUpConversion(): void {
  if (!CONVERSION_LABEL || !hasConsent()) return;
  loadGtagScript();
  gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${CONVERSION_LABEL}`,
  });
}

/** Track a custom Google Ads event (e.g. docs engagement, CLI install page). */
export function trackGoogleAdsEvent(eventName: string, params?: Record<string, unknown>): void {
  if (!hasConsent()) return;
  loadGtagScript();
  gtag("event", eventName, params);
}
