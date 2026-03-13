/**
 * useChessGame
 *
 * Manages all server-side chess state for a single active game.
 * Polls for updates and provides move, resign, draw offer/accept/decline actions.
 *
 * NOTE: In a production setup this would use WebSockets via a Durable Object.
 * For now it uses polling with exponential backoff for simplicity.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import type { GameState, LegalMove, TimeControl } from "./chess-types";
import { getAllLegalMovesFromFen } from "./chess-logic";

const POLL_INTERVAL_MS = 2_000;

// ─── Local game state ────────────────────────────────────────────────────────

export interface ChessGameHookState {
  game: GameState | null;
  legalMoves: LegalMove[];
  isLoading: boolean;
  error: string | null;
  makeMove: (from: string, to: string, promotion?: string) => Promise<void>;
  resign: () => Promise<void>;
  offerDraw: () => Promise<void>;
  acceptDraw: () => Promise<void>;
  declineDraw: () => Promise<void>;
  clearError: () => void;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }
  return res.json() as Promise<T>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useChessGame(gameId: string | null, myPlayerId: string | null): ChessGameHookState {
  const [game, setGame] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchGame = useCallback(async () => {
    if (!gameId) return;
    try {
      const data = await apiFetch<GameState>(`/api/chess/games/${gameId}`);
      setGame(data);
    } catch (err) {
      // Silent failure during polling — don't overwrite existing state
    }
  }, [gameId]);

  // Initial load
  useEffect(() => {
    if (!gameId) {
      setGame(null);
      return;
    }
    setIsLoading(true);
    void apiFetch<GameState>(`/api/chess/games/${gameId}`)
      .then((data) => {
        setGame(data);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load game");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [gameId]);

  // Polling — only while game is active
  useEffect(() => {
    const isActive =
      game?.status === "ACTIVE" ||
      game?.status === "CHECK" ||
      game?.status === "WAITING" ||
      game?.status === "DRAW_OFFERED";

    if (!gameId || !isActive) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    pollingRef.current = setInterval(() => void fetchGame(), POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [gameId, game?.status, fetchGame]);

  // Derive legal moves from current FEN client-side
  const legalMoves: LegalMove[] = game ? getAllLegalMovesFromFen(game.fen) : [];

  const makeMove = useCallback(
    async (from: string, to: string, promotion?: string) => {
      if (!gameId || !myPlayerId) return;
      try {
        const body: Record<string, string> = { playerId: myPlayerId, from, to };
        if (promotion) body["promotion"] = promotion;
        const updated = await apiFetch<GameState>(`/api/chess/games/${gameId}/move`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        setGame(updated);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to make move");
      }
    },
    [gameId, myPlayerId],
  );

  const resign = useCallback(async () => {
    if (!gameId || !myPlayerId) return;
    try {
      const updated = await apiFetch<GameState>(`/api/chess/games/${gameId}/resign`, {
        method: "POST",
        body: JSON.stringify({ playerId: myPlayerId }),
      });
      setGame(updated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resign");
    }
  }, [gameId, myPlayerId]);

  const offerDraw = useCallback(async () => {
    if (!gameId || !myPlayerId) return;
    try {
      await apiFetch(`/api/chess/games/${gameId}/offer-draw`, {
        method: "POST",
        body: JSON.stringify({ playerId: myPlayerId }),
      });
      await fetchGame();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to offer draw");
    }
  }, [gameId, myPlayerId, fetchGame]);

  const acceptDraw = useCallback(async () => {
    if (!gameId || !myPlayerId) return;
    try {
      const updated = await apiFetch<GameState>(`/api/chess/games/${gameId}/accept-draw`, {
        method: "POST",
        body: JSON.stringify({ playerId: myPlayerId }),
      });
      setGame(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept draw");
    }
  }, [gameId, myPlayerId]);

  const declineDraw = useCallback(async () => {
    if (!gameId || !myPlayerId) return;
    try {
      await apiFetch(`/api/chess/games/${gameId}/decline-draw`, {
        method: "POST",
        body: JSON.stringify({ playerId: myPlayerId }),
      });
      await fetchGame();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decline draw");
    }
  }, [gameId, myPlayerId, fetchGame]);

  const clearError = useCallback(() => setError(null), []);

  return {
    game,
    legalMoves,
    isLoading,
    error,
    makeMove,
    resign,
    offerDraw,
    acceptDraw,
    declineDraw,
    clearError,
  };
}

// ─── Leaderboard hook ────────────────────────────────────────────────────────

import type { ChessPlayer } from "./chess-types";

export interface LeaderboardHookState {
  players: ChessPlayer[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useLeaderboard(): LeaderboardHookState {
  const [players, setPlayers] = useState<ChessPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    void apiFetch<{ players: ChessPlayer[] }>("/api/chess/leaderboard")
      .then((data) => {
        setPlayers(data.players);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load leaderboard");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { players, isLoading, error, refresh: load };
}

// ─── My games hook ───────────────────────────────────────────────────────────

export interface MyGamesHookState {
  games: GameState[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useMyGames(playerId: string | null): MyGamesHookState {
  const [games, setGames] = useState<GameState[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!playerId) return;
    setIsLoading(true);
    void apiFetch<{ games: GameState[] }>(`/api/chess/players/${playerId}/games`)
      .then((data) => {
        setGames(data.games);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load games");
      })
      .finally(() => setIsLoading(false));
  }, [playerId]);

  useEffect(() => {
    load();
  }, [load]);

  return { games, isLoading, error, refresh: load };
}

// ─── Challenge hooks ─────────────────────────────────────────────────────────

import type { Challenge } from "./chess-types";

export interface ChallengesHookState {
  challenges: Challenge[];
  isLoading: boolean;
  error: string | null;
  acceptChallenge: (challengeId: string) => Promise<void>;
  declineChallenge: (challengeId: string) => Promise<void>;
  refresh: () => void;
}

export function useChallenges(playerId: string | null): ChallengesHookState {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!playerId) return;
    setIsLoading(true);
    void apiFetch<{ challenges: Challenge[] }>(`/api/chess/players/${playerId}/challenges`)
      .then((data) => {
        setChallenges(data.challenges.filter((c) => c.status === "PENDING"));
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load challenges");
      })
      .finally(() => setIsLoading(false));
  }, [playerId]);

  useEffect(() => {
    load();
  }, [load]);

  const acceptChallenge = useCallback(
    async (challengeId: string) => {
      if (!playerId) return;
      await apiFetch(`/api/chess/challenges/${challengeId}/accept`, {
        method: "POST",
        body: JSON.stringify({ playerId }),
      });
      load();
    },
    [playerId, load],
  );

  const declineChallenge = useCallback(
    async (challengeId: string) => {
      if (!playerId) return;
      await apiFetch(`/api/chess/challenges/${challengeId}/decline`, {
        method: "POST",
        body: JSON.stringify({ playerId }),
      });
      load();
    },
    [playerId, load],
  );

  return { challenges, isLoading, error, acceptChallenge, declineChallenge, refresh: load };
}
