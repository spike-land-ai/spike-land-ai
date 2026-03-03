"use client";

import { useEffect, useState } from "react";
import { PERSONAS } from "@/lib/onboarding/personas";

interface PersonaVoteAgg {
  total_readers: number;
  votes_yes: number;
  votes_no: number;
  engagement_rate: number;
}

interface PollAnalyticsDashboardProps {
  slug: string;
}

const personaNameMap = new Map(PERSONAS.map(p => [p.slug, p.name]));

export function PollAnalyticsDashboard({ slug }: PollAnalyticsDashboardProps) {
  const [data, setData] = useState<Record<string, PersonaVoteAgg> | null>(null);
  const [loading, setLoading] = useState(true);

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
          const typed = json as { personas: Record<string, PersonaVoteAgg>; };
          if (!cancelled) {
            setData(typed.personas);
            setLoading(false);
          }
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    fetchResults();
    const interval = setInterval(fetchResults, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [slug]);

  if (loading) {
    return <div className="w-full h-64 bg-muted animate-pulse rounded-xl my-8" />;
  }

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="my-8 rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        No poll data yet. Be the first to vote!
      </div>
    );
  }

  const sortedEntries = Object.entries(data).sort(
    ([, a], [, b]) => b.total_readers - a.total_readers,
  );

  const maxVotes = Math.max(...sortedEntries.map(([, v]) => v.total_readers));

  return (
    <div className="my-8 rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-foreground mb-6">
        Poll Results by Persona
      </h3>

      <div className="space-y-4">
        {sortedEntries.map(([personaSlug, agg]) => {
          const total = agg.votes_yes + agg.votes_no;
          const yesPct = total > 0
            ? Math.round((agg.votes_yes / total) * 100)
            : 0;
          const noPct = 100 - yesPct;
          const relativeWidth = maxVotes > 0
            ? Math.round((total / maxVotes) * 100)
            : 0;
          const name = personaSlug === "unknown"
            ? "General Reader"
            : (personaNameMap.get(personaSlug) ?? personaSlug);

          return (
            <div key={personaSlug}>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm font-medium text-foreground">
                  {name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {total} vote{total !== 1 ? "s" : ""}
                </span>
              </div>
              <div
                className="relative"
                style={{ width: `${Math.max(relativeWidth, 20)}%` }}
              >
                <div className="flex h-6 w-full overflow-hidden rounded-full bg-muted">
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
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Yes
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500" /> No
        </span>
        <span className="ml-auto">Auto-refreshes every 30s</span>
      </div>
    </div>
  );
}
