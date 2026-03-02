"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CONSENT_CHANGED_EVENT, hasConsent } from "@/lib/tracking/consent";

declare global {
  interface Window {
    gtag: (...args: [string, ...unknown[]]) => void;
    dataLayer: unknown[];
  }
}

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

interface GoogleAnalyticsProps {
  nonce?: string;
}

export function GoogleAnalytics({ nonce }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  const [consentGiven, setConsentGiven] = useState(false);

  useEffect(() => {
    setConsentGiven(hasConsent());

    const handleConsentChange = () => {
      setConsentGiven(hasConsent());
    };

    window.addEventListener(CONSENT_CHANGED_EVENT, handleConsentChange);
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, handleConsentChange);
    };
  }, []);

  useEffect(() => {
    if (!consentGiven || !GA_MEASUREMENT_ID || typeof window.gtag !== "function") return;

    window.gtag("event", "page_view", {
      page_path: pathname,
    });
  }, [pathname, consentGiven]);

  if (!GA_MEASUREMENT_ID || !consentGiven) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
        nonce={nonce}
      />
      <Script
        id="google-analytics-init"
        strategy="afterInteractive"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />
    </>
  );
}
