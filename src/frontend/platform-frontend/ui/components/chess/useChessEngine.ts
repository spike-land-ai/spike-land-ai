/**
 * Pure-frontend chess state hook.
 *
 * Parses FEN strings to derive board state and tracks local UI state
 * (selected square, legal-move highlights, last move, flipped orientation).
 * Actual move legality and validation happens server-side; the hook calls
 * `onMove` and waits for the refreshed GameState.
 */
import { useState, useCallback, useMemo } from "react";
import type { Board, BoardSquare, ChessColor, LegalMove, Piece, PieceType } from "./chess-types";
import { rowColToSquare } from "./chess-types";

// ─── FEN Parser ─────────────────────────────────────────────────────────────

const FEN_PIECE_MAP: Record<string, { type: PieceType; color: ChessColor }> = {
  P: { type: "p", color: "w" },
  N: { type: "n", color: "w" },
  B: { type: "b", color: "w" },
  R: { type: "r", color: "w" },
  Q: { type: "q", color: "w" },
  K: { type: "k", color: "w" },
  p: { type: "p", color: "b" },
  n: { type: "n", color: "b" },
  b: { type: "b", color: "b" },
  r: { type: "r", color: "b" },
  q: { type: "q", color: "b" },
  k: { type: "k", color: "b" },
};

export function parseFen(fen: string): Board {
  const piecePlacement = fen.split(" ")[0] ?? "";
  const rows = piecePlacement.split("/");
  const board: Board = [];

  for (const rowStr of rows) {
    const row: BoardSquare[] = [];
    for (const char of rowStr) {
      const emptyCount = parseInt(char, 10);
      if (!isNaN(emptyCount)) {
        for (let i = 0; i < emptyCount; i++) {
          row.push(null);
        }
      } else {
        const piece = FEN_PIECE_MAP[char];
        row.push(piece ? { type: piece.type, color: piece.color } : null);
      }
    }
    board.push(row);
  }

  return board;
}

export function getTurnFromFen(fen: string): ChessColor {
  const parts = fen.split(" ");
  return (parts[1] === "b" ? "b" : "w") as ChessColor;
}

// ─── Captured Pieces Derivation ─────────────────────────────────────────────

const PIECE_VALUES: Record<PieceType, number> = {
  q: 9,
  r: 5,
  b: 3,
  n: 3,
  p: 1,
  k: 0,
};

const STARTING_COUNTS: Record<PieceType, number> = {
  k: 1,
  q: 1,
  r: 2,
  b: 2,
  n: 2,
  p: 8,
};

export interface CapturedPieces {
  white: Piece[]; // pieces captured by white (i.e. black pieces removed from board)
  black: Piece[]; // pieces captured by black (i.e. white pieces removed from board)
  advantage: number; // positive = white ahead, negative = black ahead
}

export function deriveCapturedPieces(board: Board): CapturedPieces {
  const counts: Record<ChessColor, Partial<Record<PieceType, number>>> = { w: {}, b: {} };

  for (const row of board) {
    for (const cell of row) {
      if (cell) {
        counts[cell.color][cell.type] = (counts[cell.color][cell.type] ?? 0) + 1;
      }
    }
  }

  const capturedByWhite: Piece[] = []; // black pieces captured
  const capturedByBlack: Piece[] = []; // white pieces captured

  for (const [pieceTypeStr, starting] of Object.entries(STARTING_COUNTS)) {
    const pieceType = pieceTypeStr as PieceType;
    const onBoardWhite = counts["w"][pieceType] ?? 0;
    const onBoardBlack = counts["b"][pieceType] ?? 0;
    const capturedWhite = starting - onBoardWhite;
    const capturedBlack = starting - onBoardBlack;

    for (let i = 0; i < capturedWhite; i++) {
      capturedByBlack.push({ type: pieceType, color: "w" });
    }
    for (let i = 0; i < capturedBlack; i++) {
      capturedByWhite.push({ type: pieceType, color: "b" });
    }
  }

  // Sort by value descending
  const sortByValue = (a: Piece, b: Piece) => PIECE_VALUES[b.type] - PIECE_VALUES[a.type];
  capturedByWhite.sort(sortByValue);
  capturedByBlack.sort(sortByValue);

  const whiteMaterialCaptured = capturedByWhite.reduce(
    (sum, p) => sum + PIECE_VALUES[p.type],
    0,
  );
  const blackMaterialCaptured = capturedByBlack.reduce(
    (sum, p) => sum + PIECE_VALUES[p.type],
    0,
  );

  return {
    white: capturedByWhite,
    black: capturedByBlack,
    advantage: whiteMaterialCaptured - blackMaterialCaptured,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseChessEngineOptions {
  fen: string;
  legalMoves: LegalMove[];
  lastMoveFrom?: string;
  lastMoveTo?: string;
  flipped?: boolean;
  onMove: (from: string, to: string, promotion?: string) => void;
}

export interface UseChessEngineReturn {
  board: Board;
  turn: ChessColor;
  selectedSquare: string | null;
  legalTargets: Set<string>;
  capturedPieces: CapturedPieces;
  flipped: boolean;
  toggleFlip: () => void;
  handleSquareClick: (square: string) => void;
  handleDragStart: (square: string) => void;
  handleDrop: (square: string) => void;
  promotionPending: { from: string; to: string } | null;
  resolvePromotion: (piece: PieceType) => void;
  cancelPromotion: () => void;
}

export function useChessEngine({
  fen,
  legalMoves,
  lastMoveFrom,
  lastMoveTo,
  flipped: initialFlipped = false,
  onMove,
}: UseChessEngineOptions): UseChessEngineReturn {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(initialFlipped);
  const [promotionPending, setPromotionPending] = useState<{ from: string; to: string } | null>(
    null,
  );

  const board = useMemo(() => parseFen(fen), [fen]);
  const turn = useMemo(() => getTurnFromFen(fen), [fen]);
  const capturedPieces = useMemo(() => deriveCapturedPieces(board), [board]);

  // Map from-square to set of legal to-squares for quick lookup
  const legalMovesMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const move of legalMoves) {
      const targets = map.get(move.from) ?? new Set<string>();
      targets.add(move.to);
      map.set(move.from, targets);
    }
    return map;
  }, [legalMoves]);

  const legalTargets = useMemo(() => {
    if (!selectedSquare) return new Set<string>();
    return legalMovesMap.get(selectedSquare) ?? new Set<string>();
  }, [selectedSquare, legalMovesMap]);

  // Check if a move requires promotion
  const isPromotion = useCallback(
    (from: string, to: string): boolean => {
      const move = legalMoves.find((m) => m.from === from && m.to === to);
      if (!move) return false;
      return move.flags.includes("p");
    },
    [legalMoves],
  );

  const attemptMove = useCallback(
    (from: string, to: string) => {
      if (isPromotion(from, to)) {
        setPromotionPending({ from, to });
        return;
      }
      onMove(from, to);
      setSelectedSquare(null);
    },
    [isPromotion, onMove],
  );

  const handleSquareClick = useCallback(
    (square: string) => {
      if (promotionPending) return;

      if (!selectedSquare) {
        // Select a piece if it has legal moves
        if (legalMovesMap.has(square)) {
          setSelectedSquare(square);
        }
        return;
      }

      if (selectedSquare === square) {
        // Deselect
        setSelectedSquare(null);
        return;
      }

      if (legalTargets.has(square)) {
        // Make the move
        attemptMove(selectedSquare, square);
        return;
      }

      // Select a different piece
      if (legalMovesMap.has(square)) {
        setSelectedSquare(square);
      } else {
        setSelectedSquare(null);
      }
    },
    [promotionPending, selectedSquare, legalMovesMap, legalTargets, attemptMove],
  );

  const handleDragStart = useCallback(
    (square: string) => {
      if (legalMovesMap.has(square)) {
        setSelectedSquare(square);
      }
    },
    [legalMovesMap],
  );

  const handleDrop = useCallback(
    (square: string) => {
      if (selectedSquare && legalTargets.has(square)) {
        attemptMove(selectedSquare, square);
      } else {
        setSelectedSquare(null);
      }
    },
    [selectedSquare, legalTargets, attemptMove],
  );

  const resolvePromotion = useCallback(
    (piece: PieceType) => {
      if (promotionPending) {
        onMove(promotionPending.from, promotionPending.to, piece);
        setPromotionPending(null);
        setSelectedSquare(null);
      }
    },
    [promotionPending, onMove],
  );

  const cancelPromotion = useCallback(() => {
    setPromotionPending(null);
    setSelectedSquare(null);
  }, []);

  const toggleFlip = useCallback(() => {
    setFlipped((f) => !f);
  }, []);

  return {
    board,
    turn,
    selectedSquare,
    legalTargets,
    capturedPieces,
    flipped,
    toggleFlip,
    handleSquareClick,
    handleDragStart,
    handleDrop,
    promotionPending,
    resolvePromotion,
    cancelPromotion,
  };
}

// ─── Square Classification Helpers ──────────────────────────────────────────

export function isLightSquare(row: number, col: number): boolean {
  return (row + col) % 2 === 0;
}

export function getSquareForRowCol(row: number, col: number, flipped: boolean): string {
  return rowColToSquare(row, col, flipped);
}

export function findKingSquare(board: Board, color: ChessColor, flipped: boolean): string | null {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row]?.[col];
      if (piece?.type === "k" && piece.color === color) {
        return getSquareForRowCol(row, col, flipped);
      }
    }
  }
  return null;
}
