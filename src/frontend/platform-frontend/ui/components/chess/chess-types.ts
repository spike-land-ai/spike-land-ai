// ─── Chess UI Types ──────────────────────────────────────────────────────────
// Mirrors the backend chess engine types for use in the frontend.
// Backend lives at src/core/chess/core-logic/types.ts

export type ChessColor = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type GameResult = "white" | "black" | "draw";

export type TimeControl =
  | "BULLET_1"
  | "BULLET_2"
  | "BLITZ_3"
  | "BLITZ_5"
  | "RAPID_10"
  | "RAPID_15"
  | "CLASSICAL_30"
  | "UNLIMITED";

export const TIME_CONTROL_LABELS: Record<TimeControl, string> = {
  BULLET_1: "Bullet 1+0",
  BULLET_2: "Bullet 2+0",
  BLITZ_3: "Blitz 3+2",
  BLITZ_5: "Blitz 5+0",
  RAPID_10: "Rapid 10+0",
  RAPID_15: "Rapid 15+10",
  CLASSICAL_30: "Classical 30+0",
  UNLIMITED: "Unlimited",
};

export const TIME_CONTROL_MS: Record<TimeControl, number> = {
  BULLET_1: 60_000,
  BULLET_2: 120_000,
  BLITZ_3: 180_000,
  BLITZ_5: 300_000,
  RAPID_10: 600_000,
  RAPID_15: 900_000,
  CLASSICAL_30: 1_800_000,
  UNLIMITED: 0,
};

export interface Piece {
  type: PieceType;
  color: ChessColor;
}

export type BoardSquare = Piece | null;

/** 8x8 board — row 0 is rank 8 (black's back rank), row 7 is rank 1 (white's back rank). */
export type Board = BoardSquare[][];

export interface LegalMove {
  from: string;
  to: string;
  san: string;
  flags: string;
}

export interface MoveRecord {
  moveNumber: number;
  san: string;
  from: string;
  to: string;
  fen: string;
  playerId: string;
  timeSpentMs: number | null;
}

export interface ChessPlayer {
  id: string;
  userId: string;
  name: string;
  avatar: string | null;
  elo: number;
  bestElo: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  isOnline: boolean;
}

export interface GameState {
  id: string;
  fen: string;
  pgn: string;
  turn: ChessColor;
  status:
    | "WAITING"
    | "ACTIVE"
    | "CHECK"
    | "CHECKMATE"
    | "STALEMATE"
    | "DRAW"
    | "RESIGNED"
    | "DRAW_OFFERED";
  timeControl: TimeControl;
  whitePlayerId: string;
  blackPlayerId: string | null;
  whiteTimeMs: number;
  blackTimeMs: number;
  moveCount: number;
  moves: MoveRecord[];
  result: GameResult | null;
  winnerId: string | null;
  whitePlayer?: ChessPlayer | null;
  blackPlayer?: ChessPlayer | null;
}

export interface Challenge {
  id: string;
  senderId: string;
  receiverId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "EXPIRED";
  timeControl: TimeControl;
  senderColor: string | null;
  gameId: string | null;
  expiresAt: string;
  sender?: ChessPlayer;
  receiver?: ChessPlayer;
}

/** Maps algebraic square name (e.g. "e4") to [file, rank] indices [0-7]. */
export function squareToCoords(square: string): [number, number] {
  const file = square.charCodeAt(0) - 97; // 'a' = 0
  const rank = parseInt(square[1]!, 10) - 1; // '1' = 0
  return [file, rank];
}

/** Maps [file, rank] (0-7 each, rank 0 = rank-1) to square name. */
export function coordsToSquare(file: number, rank: number): string {
  return String.fromCharCode(97 + file) + String(rank + 1);
}

/** Maps [row, col] in board array (row 0 = rank 8) to square name. */
export function rowColToSquare(row: number, col: number, flipped: boolean): string {
  const file = flipped ? 7 - col : col;
  const rank = flipped ? row : 7 - row;
  return coordsToSquare(file, rank);
}

/** Unicode symbol for a piece. */
export const PIECE_UNICODE: Record<PieceType, Record<ChessColor, string>> = {
  k: { w: "\u2654", b: "\u265A" },
  q: { w: "\u2655", b: "\u265B" },
  r: { w: "\u2656", b: "\u265C" },
  b: { w: "\u2657", b: "\u265D" },
  n: { w: "\u2658", b: "\u265E" },
  p: { w: "\u2659", b: "\u265F" },
};

/** Format milliseconds as mm:ss. */
export function formatTime(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, "0")}`;
}

/** Rank label for a given display row (accounting for flip). */
export function rankLabel(row: number, flipped: boolean): string {
  return String(flipped ? row + 1 : 8 - row);
}

/** File label for a given display column (accounting for flip). */
export function fileLabel(col: number, flipped: boolean): string {
  return String.fromCharCode(97 + (flipped ? 7 - col : col));
}
