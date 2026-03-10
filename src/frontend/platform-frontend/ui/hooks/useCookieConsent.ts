import { useEffect, useState } from "react";
import { flushAnalyticsQueue } from "./useAnalytics";

type ConsentState = boolean | null;

interface CookieConsentHook {
  consentGiven: ConsentState;
  accept: () => void;
  reject: () => void;
}

const STORAGE_KEY = "cookie_consent";
const COOKIE_MAX_AGE = 31536000;

function setConsentCookie(value: "accepted" | "rejected"): void {
  document.cookie = `${STORAGE_KEY}=${value};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
}

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

  const accept = (): void => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setConsentCookie("accepted");
    setConsentGiven(true);
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
        analytics_storage: "granted",
      });
    }
    // Flush any events that were queued before consent was granted
    flushAnalyticsQueue();
  };

  const reject = (): void => {
    localStorage.setItem(STORAGE_KEY, "rejected");
    setConsentCookie("rejected");
    setConsentGiven(false);
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      });
    }
  };

  return { consentGiven, accept, reject };
}
