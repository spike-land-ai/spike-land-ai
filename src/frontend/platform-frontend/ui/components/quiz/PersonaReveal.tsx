/**
 * PersonaReveal — dramatic reveal of the user's persona after completing the quiz.
 *
 * Shows persona name, description, hero text, recommended apps grid with install
 * buttons, a CTA to the store, a retake option, and a share-by-link button.
 */

import { useCallback, useState } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "../../../styling/cn";
import type { QuizPersona } from "./useQuiz";

// Map persona slugs to display emoji for visual flair
const PERSONA_EMOJI: Record<string, string> = {
  "ai-indie": "🤖",
  "classic-indie": "🛠",
  "agency-dev": "🏢",
  "in-house-dev": "💼",
  "ml-engineer": "🧠",
  "ai-hobbyist": "🔬",
  "enterprise-devops": "🏗",
  "startup-devops": "⚡",
  "technical-founder": "🚀",
  "nontechnical-founder": "💡",
  "growth-leader": "📈",
  "ops-leader": "⚙",
  "content-creator": "🎨",
  "hobbyist-creator": "🎭",
  "social-gamer": "🎮",
  "solo-explorer": "🧭",
};

function getPersonaEmoji(slug: string): string {
  return PERSONA_EMOJI[slug] ?? "✨";
}

// Pretty-print app slug → display name
function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface PersonaRevealProps {
  persona: QuizPersona;
  onRetake: () => void;
}

export function PersonaReveal({ persona, onRetake }: PersonaRevealProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/quiz?persona=${persona.slug}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {
        // Clipboard API unavailable — silently ignore
      });
  }, [persona.slug]);

  const emoji = getPersonaEmoji(persona.slug);

  return (
    <div className="space-y-10 animate-in zoom-in-95 fade-in duration-500">
      {/* ── Persona hero ──────────────────────────────────────── */}
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-8 text-center shadow-[0_20px_60px_color-mix(in_srgb,var(--primary)_8%,transparent)]">
        {/* Emoji badge */}
        <div
          className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/10 text-5xl shadow-inner animate-in zoom-in-50 duration-700"
          aria-hidden="true"
        >
          {emoji}
        </div>

        {/* Eyebrow */}
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Your persona
        </p>

        {/* Name */}
        <h2 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          {persona.name}
        </h2>

        {/* Description */}
        <p className="mx-auto mt-3 max-w-sm text-base text-muted-foreground leading-relaxed">
          {persona.description}
        </p>

        {/* Hero text */}
        <p className="mx-auto mt-4 max-w-md text-lg font-semibold text-foreground leading-snug">
          {persona.hero_text}
        </p>
      </div>

      {/* ── Recommended apps ──────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Recommended for you</h3>
          <Link
            to="/apps"
            search={{ persona: persona.slug } as Record<string, string>}
            className="rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            See all
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {persona.recommended_app_slugs.map((slug) => (
            <AppCard key={slug} slug={slug} />
          ))}
        </div>
      </div>

      {/* ── Primary CTA ───────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          to={persona.cta.href as "/apps"}
          className={cn(
            "flex-1 rounded-2xl border-2 border-transparent bg-foreground px-6 py-4 text-center text-base font-bold text-background",
            "transition-all duration-200 hover:bg-foreground/90 hover:shadow-[0_12px_40px_color-mix(in_srgb,var(--fg)_18%,transparent)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
        >
          {persona.cta.label}
        </Link>

        {/* Share button */}
        <button
          type="button"
          onClick={handleShare}
          className={cn(
            "flex items-center justify-center gap-2 rounded-2xl border border-border px-5 py-4 text-sm font-semibold text-muted-foreground",
            "transition-all duration-200 hover:border-primary/30 hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
        >
          {copied ? (
            <>
              <CheckIcon className="h-4 w-4 text-green-500" />
              Copied!
            </>
          ) : (
            <>
              <ShareIcon className="h-4 w-4" />
              Share result
            </>
          )}
        </button>
      </div>

      {/* ── Retake link ───────────────────────────────────────── */}
      <div className="text-center">
        <button
          type="button"
          onClick={onRetake}
          className="text-sm font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Retake quiz
        </button>
      </div>
    </div>
  );
}

// ── App card ──────────────────────────────────────────────────────────────────

function AppCard({ slug }: { slug: string }) {
  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/20 hover:shadow-sm">
      {/* Icon placeholder */}
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
        {slug.charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{slugToTitle(slug)}</p>
        <p className="truncate text-xs text-muted-foreground">{slug}</p>
      </div>

      <Link
        to="/apps/$appSlug"
        params={{ appSlug: slug }}
        className={cn(
          "shrink-0 rounded-xl border border-border bg-background px-3.5 py-1.5 text-xs font-semibold text-foreground",
          "transition-colors duration-150 hover:border-primary/30 hover:bg-primary/5 hover:text-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-label={`Open ${slugToTitle(slug)}`}
      >
        Open
      </Link>
    </div>
  );
}

// ── Inline icons (avoid extra deps) ──────────────────────────────────────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
      />
    </svg>
  );
}
