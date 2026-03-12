import { useCallback, useEffect, useState } from "react";
import { flushAnalyticsQueue } from "./useAnalytics";

type ConsentState = boolean | null;

interface CookieConsentHook {
  consentGiven: ConsentState;
  accept: () => void;
  reject: () => void;
}

/** Consent mode update payload sent to gtag. */
interface GtagConsentUpdate {
  ad_storage: "granted" | "denied";
  ad_user_data: "granted" | "denied";
  ad_personalization: "granted" | "denied";
  analytics_storage: "granted" | "denied";
}

/**
 * Minimal typing for the gtag global used in consent updates.
 * The full declaration lives in `core-logic/google-ads.ts`; this local
 * interface makes `sendGtagConsent` independently type-safe.
 */
interface WindowWithGtag extends Window {
  gtag?: (...args: unknown[]) => void;
}

const STORAGE_KEY = "cookie_consent";
const COOKIE_MAX_AGE = 31536000;

function setConsentCookie(value: "accepted" | "rejected"): void {
  document.cookie = `${STORAGE_KEY}=${value};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
}

function sendGtagConsent(update: GtagConsentUpdate): void {
  const win = window as WindowWithGtag;
  if (typeof win.gtag === "function") {
    win.gtag("consent", "update", update);
  }
}

/**
 * Manages cookie/tracking consent state with localStorage and cookie persistence.
 *
 * - Reads persisted consent on mount.
 * - `accept()` grants all ad and analytics storage, flushes the analytics queue.
 * - `reject()` denies all ad and analytics storage.
 * - Updates are forwarded to gtag Consent Mode v2 when gtag is available.
 *
 * @returns `consentGiven` — `true` (accepted), `false` (rejected), or `null` (unknown).
 * @returns `accept` — user-facing accept handler.
 * @returns `reject` — user-facing reject handler.
 */
export function useCookieConsent(): CookieConsentHook {
  const [consentGiven, setConsentGiven] = useState<ConsentState>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "accepted") {
      setConsentGiven(true);
    } else if (stored === "rejected") {
      setConsentGiven(false);
    }
    // null remains when no stored value
  }, []);

  const accept = useCallback((): void => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setConsentCookie("accepted");
    setConsentGiven(true);
    sendGtagConsent({
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted",
    });
    // Flush any events that were queued before consent was granted
    flushAnalyticsQueue();
  }, []);

  const reject = useCallback((): void => {
    localStorage.setItem(STORAGE_KEY, "rejected");
    setConsentCookie("rejected");
    setConsentGiven(false);
    sendGtagConsent({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    });
  }, []);

  return { consentGiven, accept, reject };
}
