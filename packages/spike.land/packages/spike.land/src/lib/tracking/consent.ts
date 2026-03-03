export const CONSENT_KEY = "cookie-consent";
export const CONSENT_CHANGED_EVENT = "consent-changed";

let cachedConsent: boolean | null = null;

/**
 * Check if user has given cookie consent
 */
export function hasConsent(): boolean {
  if (typeof window === "undefined") return false;

  // Disable caching in test environment to prevent test pollution
  if (process.env.NODE_ENV === "test") {
    return localStorage.getItem(CONSENT_KEY) === "accepted";
  }

  if (cachedConsent !== null) return cachedConsent;

  cachedConsent = localStorage.getItem(CONSENT_KEY) === "accepted";
  return cachedConsent;
}

/**
 * Notify components that consent has changed (for same-tab reactivity)
 * Call this after updating localStorage with consent value
 */
export function notifyConsentChanged(): void {
  if (typeof window === "undefined") return;

  // Update cache immediately
  cachedConsent = localStorage.getItem(CONSENT_KEY) === "accepted";

  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT));
}

/**
 * Reset the consent cache (for testing purposes)
 */
export function resetConsentCache(): void {
  cachedConsent = null;
}
