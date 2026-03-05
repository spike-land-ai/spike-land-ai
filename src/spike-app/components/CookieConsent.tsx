import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useCookieConsent } from "@/hooks/useCookieConsent";

export function CookieConsent() {
  const { consentGiven, accept, reject } = useCookieConsent();
  const [visible, setVisible] = useState(false);

  // Delay render slightly to allow fade-in animation
  useEffect(() => {
    if (consentGiven === null) {
      const id = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(id);
    }
  }, [consentGiven]);

  if (consentGiven !== null) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.2s ease-in-out",
      }}
    >
      <div className="bg-card rounded-2xl border border-border shadow-2xl p-8 max-w-md mx-4">
        <h2
          id="cookie-consent-title"
          className="text-lg font-bold text-foreground"
        >
          Cookie Preferences
        </h2>
        <p className="text-sm text-muted-foreground mt-3">
          We use cookies to enhance your experience. Essential cookies are
          required for the platform to function. Analytics cookies help us
          improve the service.
        </p>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={accept}
            className="bg-foreground text-background rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Accept All
          </button>
          <button
            type="button"
            onClick={reject}
            className="border border-border rounded-lg px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
          >
            Reject Non-Essential
          </button>
        </div>
        <Link
          to="/privacy"
          className="text-xs text-muted-foreground underline mt-4 block text-center"
        >
          Learn more
        </Link>
      </div>
    </div>
  );
}
