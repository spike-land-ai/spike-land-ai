/**
 * GamePanel
 *
 * Wraps the chess board with:
 * - Player info bars (top and bottom) — name, ELO, timer
 * - Captured pieces display
 * - Move history sidebar (algebraic notation, scrollable)
 * - Game controls: Resign, Draw Offer, Undo Request
 * - Game result modal
 */
import { useEffect, useRef, useCallback } from "react";
import type { ChessPlayer, GameState, GameResult } from "./chess-types";
import { PIECE_UNICODE, formatTime } from "./chess-types";
import type { CapturedPieces } from "./useChessEngine";
import type { ChessBoardProps } from "./ChessBoard";
import { ChessBoard } from "./ChessBoard";

// ─── Player Bar ──────────────────────────────────────────────────────────────

interface PlayerBarProps {
  player: ChessPlayer | null;
  timeMs: number;
  isActive: boolean;
  captured: CapturedPieces["white"] | CapturedPieces["black"];
  materialAdvantage: number; // positive = this player leads
  side: "top" | "bottom";
}

function PlayerBar({ player, timeMs, isActive, captured, materialAdvantage, side }: PlayerBarProps) {
  const formattedTime = formatTime(timeMs);
  const isLow = timeMs > 0 && timeMs < 30_000;
  const isVeryLow = timeMs > 0 && timeMs < 10_000;

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 ${
        side === "bottom"
          ? "rounded-b-xl border-b border-l border-r border-border bg-card"
          : "rounded-t-xl border-l border-r border-t border-border bg-card"
      }`}
    >
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
        {player ? player.name.charAt(0).toUpperCase() : "?"}
      </div>

      {/* Name + ELO + captured */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">
            {player ? player.name : "Waiting..."}
          </span>
          {player && (
            <span className="shrink-0 text-xs text-muted-foreground">{player.elo}</span>
          )}
          {materialAdvantage > 0 && (
            <span className="shrink-0 text-xs font-medium text-success-foreground">
              +{materialAdvantage}
            </span>
          )}
        </div>
        {captured.length > 0 && (
          <div className="flex flex-wrap gap-0.5" aria-label="Captured pieces">
            {captured.map((p, i) => (
              <span key={i} className="text-xs leading-none opacity-70">
                {PIECE_UNICODE[p.type][p.color]}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Timer */}
      <div
        className={`shrink-0 min-w-[56px] rounded-lg px-2.5 py-1 text-center font-mono text-sm font-bold tabular-nums transition-colors ${
          isActive
            ? isVeryLow
              ? "animate-pulse bg-destructive text-destructive-foreground"
              : isLow
              ? "bg-warning/20 text-warning-foreground"
              : "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        }`}
        aria-label={`Time remaining: ${formattedTime}`}
        aria-live={isActive ? "polite" : "off"}
      >
        {formattedTime}
      </div>
    </div>
  );
}

// ─── Move History ────────────────────────────────────────────────────────────

interface MoveHistoryProps {
  moves: GameState["moves"];
}

function MoveHistory({ moves }: MoveHistoryProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [moves.length]);

  // Group into pairs: white move + black move
  const pairs: Array<{ number: number; white: string; black?: string }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    const whiteMoveItem = moves[i];
    const blackMoveItem = moves[i + 1];
    if (!whiteMoveItem) continue;
    pairs.push({
      number: whiteMoveItem.moveNumber,
      white: whiteMoveItem.san,
      black: blackMoveItem?.san,
    });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Moves
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto px-1 py-1 text-sm" role="log" aria-label="Move history">
        {pairs.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No moves yet</p>
        ) : (
          pairs.map((pair) => (
            <div key={pair.number} className="flex items-baseline gap-1 rounded px-2 py-0.5 hover:bg-muted/50">
              <span className="w-6 shrink-0 text-xs text-muted-foreground tabular-nums">
                {Math.ceil(pair.number / 2)}.
              </span>
              <span className="w-14 font-mono text-foreground">{pair.white}</span>
              {pair.black !== undefined && (
                <span className="font-mono text-foreground">{pair.black}</span>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

// ─── Game Result Modal ───────────────────────────────────────────────────────

interface GameResultModalProps {
  result: GameResult;
  reason:
    | "checkmate"
    | "stalemate"
    | "resignation"
    | "draw"
    | "timeout"
    | "insufficient"
    | "repetition"
    | "50move";
  myPlayerId: string | null;
  whitePlayerId: string;
  blackPlayerId: string | null;
  onClose: () => void;
  onRematch?: () => void;
}

function GameResultModal({
  result,
  reason,
  myPlayerId,
  whitePlayerId,
  blackPlayerId,
  onClose,
  onRematch,
}: GameResultModalProps) {
  const myColor =
    myPlayerId === whitePlayerId ? "w" : myPlayerId === blackPlayerId ? "b" : null;
  const wonOrLost =
    myColor === null
      ? null
      : (result === "white" && myColor === "w") || (result === "black" && myColor === "b")
        ? "win"
        : result === "draw"
          ? "draw"
          : "loss";

  const headlineMap = {
    win: "You won!",
    loss: "You lost",
    draw: "Draw",
  };
  const reasonMap: Record<GameResultModalProps["reason"], string> = {
    checkmate: "by checkmate",
    stalemate: "by stalemate",
    resignation: "by resignation",
    draw: "by agreement",
    timeout: "on time",
    insufficient: "insufficient material",
    repetition: "threefold repetition",
    "50move": "50-move rule",
  };

  const resultLabel =
    result === "draw"
      ? "Draw"
      : result === "white"
        ? "White wins"
        : "Black wins";

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Game over"
    >
      <div className="w-72 rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
        <div
          className={`mb-2 text-4xl font-black ${
            wonOrLost === "win"
              ? "text-success-foreground"
              : wonOrLost === "loss"
              ? "text-destructive"
              : "text-foreground"
          }`}
        >
          {wonOrLost ? headlineMap[wonOrLost] : resultLabel}
        </div>
        <p className="mb-1 text-sm font-semibold text-foreground">{resultLabel}</p>
        <p className="mb-6 text-xs text-muted-foreground">{reasonMap[reason]}</p>
        <div className="flex gap-2">
          {onRematch && (
            <button
              type="button"
              onClick={onRematch}
              className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Rematch
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Game Controls ───────────────────────────────────────────────────────────

interface GameControlsProps {
  canInteract: boolean;
  drawOffered: boolean;
  onResign: () => void;
  onOfferDraw: () => void;
  onAcceptDraw: () => void;
  onDeclineDraw: () => void;
}

function GameControls({
  canInteract,
  drawOffered,
  onResign,
  onOfferDraw,
  onAcceptDraw,
  onDeclineDraw,
}: GameControlsProps) {
  if (!canInteract) return null;

  if (drawOffered) {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAcceptDraw}
          className="flex-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          Accept Draw
        </button>
        <button
          type="button"
          onClick={onDeclineDraw}
          className="flex-1 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          Decline
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onOfferDraw}
        className="flex-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      >
        Offer Draw
      </button>
      <button
        type="button"
        onClick={onResign}
        className="flex-1 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        Resign
      </button>
    </div>
  );
}

// ─── Main GamePanel ──────────────────────────────────────────────────────────

export interface GamePanelProps {
  game: GameState;
  myPlayerId: string | null;
  boardProps: ChessBoardProps;
  resultModalProps?: {
    reason: GameResultModalProps["reason"];
    onClose: () => void;
    onRematch?: () => void;
  };
  onResign: () => void;
  onOfferDraw: () => void;
  onAcceptDraw: () => void;
  onDeclineDraw: () => void;
}

export function GamePanel({
  game,
  myPlayerId,
  boardProps,
  resultModalProps,
  onResign,
  onOfferDraw,
  onAcceptDraw,
  onDeclineDraw,
}: GamePanelProps) {
  const { capturedPieces } = boardProps.engine;
  const isActive = game.status === "ACTIVE" || game.status === "CHECK";
  const whiteTurn = game.turn === "w";
  const myColor =
    myPlayerId === game.whitePlayerId
      ? "w"
      : myPlayerId === game.blackPlayerId
      ? "b"
      : null;
  const canInteract = isActive && myColor !== null;
  const drawOffered = game.status === "DRAW_OFFERED";
  const isGameOver = ["CHECKMATE", "STALEMATE", "DRAW", "RESIGNED"].includes(game.status);

  // Determine which player bar is on top vs bottom.
  // Bottom = the current user's side; top = opponent.
  const flipped = boardProps.engine.flipped;
  const bottomIsWhite = flipped ? false : (myColor === "w" || myColor === null);

  const topPlayer = bottomIsWhite ? game.blackPlayer ?? null : game.whitePlayer ?? null;
  const bottomPlayer = bottomIsWhite ? game.whitePlayer ?? null : game.blackPlayer ?? null;
  const topTimeMs = bottomIsWhite ? game.blackTimeMs : game.whiteTimeMs;
  const bottomTimeMs = bottomIsWhite ? game.whiteTimeMs : game.blackTimeMs;
  const topIsActive = isActive && (bottomIsWhite ? !whiteTurn : whiteTurn);
  const bottomIsActive = isActive && (bottomIsWhite ? whiteTurn : !whiteTurn);
  const topCaptured = bottomIsWhite ? capturedPieces.black : capturedPieces.white;
  const bottomCaptured = bottomIsWhite ? capturedPieces.white : capturedPieces.black;

  // Material advantage shown for each side
  const topAdvantage = bottomIsWhite
    ? capturedPieces.advantage < 0
      ? -capturedPieces.advantage
      : 0
    : capturedPieces.advantage > 0
    ? capturedPieces.advantage
    : 0;
  const bottomAdvantage = bottomIsWhite
    ? capturedPieces.advantage > 0
      ? capturedPieces.advantage
      : 0
    : capturedPieces.advantage < 0
    ? -capturedPieces.advantage
    : 0;

  const reasonForResult = useCallback((): GameResultModalProps["reason"] => {
    if (resultModalProps?.reason) return resultModalProps.reason;
    if (game.status === "CHECKMATE") return "checkmate";
    if (game.status === "STALEMATE") return "stalemate";
    if (game.status === "RESIGNED") return "resignation";
    return "draw";
  }, [game.status, resultModalProps]);

  return (
    <div className="flex flex-col gap-0 lg:flex-row lg:items-start lg:gap-4">
      {/* Board column */}
      <div className="relative flex flex-col">
        <PlayerBar
          player={topPlayer}
          timeMs={topTimeMs}
          isActive={topIsActive}
          captured={topCaptured}
          materialAdvantage={topAdvantage}
          side="top"
        />

        <div className="relative">
          <ChessBoard {...boardProps} />

          {/* Game over overlay */}
          {isGameOver && game.result && resultModalProps && (
            <GameResultModal
              result={game.result}
              reason={reasonForResult()}
              myPlayerId={myPlayerId}
              whitePlayerId={game.whitePlayerId}
              blackPlayerId={game.blackPlayerId}
              onClose={resultModalProps.onClose}
              onRematch={resultModalProps.onRematch}
            />
          )}
        </div>

        <PlayerBar
          player={bottomPlayer}
          timeMs={bottomTimeMs}
          isActive={bottomIsActive}
          captured={bottomCaptured}
          materialAdvantage={bottomAdvantage}
          side="bottom"
        />

        {/* Game controls */}
        <div className="mt-2">
          <GameControls
            canInteract={canInteract}
            drawOffered={drawOffered}
            onResign={onResign}
            onOfferDraw={onOfferDraw}
            onAcceptDraw={onAcceptDraw}
            onDeclineDraw={onDeclineDraw}
          />
        </div>
      </div>

      {/* Move history sidebar */}
      <div
        className="mt-2 flex h-[min(90vw,520px)] w-full flex-col overflow-hidden rounded-xl border border-border bg-card lg:mt-0 lg:w-52"
        aria-label="Move history"
      >
        <MoveHistory moves={game.moves} />
      </div>
    </div>
  );
}
