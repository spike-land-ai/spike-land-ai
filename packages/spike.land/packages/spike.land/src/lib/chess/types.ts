export type ChessColor = "w" | "b";

export interface MoveResult {
  success: boolean;
  san: string;
  from: string;
  to: string;
  fen: string;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
  captured?: string;
  promotion?: string;
}

export interface GameState {
  fen: string;
  pgn: string;
  turn: ChessColor;
  moveCount: number;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
  isInsufficientMaterial: boolean;
  isThreefoldRepetition: boolean;
  is50MoveRule: boolean;
}

export interface LegalMove {
  from: string;
  to: string;
  san: string;
  flags: string;
}

export interface EloUpdate {
  whiteNewElo: number;
  blackNewElo: number;
  whiteChange: number;
  blackChange: number;
}

export type GameResult = "white" | "black" | "draw";

export const TIME_CONTROL_MS: Record<string, number> = {
  BULLET_1: 60_000,
  BULLET_2: 120_000,
  BLITZ_3: 180_000,
  BLITZ_5: 300_000,
  RAPID_10: 600_000,
  RAPID_15: 900_000,
  CLASSICAL_30: 1_800_000,
  UNLIMITED: 0,
};
