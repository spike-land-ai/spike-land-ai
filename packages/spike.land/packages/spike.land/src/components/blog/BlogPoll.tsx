"use client";

import { useCallback, useEffect, useState } from "react";

const PERSONA_QUESTIONS: Record<string, string> = {
  "ai-indie": "Could A/B testing replace your gut instinct on what ships?",
  "classic-indie": "Is A/B testing worth the overhead when you're shipping solo?",
  "agency-dev": "Do your clients care about A/B test results, or just conversions?",
  "in-house-dev": "Does your team actually act on A/B test results?",
  "ml-engineer": "Is A/B testing just a crude Bayesian bandit with extra steps?",
  "ai-hobbyist": "Would you A/B test a side project you're building for fun?",
  "enterprise-devops": "Is your A/B testing infrastructure worth its operational cost?",
  "startup-devops": "Should startups A/B test before they have enough traffic?",
  "technical-founder": "Is A/B testing worth the engineering cost at your stage?",
  "nontechnical-founder": "Should you let data pick your messaging, or trust your vision?",
  "growth-leader": "Do A/B tests accelerate growth, or just confirm what you already know?",
  "ops-leader": "Is A/B testing adding clarity or complexity to your operations?",
  "content-creator": "Would you A/B test your own creative voice?",
  "hobbyist-creator": "Does A/B testing kill the magic of creating for fun?",
  "social-gamer": "Would you A/B test game mechanics to optimize fun?",
  "solo-explorer": "Is it worth A/B testing something only you will use?",
};

const DEFAULT_QUESTION = "Do you believe in A/B tests?";

function getPersonaCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)spike-persona=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

interface PollAnalyticsDashboardProps {
  slug: string;
}

function PollAnalyticsDashboardInline({ slug }: PollAnalyticsDashboardProps) {
  const [data, setData] = useState<
    Record<string, { votes_yes: number; votes_no: number; }> | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchResults() {
      try {
        const res = await fetch(
          `/api/blog/poll?slug=${encodeURIComponent(slug)}`,
        );
        if (!res.ok) return;
        const json: unknown = await res.json();
        if (typeof json === "object" && json !== null && "personas" in json) {
          const typed = json as {
            personas: Record<string, { votes_yes: number; votes_no: number; }>;
          };
          if (!cancelled) setData(typed.personas);
        }
      } catch {
        // silently fail
      }
    }
    fetchResults();
    const interval = setInterval(fetchResults, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [slug]);

  if (!data || Object.keys(data).length === 0) {
    return (
      <p className="text-sm text-muted-foreground mt-4">
        Be the first to vote!
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <h4 className="text-sm font-semibold text-foreground">
        Results by persona
      </h4>
      {Object.entries(data).map(([persona, counts]) => {
        const total = counts.votes_yes + counts.votes_no;
        const yesPct = total > 0
          ? Math.round((counts.votes_yes / total) * 100)
          : 0;
        const noPct = 100 - yesPct;
        return (
          <div key={persona} className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{persona === "unknown" ? "General Reader" : persona}</span>
              <span>{total} vote{total !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex h-5 w-full overflow-hidden rounded-full bg-muted">
              {yesPct > 0 && (
                <div
                  className="flex items-center justify-center bg-emerald-500 text-[10px] font-medium text-white transition-all duration-500"
                  style={{ width: `${yesPct}%` }}
                >
                  {yesPct > 15 ? `${yesPct}%` : ""}
                </div>
              )}
              {noPct > 0 && (
                <div
                  className="flex items-center justify-center bg-rose-500 text-[10px] font-medium text-white transition-all duration-500"
                  style={{ width: `${noPct}%` }}
                >
                  {noPct > 15 ? `${noPct}%` : ""}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div className="flex gap-4 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Yes
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500" /> No
        </span>
      </div>
    </div>
  );
}

interface BlogPollProps {
  slug: string;
}

export function BlogPoll({ slug }: BlogPollProps) {
  const [voted, setVoted] = useState<"yes" | "no" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [personaSlug, setPersonaSlug] = useState<string | null>(null);

  useEffect(() => {
    setPersonaSlug(getPersonaCookie());
  }, []);

  const question = personaSlug
    ? PERSONA_QUESTIONS[personaSlug] ?? DEFAULT_QUESTION
    : DEFAULT_QUESTION;

  const handleVote = useCallback(async (answer: "yes" | "no") => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/blog/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleSlug: slug,
          personaSlug: personaSlug ?? "unknown",
          questionVariant: question,
          answer,
        }),
      });
      if (res.ok) {
        setVoted(answer);
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  }, [slug, personaSlug, question]);

  return (
    <div className="my-8 rounded-xl border border-border bg-card p-6 shadow-sm">
      <p className="text-lg font-semibold text-foreground mb-4">{question}</p>

      {voted === null
        ? (
          <div className="flex gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleVote("yes")}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              Yes
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleVote("no")}
              className="rounded-lg bg-rose-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
            >
              No
            </button>
          </div>
        )
        : (
          <div>
            <p className="text-sm text-muted-foreground">
              You voted{" "}
              <span className="font-semibold">
                {voted === "yes" ? "Yes" : "No"}
              </span>. Thanks for sharing!
            </p>
            <PollAnalyticsDashboardInline slug={slug} />
          </div>
        )}
    </div>
  );
}
