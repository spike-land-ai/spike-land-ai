/**
 * Leaderboard
 *
 * - Ranked player list with ELO, wins/losses, streak
 * - Search by name
 * - Click row to view profile or send a challenge
 */
import { useState, useMemo, useCallback } from "react";
import type { ChessPlayer } from "./chess-types";

// ─── Streak Badge ────────────────────────────────────────────────────────────

function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) return null;
  const isWin = streak > 0;
  const count = Math.abs(streak);
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold ${
        isWin
          ? "bg-success/10 text-success-foreground"
          : "bg-destructive/10 text-destructive-foreground"
      }`}
      aria-label={`${isWin ? "Win" : "Loss"} streak of ${count}`}
    >
      {isWin ? "+" : "-"}{count}
    </span>
  );
}

// ─── Rank Badge ──────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const medals: Record<number, string> = { 1: "gold", 2: "silver", 3: "bronze" };
  const medal = medals[rank];

  if (rank === 1) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400/20 text-xs font-bold text-yellow-600 dark:text-yellow-400">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-300/30 text-xs font-bold text-slate-500 dark:text-slate-400">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-400/20 text-xs font-bold text-orange-600 dark:text-orange-400">
        3
      </span>
    );
  }

  return (
    <span className="inline-flex h-6 w-6 items-center justify-center text-xs text-muted-foreground tabular-nums">
      {rank}
    </span>
  );
}

// ─── Player Row ──────────────────────────────────────────────────────────────

interface PlayerRowProps {
  player: ChessPlayer;
  rank: number;
  isMe: boolean;
  onChallenge: (player: ChessPlayer) => void;
  onViewProfile: (player: ChessPlayer) => void;
}

function PlayerRow({ player, rank, isMe, onChallenge, onViewProfile }: PlayerRowProps) {
  const totalGames = player.wins + player.losses + player.draws;
  const winRate = totalGames > 0 ? Math.round((player.wins / totalGames) * 100) : 0;

  return (
    <tr
      className={`group border-b border-border transition-colors last:border-0 hover:bg-muted/40 ${
        isMe ? "bg-primary/5" : ""
      }`}
    >
      {/* Rank */}
      <td className="py-3 pl-3 pr-2 text-center">
        <RankBadge rank={rank} />
      </td>

      {/* Player */}
      <td className="py-3 pr-2">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
            aria-hidden="true"
          >
            {player.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`truncate text-sm font-semibold ${isMe ? "text-primary" : "text-foreground"}`}
              >
                {player.name}
              </span>
              {isMe && (
                <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.6rem] font-semibold text-primary">
                  You
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${player.isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`}
                aria-label={player.isOnline ? "Online" : "Offline"}
              />
              <span>{player.isOnline ? "Online" : "Offline"}</span>
            </div>
          </div>
        </div>
      </td>

      {/* ELO */}
      <td className="py-3 pr-3 text-right tabular-nums">
        <span className="text-sm font-bold text-foreground">{player.elo}</span>
        {player.bestElo > player.elo && (
          <span className="block text-xs text-muted-foreground">best {player.bestElo}</span>
        )}
      </td>

      {/* Win rate */}
      <td className="hidden py-3 pr-3 text-right tabular-nums sm:table-cell">
        <span className="text-sm text-foreground">{winRate}%</span>
        <span className="block text-xs text-muted-foreground">{totalGames}g</span>
      </td>

      {/* Streak */}
      <td className="hidden py-3 pr-3 sm:table-cell">
        <StreakBadge streak={player.streak} />
      </td>

      {/* Actions */}
      <td className="py-3 pr-3">
        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => onViewProfile(player)}
            className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            aria-label={`View ${player.name}'s profile`}
          >
            Profile
          </button>
          {!isMe && (
            <button
              type="button"
              onClick={() => onChallenge(player)}
              className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              aria-label={`Challenge ${player.name}`}
            >
              Challenge
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main Leaderboard ────────────────────────────────────────────────────────

export interface LeaderboardProps {
  players: ChessPlayer[];
  myPlayerId?: string | null;
  isLoading?: boolean;
  onChallenge: (player: ChessPlayer) => void;
  onViewProfile: (player: ChessPlayer) => void;
}

export function Leaderboard({
  players,
  myPlayerId,
  isLoading = false,
  onChallenge,
  onViewProfile,
}: LeaderboardProps) {
  const [search, setSearch] = useState("");

  // Sort by ELO desc and filter by search
  const filtered = useMemo(() => {
    const sorted = [...players].sort((a, b) => b.elo - a.elo);
    if (!search.trim()) return sorted;
    const q = search.trim().toLowerCase();
    return sorted.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, search]);

  // Rank is based on original sorted position, not search position
  const rankedPlayers = useMemo(() => {
    const sorted = [...players].sort((a, b) => b.elo - a.elo);
    const rankMap = new Map<string, number>();
    sorted.forEach((p, i) => rankMap.set(p.id, i + 1));
    return filtered.map((p) => ({ player: p, rank: rankMap.get(p.id) ?? 0 }));
  }, [players, filtered]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">Leaderboard</h2>
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search players..."
            className="rounded-xl border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Search players"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {search ? `No players matching "${search}"` : "No players yet"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" aria-label="Player leaderboard">
            <thead>
              <tr className="border-b border-border text-left text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pl-3 pr-2 text-center">#</th>
                <th className="py-2 pr-2">Player</th>
                <th className="py-2 pr-3 text-right">ELO</th>
                <th className="hidden py-2 pr-3 text-right sm:table-cell">Win%</th>
                <th className="hidden py-2 pr-3 sm:table-cell">Streak</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {rankedPlayers.map(({ player, rank }) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  rank={rank}
                  isMe={player.id === myPlayerId}
                  onChallenge={onChallenge}
                  onViewProfile={onViewProfile}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
