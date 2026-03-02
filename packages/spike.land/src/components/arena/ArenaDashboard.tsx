"use client";

import { useEffect, useState } from "react";
import { ChallengeCard } from "./ChallengeCard";
import Link from "next/link";
import type { ArenaLeaderboardEntry } from "@/lib/arena/types";

interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  _count: { submissions: number };
}

export function ArenaDashboard() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [leaderboard, setLeaderboard] = useState<ArenaLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/connect/challenges").then((r) => r.json()),
      fetch("/api/connect/leaderboard?limit=10").then((r) => r.json()),
    ])
      .then(([c, l]) => {
        setChallenges(Array.isArray(c) ? c : []);
        setLeaderboard(Array.isArray(l) ? l : []);
      })
      .catch((err) => console.error("[ArenaDashboard] Failed to load data:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">AI Prompt Arena</h1>
        <p className="text-zinc-400">
          Write single-shot prompts. Generate React apps. Climb the leaderboard.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Challenges Grid */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-zinc-200">Open Challenges</h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-40 bg-zinc-900 border border-zinc-800 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : challenges.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <p className="text-lg mb-2">No open challenges yet.</p>
              <p className="text-sm">Check back soon or create one via the API.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {challenges.map((c) => (
                <ChallengeCard
                  key={c.id}
                  id={c.id}
                  title={c.title}
                  description={c.description}
                  category={c.category}
                  difficulty={c.difficulty}
                  submissionCount={c._count.submissions}
                />
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-zinc-200">Top Players</h2>
              <Link
                href="/connect/leaderboard"
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                View all
              </Link>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 bg-zinc-800 rounded animate-pulse" />
                  ))}
                </div>
              ) : leaderboard.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">No rankings yet</p>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((entry) => (
                    <div key={entry.userId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 w-5 text-right">#{entry.rank}</span>
                        <span className="text-zinc-200 truncate max-w-[120px]">
                          {entry.userName || "Anonymous"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-300 font-mono">{entry.elo}</span>
                        {entry.streak > 0 && (
                          <span className="text-green-400 text-xs">+{entry.streak}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
