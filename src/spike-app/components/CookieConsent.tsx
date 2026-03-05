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
      className="fixed bottom-0 inset-x-0 z-50"
      role="region"
      aria-label="Cookie consent"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.2s ease-in-out",
      }}
    >
      <div className="bg-card border-t border-border shadow-2xl px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 max-w-screen-xl mx-auto">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">
            We use cookies to enhance your experience. Essential cookies are
            required for the platform to function. Analytics cookies help us
            improve the service.{" "}
            <Link
              to="/privacy"
              className="text-xs text-muted-foreground underline"
            >
              Learn more
            </Link>
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
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
      </div>
    </div>
  );
}
