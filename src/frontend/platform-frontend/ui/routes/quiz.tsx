/**
 * /quiz — BeUniq persona quiz page
 *
 * Full-page quiz experience.
 *   idle       → landing screen with "Start" CTA
 *   loading    → spinner
 *   question   → one question at a time, binary choice
 *   revealing  → persona has been determined, transition to reveal
 *   done       → <PersonaReveal> with apps grid + CTA
 *   error      → inline error with retry
 */

import { useEffect } from "react";
import { useSearch } from "@tanstack/react-router";
import { QuizQuestion } from "../components/quiz/QuizQuestion";
import { PersonaReveal } from "../components/quiz/PersonaReveal";
import { useQuiz, loadStoredPersona } from "../components/quiz/useQuiz";

const TOTAL_STEPS = 4;

export function QuizPage() {
  const { state, start, answer, reset } = useQuiz();

  // Support deep-linking to a specific persona result: /quiz?persona=ai-indie
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;
  const personaSlug = search["persona"];

  useEffect(() => {
    // If a persona slug is in the URL and we have no persona yet, check localStorage.
    // This handles the "share result" link use-case — if the user already has a stored
    // persona we just show it; otherwise show a landing that prompts them to take the quiz.
    if (personaSlug) {
      const stored = loadStoredPersona();
      if (stored?.slug !== personaSlug) {
        // Don't auto-start; let the user choose to take the quiz themselves
      }
    }
  }, [personaSlug]);

  return (
    <div className="rubik-container rubik-page flex min-h-[calc(100dvh-4.5rem)] flex-col items-center justify-center py-12">
      <div className="w-full max-w-xl">
        {state.phase === "idle" && <QuizLanding onStart={start} />}

        {state.phase === "loading" && <QuizLoading />}

        {state.phase === "question" && state.currentQuestion && (
          <QuizQuestion
            questionText={state.currentQuestion.text}
            yesLabel={state.currentQuestion.yes_label}
            noLabel={state.currentQuestion.no_label}
            step={state.answersCount + 1}
            totalSteps={TOTAL_STEPS}
            isLoading={false}
            onAnswer={answer}
          />
        )}

        {(state.phase === "revealing" || state.phase === "done") && state.persona && (
          <PersonaReveal persona={state.persona} onRetake={reset} />
        )}

        {state.phase === "error" && (
          <QuizError message={state.errorMessage ?? "Something went wrong"} onRetry={start} />
        )}
      </div>
    </div>
  );
}

// ── Landing screen ────────────────────────────────────────────────────────────

function QuizLanding({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-10 text-center animate-in fade-in duration-500">
      {/* Icon */}
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-4xl shadow-inner">
        ✨
      </div>

      {/* Heading */}
      <div className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          beUniq by spike.land
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          Who are you?
        </h1>
        <p className="mx-auto max-w-sm text-base text-muted-foreground leading-relaxed">
          Answer 4 quick questions and we'll match you to a persona — then recommend
          the apps that fit you best.
        </p>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-center gap-8 text-center">
        {[
          { value: "4", label: "questions" },
          { value: "16", label: "personas" },
          { value: "< 1 min", label: "to complete" },
        ].map((stat) => (
          <div key={stat.label}>
            <p className="text-2xl font-extrabold tracking-tight text-foreground">{stat.value}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onStart}
        className="mx-auto flex items-center gap-2 rounded-2xl bg-foreground px-10 py-4 text-base font-bold text-background shadow-[0_16px_40px_color-mix(in_srgb,var(--fg)_14%,transparent)] transition-all duration-200 hover:bg-foreground/90 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Start the quiz
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <p className="text-xs text-muted-foreground">
        No sign-up required. Your result is saved locally.
      </p>
    </div>
  );
}

// ── Loading ───────────────────────────────────────────────────────────────────

function QuizLoading() {
  return (
    <div
      className="flex flex-col items-center gap-6 py-24 animate-in fade-in duration-300"
      role="status"
      aria-label="Loading question"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" aria-hidden="true" />
      <p className="text-sm font-medium text-muted-foreground">Just a moment…</p>
    </div>
  );
}

// ── Error ─────────────────────────────────────────────────────────────────────

function QuizError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center animate-in fade-in duration-300">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-2xl">
        ⚠
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-xl border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Try again
      </button>
    </div>
  );
}
