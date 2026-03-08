import { useEffect, useState } from "react";

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
  };

  const reject = (): void => {
    localStorage.setItem(STORAGE_KEY, "rejected");
    setConsentCookie("rejected");
    setConsentGiven(false);
  };

  return { consentGiven, accept, reject };
}
