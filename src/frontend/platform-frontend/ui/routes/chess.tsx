/**
 * Chess Arena Route — /chess
 *
 * Tabs: Play, Leaderboard, My Games, Challenges
 */
import { useState, useCallback, useMemo } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";
import { ChessBoard } from "../components/chess/ChessBoard";
import { GamePanel } from "../components/chess/GamePanel";
import { Matchmaking } from "../components/chess/Matchmaking";
import { Leaderboard } from "../components/chess/Leaderboard";
import { useChessEngine } from "../components/chess/useChessEngine";
import {
  useChessGame,
  useLeaderboard,
  useMyGames,
  useChallenges,
} from "../components/chess/useChessGame";
import type { ChessPlayer, GameState, TimeControl } from "../components/chess/chess-types";
import { TIME_CONTROL_LABELS } from "../components/chess/chess-types";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = "play" | "leaderboard" | "my-games" | "challenges";

// ─── My Games Tab ────────────────────────────────────────────────────────────

function GameStatusBadge({ status }: { status: GameState["status"] }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-success/10 text-success-foreground",
    CHECK: "bg-warning/10 text-warning-foreground",
    WAITING: "bg-info/10 text-info-foreground",
    CHECKMATE: "bg-destructive/10 text-destructive-foreground",
    STALEMATE: "bg-muted text-muted-foreground",
    DRAW: "bg-muted text-muted-foreground",
    RESIGNED: "bg-destructive/10 text-destructive-foreground",
    DRAW_OFFERED: "bg-warning/10 text-warning-foreground",
  };
  const labels: Record<string, string> = {
    ACTIVE: "Active",
    CHECK: "Check",
    WAITING: "Waiting",
    CHECKMATE: "Checkmate",
    STALEMATE: "Stalemate",
    DRAW: "Draw",
    RESIGNED: "Resigned",
    DRAW_OFFERED: "Draw offered",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {labels[status] ?? status}
    </span>
  );
}

interface MyGamesTabProps {
  playerId: string | null;
  onOpenGame: (gameId: string) => void;
}

function MyGamesTab({ playerId, onOpenGame }: MyGamesTabProps) {
  const { games, isLoading, error } = useMyGames(playerId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-3xl">
          {"\u265A"}
        </div>
        <p className="text-sm text-muted-foreground">No games yet. Start playing!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {games.map((game) => {
        const isActive = game.status === "ACTIVE" || game.status === "CHECK" || game.status === "WAITING";
        return (
          <button
            key={game.id}
            type="button"
            onClick={() => onOpenGame(game.id)}
            className="w-full rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {game.whitePlayer?.name ?? "White"} vs {game.blackPlayer?.name ?? "Black"}
                  </span>
                  <GameStatusBadge status={game.status} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{TIME_CONTROL_LABELS[game.timeControl]}</span>
                  <span>·</span>
                  <span>{game.moveCount} moves</span>
                  {game.result && (
                    <>
                      <span>·</span>
                      <span className="capitalize">{game.result}</span>
                    </>
                  )}
                </div>
              </div>
              {isActive && (
                <span className="shrink-0 rounded-xl bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Play
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Challenges Tab ───────────────────────────────────────────────────────────

interface ChallengesTabProps {
  playerId: string | null;
  onGameStarted: (gameId: string) => void;
}

function ChallengesTab({ playerId, onGameStarted }: ChallengesTabProps) {
  const { challenges, isLoading, error, acceptChallenge, declineChallenge } =
    useChallenges(playerId);

  const handleAccept = useCallback(
    async (challengeId: string, gameId: string | null) => {
      await acceptChallenge(challengeId);
      if (gameId) onGameStarted(gameId);
    },
    [acceptChallenge, onGameStarted],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (challenges.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-3xl">
          {"\u2694\uFE0F"}
        </div>
        <p className="text-sm text-muted-foreground">No pending challenges</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {challenges.map((challenge) => (
        <div
          key={challenge.id}
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {challenge.sender?.name ?? challenge.senderId}
              </p>
              <p className="text-xs text-muted-foreground">
                {TIME_CONTROL_LABELS[challenge.timeControl]}
                {challenge.senderColor && ` · Sender plays ${challenge.senderColor}`}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              Expires{" "}
              {new Date(challenge.expiresAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleAccept(challenge.id, challenge.gameId)}
              className="flex-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => void declineChallenge(challenge.id)}
              className="flex-1 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Active Game View ─────────────────────────────────────────────────────────

interface ActiveGameViewProps {
  gameId: string;
  myPlayerId: string | null;
  onClose: () => void;
  onRematch: () => void;
}

function ActiveGameView({ gameId, myPlayerId, onClose, onRematch }: ActiveGameViewProps) {
  const { game, legalMoves, error, makeMove, resign, offerDraw, acceptDraw, declineDraw, clearError } =
    useChessGame(gameId, myPlayerId);

  const myColor = useMemo(() => {
    if (!game || !myPlayerId) return null;
    if (game.whitePlayerId === myPlayerId) return "w" as const;
    if (game.blackPlayerId === myPlayerId) return "b" as const;
    return null;
  }, [game, myPlayerId]);

  const engine = useChessEngine({
    fen: game?.fen ?? INITIAL_FEN,
    legalMoves: game?.turn === myColor ? legalMoves : [],
    lastMoveFrom: game?.moves[game.moves.length - 1]?.from,
    lastMoveTo: game?.moves[game.moves.length - 1]?.to,
    flipped: myColor === "b",
    onMove: (from, to, promotion) => void makeMove(from, to, promotion),
  });

  const [showResultModal, setShowResultModal] = useState(true);

  if (!game) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  const isCheck = game.status === "CHECK";
  const isGameOver = ["CHECKMATE", "STALEMATE", "DRAW", "RESIGNED"].includes(game.status);
  const isInteractive = (game.status === "ACTIVE" || game.status === "CHECK") && game.turn === myColor;

  const reasonMap: Record<string, "checkmate" | "stalemate" | "resignation" | "draw" | "timeout"> = {
    CHECKMATE: "checkmate",
    STALEMATE: "stalemate",
    RESIGNED: "resignation",
    DRAW: "draw",
  };

  const lastMove = game.moves[game.moves.length - 1];

  return (
    <div className="space-y-3">
      {/* Back button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Arena
        </button>
        {error && (
          <div className="flex flex-1 items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
            <span>{error}</span>
            <button type="button" onClick={clearError} className="hover:underline">Dismiss</button>
          </div>
        )}
      </div>

      <GamePanel
        game={game}
        myPlayerId={myPlayerId}
        boardProps={{
          engine,
          fen: game.fen,
          lastMoveFrom: lastMove?.from,
          lastMoveTo: lastMove?.to,
          isCheck,
          interactive: isInteractive,
        }}
        resultModalProps={
          isGameOver && game.result && showResultModal
            ? {
                reason: reasonMap[game.status] ?? "draw",
                onClose: () => setShowResultModal(false),
                onRematch,
              }
            : undefined
        }
        onResign={() => void resign()}
        onOfferDraw={() => void offerDraw()}
        onAcceptDraw={() => void acceptDraw()}
        onDeclineDraw={() => void declineDraw()}
      />
    </div>
  );
}

// ─── Main Chess Page ──────────────────────────────────────────────────────────

export function ChessPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("play");
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchingTimeControl, setSearchingTimeControl] = useState<TimeControl>("BLITZ_5");

  // TODO: Replace with actual player profile lookup via /api/chess/players/me
  const myPlayerId: string | null = (user as { chessPlayerId?: string } | null)?.chessPlayerId ?? null;

  const leaderboard = useLeaderboard();

  // ─── Matchmaking handlers ──────────────────────────────────────────────────

  const handleQuickPlay = useCallback(async (tc: TimeControl) => {
    setSearchingTimeControl(tc);
    setIsSearching(true);
    try {
      // POST to matchmaking endpoint — creates a game or joins waiting one
      const res = await fetch("/api/chess/matchmake", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl: tc, playerId: myPlayerId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { gameId: string };
      setIsSearching(false);
      setActiveGameId(data.gameId);
    } catch {
      setIsSearching(false);
    }
  }, [myPlayerId]);

  const handleChallengeFriend = useCallback(
    async (username: string, tc: TimeControl) => {
      const res = await fetch("/api/chess/challenges", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderUsername: username, timeControl: tc, playerId: myPlayerId }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    [myPlayerId],
  );

  const handleCancelSearch = useCallback(() => {
    setIsSearching(false);
  }, []);

  const handleChallengePlayer = useCallback(
    async (player: ChessPlayer) => {
      await handleChallengeFriend(player.name, "BLITZ_5");
    },
    [handleChallengeFriend],
  );

  const handleViewProfile = useCallback((_player: ChessPlayer) => {
    // TODO: navigate to player profile page
  }, []);

  const handleOpenGame = useCallback((gameId: string) => {
    setActiveGameId(gameId);
  }, []);

  const handleCloseGame = useCallback(() => {
    setActiveGameId(null);
  }, []);

  const handleRematch = useCallback(() => {
    // TODO: send challenge to same opponent
    setActiveGameId(null);
    setActiveTab("play");
  }, []);

  // ─── Auth guard ────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center lg:h-[calc(100dvh-4.5rem)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // ─── Active game override ─────────────────────────────────────────────────

  if (activeGameId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <ActiveGameView
          gameId={activeGameId}
          myPlayerId={myPlayerId}
          onClose={handleCloseGame}
          onRematch={handleRematch}
        />
      </div>
    );
  }

  // ─── Tab layout ───────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string }[] = [
    { id: "play", label: "Play" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "my-games", label: "My Games" },
    { id: "challenges", label: "Challenges" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Chess Arena</h1>
          <p className="text-sm text-muted-foreground">Play, challenge, and climb the leaderboard</p>
        </div>
        {/* Board preview — decorative */}
        <div className="hidden items-center gap-1 sm:flex" aria-hidden="true">
          {["\u265A", "\u2655", "\u265B", "\u2654"].map((symbol, i) => (
            <span
              key={i}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-xl dark:bg-amber-900/30"
            >
              {symbol}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div
        className="mb-6 flex rounded-xl border border-border bg-muted/40 p-1"
        role="tablist"
        aria-label="Chess arena sections"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div role="tabpanel" aria-label={tabs.find((t) => t.id === activeTab)?.label}>
        {activeTab === "play" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
            {/* Left — matchmaking */}
            <div className="space-y-4">
              <Matchmaking
                onQuickPlay={handleQuickPlay}
                onChallengeFriend={handleChallengeFriend}
                isSearching={isSearching}
                onCancelSearch={handleCancelSearch}
                searchingTimeControl={isSearching ? searchingTimeControl : undefined}
              />

              {/* Demo board — always visible when not in a game */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-foreground">Board Preview</h2>
                <DemoBoard />
              </div>
            </div>

            {/* Right — online players (mini leaderboard) */}
            <div className="w-full lg:w-80">
              <Leaderboard
                players={leaderboard.players.slice(0, 10)}
                myPlayerId={myPlayerId}
                isLoading={leaderboard.isLoading}
                onChallenge={handleChallengePlayer}
                onViewProfile={handleViewProfile}
              />
            </div>
          </div>
        )}

        {activeTab === "leaderboard" && (
          <Leaderboard
            players={leaderboard.players}
            myPlayerId={myPlayerId}
            isLoading={leaderboard.isLoading}
            onChallenge={handleChallengePlayer}
            onViewProfile={handleViewProfile}
          />
        )}

        {activeTab === "my-games" && (
          <MyGamesTab playerId={myPlayerId} onOpenGame={handleOpenGame} />
        )}

        {activeTab === "challenges" && (
          <ChallengesTab playerId={myPlayerId} onGameStarted={handleOpenGame} />
        )}
      </div>
    </div>
  );
}

// ─── Demo Board ───────────────────────────────────────────────────────────────
// Shows the starting position, non-interactive, for visual interest on the Play tab.

function DemoBoard() {
  const engine = useChessEngine({
    fen: INITIAL_FEN,
    legalMoves: [],
    onMove: () => undefined,
  });

  return (
    <div className="flex justify-center">
      <ChessBoard
        engine={engine}
        fen={INITIAL_FEN}
        interactive={false}
      />
    </div>
  );
}
