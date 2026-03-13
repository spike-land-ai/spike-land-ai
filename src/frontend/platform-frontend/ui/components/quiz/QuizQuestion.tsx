/**
 * QuizQuestion — renders a single binary question with two large option buttons.
 * Animates in from the right on each new question via CSS animation classes.
 */

import { useId } from "react";
import { cn } from "../../../styling/cn";

interface QuizQuestionProps {
  questionText: string;
  yesLabel: string;
  noLabel: string;
  step: number;
  totalSteps: number;
  isLoading: boolean;
  onAnswer: (value: boolean) => void;
}

export function QuizQuestion({
  questionText,
  yesLabel,
  noLabel,
  step,
  totalSteps,
  isLoading,
  onAnswer,
}: QuizQuestionProps) {
  const questionId = useId();

  return (
    <div
      className="animate-in slide-in-from-right-8 fade-in duration-400 space-y-10"
      aria-labelledby={questionId}
    >
      {/* Progress bar */}
      <div
        className="space-y-2"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Question ${step} of ${totalSteps}`}
      >
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <span>Question {step} of {totalSteps}</span>
          <span>{Math.round(((step - 1) / totalSteps) * 100)}% done</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${((step - 1) / totalSteps) * 100}%` }}
          />
        </div>
        {/* Step dots */}
        <div className="flex items-center gap-2 pt-1" aria-hidden="true">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 rounded-full transition-all duration-500",
                i + 1 < step
                  ? "w-6 bg-primary"
                  : i + 1 === step
                    ? "w-4 bg-primary shadow-[0_0_8px_var(--primary)]"
                    : "w-2 bg-muted",
              )}
            />
          ))}
        </div>
      </div>

      {/* Question text */}
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          beUniq Quiz
        </p>
        <h2
          id={questionId}
          className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight"
        >
          {questionText}
        </h2>
      </div>

      {/* Option buttons */}
      <div
        className="grid gap-4 sm:grid-cols-2"
        role="group"
        aria-label="Choose your answer"
      >
        <OptionButton
          label={yesLabel}
          sublabel="Yes"
          onClick={() => onAnswer(true)}
          disabled={isLoading}
          variant="yes"
        />
        <OptionButton
          label={noLabel}
          sublabel="No"
          onClick={() => onAnswer(false)}
          disabled={isLoading}
          variant="no"
        />
      </div>
    </div>
  );
}

// ── Option button ─────────────────────────────────────────────────────────────

interface OptionButtonProps {
  label: string;
  sublabel: string;
  onClick: () => void;
  disabled: boolean;
  variant: "yes" | "no";
}

function OptionButton({ label, sublabel, onClick, disabled, variant }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative flex flex-col items-start gap-1 rounded-2xl border-2 p-6 text-left transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "yes"
          ? "border-border bg-card hover:border-primary hover:bg-primary/5 hover:shadow-[0_8px_32px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
          : "border-border bg-card hover:border-foreground/30 hover:bg-muted/60 hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)]",
      )}
    >
      {/* Badge */}
      <span
        className={cn(
          "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest transition-colors",
          variant === "yes"
            ? "border-primary/30 text-primary group-hover:bg-primary/10"
            : "border-border text-muted-foreground group-hover:border-foreground/20",
        )}
      >
        {sublabel}
      </span>

      {/* Label */}
      <span
        className={cn(
          "mt-1 text-lg font-bold leading-snug tracking-tight transition-colors",
          variant === "yes"
            ? "text-foreground group-hover:text-primary"
            : "text-foreground",
        )}
      >
        {label}
      </span>

      {/* Arrow icon */}
      <span
        className="absolute right-5 top-1/2 -translate-y-1/2 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1"
        aria-hidden="true"
      >
        <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  );
}
