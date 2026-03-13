/**
 * QuizPersonaBanner — dismissible onboarding prompt for first-time users.
 *
 * Shown when no persona is stored in localStorage. Links to /quiz.
 * Disappears permanently once the user clicks "Dismiss" or completes the quiz.
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { loadStoredPersona } from "./useQuiz";

const BANNER_DISMISSED_KEY = "spike_beuniq_banner_dismissed";

export function QuizPersonaBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hasDismissed = localStorage.getItem(BANNER_DISMISSED_KEY) === "1";
    const hasPersona = loadStoredPersona() !== null;
    if (!hasDismissed && !hasPersona) {
      setVisible(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(BANNER_DISMISSED_KEY, "1");
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="banner"
      className="relative flex items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-card px-5 py-4 shadow-sm animate-in slide-in-from-top-2 fade-in duration-400"
    >
      {/* Left: icon + copy */}
      <div className="flex min-w-0 items-center gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl"
          aria-hidden="true"
        >
          ✨
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">
            Discover your spike.land persona
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            4 quick questions — get app recommendations tailored to you.
          </p>
        </div>
      </div>

      {/* Right: CTA + close */}
      <div className="flex shrink-0 items-center gap-2">
        <Link
          to="/quiz"
          className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={dismiss}
        >
          Take the quiz
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss persona quiz banner"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
