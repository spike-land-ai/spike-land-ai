"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";
import type { ArenaLeaderboardEntry } from "@/lib/arena/types";
import Image from "next/image";
import Link from "next/link";

export function Leaderboard() {
  const [entries, setEntries] = useState<ArenaLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/connect/leaderboard?limit=50")
      .then(r => r.json())
      .then(data => setEntries(Array.isArray(data) ? data : []))
      .catch(err => console.error("[Leaderboard] Failed to load data:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link
        href="/connect"
        className="text-sm text-zinc-500 hover:text-zinc-400 mb-4 inline-block"
      >
        &larr; Back to Arena
      </Link>

      <h1 className="text-3xl font-bold text-zinc-100 mb-2">Leaderboard</h1>
      <p className="text-zinc-400 mb-8">
        ELO rankings for the AI Prompt Arena.
      </p>

      {loading
        ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="h-12 bg-zinc-900 rounded animate-pulse"
              />
            ))}
          </div>
        )
        : entries.length === 0
        ? (
          <div className="text-center py-16 text-zinc-500">
            <p className="text-lg mb-2">No rankings yet.</p>
            <p className="text-sm">
              Submit prompts to challenges to start competing!
            </p>
          </div>
        )
        : (
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 w-16">Rank</TableHead>
                  <TableHead className="text-zinc-400">Player</TableHead>
                  <TableHead className="text-zinc-400 text-right">
                    ELO
                  </TableHead>
                  <TableHead className="text-zinc-400 text-right">
                    W/L/D
                  </TableHead>
                  <TableHead className="text-zinc-400 text-right">
                    Streak
                  </TableHead>
                  <TableHead className="text-zinc-400 text-right">
                    Best
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => (
                  <TableRow
                    key={entry.userId}
                    className="border-zinc-800 hover:bg-zinc-900/50"
                  >
                    <TableCell className="font-mono text-zinc-500">
                      #{entry.rank}
                    </TableCell>
                    <TableCell className="text-zinc-200">
                      <div className="flex items-center gap-2">
                        {entry.userImage && (
                          <Image
                            src={entry.userImage}
                            alt=""
                            width={24}
                            height={24}
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        {entry.userName || "Anonymous"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-zinc-100">
                      {entry.elo}
                    </TableCell>
                    <TableCell className="text-right font-mono text-zinc-400">
                      {entry.wins}/{entry.losses}/{entry.draws}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span
                        className={entry.streak > 0
                          ? "text-green-400"
                          : entry.streak < 0
                          ? "text-red-400"
                          : "text-zinc-500"}
                      >
                        {entry.streak > 0 ? `+${entry.streak}` : entry.streak}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-zinc-400">
                      {entry.bestElo}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
    </div>
  );
}
