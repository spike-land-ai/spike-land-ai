import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useCookieConsent } from "../hooks/useCookieConsent";
import { Button } from "../shared/ui/button";
import { Cookie, X } from "lucide-react";
import { cn } from "../../styling/cn";

export function CookieConsent() {
  const { consentGiven, accept, reject } = useCookieConsent();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (consentGiven === null) {
      const id = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [consentGiven]);

  if (consentGiven !== null) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-[100] p-4 transition-all duration-500 ease-out transform",
        visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      )}
      role="region"
      aria-label="Cookie consent"
    >
      <div className="bg-card dark:glass-card border border-border shadow-lg rounded-2xl p-5 md:p-6 max-w-4xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Cookie className="h-6 w-6" />
        </div>
        
        <div className="flex-1 space-y-1">
          <h3 className="text-sm font-bold text-foreground">We use cookies</h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
            We use essential cookies to make our platform work, analytics cookies to understand how you use it,
            and advertising cookies to measure campaign effectiveness.
            By clicking &ldquo;Accept All&rdquo;, you agree to our use of all cookies.{" "}
            <Link
              to="/privacy"
              className="font-semibold text-primary hover:underline underline-offset-4"
            >
              Cookie Policy
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={reject}
            className="flex-1 md:flex-none rounded-xl font-bold"
          >
            Necessary Only
          </Button>
          <Button
            size="sm"
            onClick={accept}
            className="flex-1 md:flex-none rounded-xl font-bold shadow-lg shadow-primary/20"
          >
            Accept All
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={reject}
            className="hidden md:flex rounded-full text-muted-foreground/50 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
