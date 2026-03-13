/**
 * ChessBoard
 *
 * 8x8 chess board with:
 * - Unicode piece rendering
 * - Click-to-select + click-to-move
 * - Drag-and-drop piece movement
 * - Legal move dots
 * - Last-move highlight
 * - Check highlight on king
 * - Board flip button
 * - Promotion picker modal
 */
import { useRef, useCallback } from "react";
import type { PieceType } from "./chess-types";
import { PIECE_UNICODE, rankLabel, fileLabel } from "./chess-types";
import type { UseChessEngineReturn } from "./useChessEngine";
import {
  isLightSquare,
  getSquareForRowCol,
  parseFen,
  getTurnFromFen,
  findKingSquare,
} from "./useChessEngine";

// ─── Sub-components ──────────────────────────────────────────────────────────

function PromotionPicker({
  color,
  onChoose,
  onCancel,
}: {
  color: "w" | "b";
  onChoose: (piece: PieceType) => void;
  onCancel: () => void;
}) {
  const pieces: PieceType[] = ["q", "r", "b", "n"];
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Choose promotion piece"
    >
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xl">
        <p className="mb-3 text-center text-sm font-semibold text-foreground">Promote to:</p>
        <div className="flex gap-2">
          {pieces.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChoose(p)}
              className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-border bg-background text-4xl transition-colors hover:border-primary hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Promote to ${p}`}
            >
              {PIECE_UNICODE[p][color]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 w-full rounded-xl border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Square Component ────────────────────────────────────────────────────────

interface SquareProps {
  square: string;
  row: number;
  col: number;
  flipped: boolean;
  piece: ReturnType<typeof parseFen>[0][0];
  isSelected: boolean;
  isLegalTarget: boolean;
  isLastMoveSquare: boolean;
  isKingInCheck: boolean;
  onSquareClick: (square: string) => void;
  onDragStart: (square: string) => void;
  onDrop: (square: string) => void;
  showFileLabel: boolean;
  showRankLabel: boolean;
}

function Square({
  square,
  row,
  col,
  flipped,
  piece,
  isSelected,
  isLegalTarget,
  isLastMoveSquare,
  isKingInCheck,
  onSquareClick,
  onDragStart,
  onDrop,
  showFileLabel,
  showRankLabel,
}: SquareProps) {
  const dragOverRef = useRef(false);

  const light = isLightSquare(row, col);

  // Base square color
  let bgClass = light ? "bg-amber-100" : "bg-amber-800";

  // Overlays (order matters — later wins)
  if (isLastMoveSquare) {
    bgClass = light ? "bg-yellow-200" : "bg-yellow-600";
  }
  if (isSelected) {
    bgClass = "bg-green-400";
  }
  if (isKingInCheck) {
    bgClass = "bg-red-400";
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragOverRef.current = true;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragOverRef.current = false;
      onDrop(square);
    },
    [square, onDrop],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      onDragStart(square);
    },
    [square, onDragStart],
  );

  const handleClick = useCallback(() => {
    onSquareClick(square);
  }, [square, onSquareClick]);

  return (
    <div
      className={`relative flex aspect-square select-none items-center justify-center ${bgClass} cursor-pointer transition-colors`}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-square={square}
      role="gridcell"
      aria-label={`${square}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
    >
      {/* Rank label (left edge, first column) */}
      {showRankLabel && (
        <span
          className={`absolute left-0.5 top-0.5 text-[0.6rem] font-bold leading-none ${
            light ? "text-amber-800" : "text-amber-100"
          }`}
          aria-hidden="true"
        >
          {rankLabel(row, flipped)}
        </span>
      )}

      {/* File label (bottom edge, last row) */}
      {showFileLabel && (
        <span
          className={`absolute bottom-0.5 right-0.5 text-[0.6rem] font-bold leading-none ${
            light ? "text-amber-800" : "text-amber-100"
          }`}
          aria-hidden="true"
        >
          {fileLabel(col, flipped)}
        </span>
      )}

      {/* Legal move indicator — dot for empty, ring for occupied */}
      {isLegalTarget && !piece && (
        <div className="pointer-events-none h-[28%] w-[28%] rounded-full bg-black/20" />
      )}
      {isLegalTarget && piece && (
        <div className="pointer-events-none absolute inset-0 rounded-sm ring-4 ring-inset ring-black/25" />
      )}

      {/* Piece */}
      {piece && (
        <span
          draggable
          onDragStart={handleDragStart}
          className={`z-10 cursor-grab text-[min(6vw,3.5rem)] leading-none active:cursor-grabbing ${
            piece.color === "w" ? "drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" : ""
          }`}
          role="img"
          aria-label={`${piece.color === "w" ? "White" : "Black"} ${piece.type}`}
        >
          {PIECE_UNICODE[piece.type][piece.color]}
        </span>
      )}
    </div>
  );
}

// ─── Board Component ─────────────────────────────────────────────────────────

export interface ChessBoardProps {
  engine: UseChessEngineReturn;
  fen: string;
  lastMoveFrom?: string;
  lastMoveTo?: string;
  isCheck?: boolean;
  /** Whether it is the current user's turn (disables interaction when false). */
  interactive?: boolean;
}

export function ChessBoard({
  engine,
  fen,
  lastMoveFrom,
  lastMoveTo,
  isCheck = false,
  interactive = true,
}: ChessBoardProps) {
  const {
    board,
    flipped,
    toggleFlip,
    selectedSquare,
    legalTargets,
    handleSquareClick,
    handleDragStart,
    handleDrop,
    promotionPending,
    resolvePromotion,
    cancelPromotion,
  } = engine;

  const turn = getTurnFromFen(fen);

  // Find king square for check highlight
  const kingInCheckSquare = isCheck ? findKingSquare(board, turn, flipped) : null;

  const handleSquareClickWrapped = useCallback(
    (square: string) => {
      if (!interactive) return;
      handleSquareClick(square);
    },
    [interactive, handleSquareClick],
  );

  const handleDragStartWrapped = useCallback(
    (square: string) => {
      if (!interactive) return;
      handleDragStart(square);
    },
    [interactive, handleDragStart],
  );

  const handleDropWrapped = useCallback(
    (square: string) => {
      if (!interactive) return;
      handleDrop(square);
    },
    [interactive, handleDrop],
  );

  return (
    <div className="relative">
      {/* Flip button */}
      <button
        type="button"
        onClick={toggleFlip}
        className="absolute -right-9 top-1/2 z-10 -translate-y-1/2 rounded-lg border border-border bg-card p-1.5 text-muted-foreground shadow transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Flip board"
        title="Flip board"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      </button>

      {/* Board grid */}
      <div
        className="grid grid-cols-8 overflow-hidden rounded-xl border-2 border-amber-900/60 shadow-2xl"
        role="grid"
        aria-label="Chess board"
        style={{ width: "min(90vw, 520px)", height: "min(90vw, 520px)" }}
      >
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => {
            const square = getSquareForRowCol(rowIndex, colIndex, flipped);
            return (
              <Square
                key={square}
                square={square}
                row={rowIndex}
                col={colIndex}
                flipped={flipped}
                piece={piece}
                isSelected={selectedSquare === square}
                isLegalTarget={legalTargets.has(square)}
                isLastMoveSquare={square === lastMoveFrom || square === lastMoveTo}
                isKingInCheck={square === kingInCheckSquare}
                onSquareClick={handleSquareClickWrapped}
                onDragStart={handleDragStartWrapped}
                onDrop={handleDropWrapped}
                showRankLabel={colIndex === 0}
                showFileLabel={rowIndex === 7}
              />
            );
          }),
        )}
      </div>

      {/* Promotion modal */}
      {promotionPending && (
        <PromotionPicker
          color={turn}
          onChoose={resolvePromotion}
          onCancel={cancelPromotion}
        />
      )}
    </div>
  );
}
