import { Chess, type Square, validateFen } from "chess.js";

import type { ChessColor, GameState, LegalMove, MoveResult } from "./types";
import { TIME_CONTROL_MS } from "./types";

export function createGame(fen?: string): Chess {
  return fen ? new Chess(fen) : new Chess();
}

export function makeMove(
  game: Chess,
  move: { from: string; to: string; promotion?: string; },
): MoveResult {
  try {
    const result = game.move(move);
    return {
      success: true,
      san: result.san,
      from: result.from,
      to: result.to,
      fen: game.fen(),
      isCheck: game.isCheck(),
      isCheckmate: game.isCheckmate(),
      isStalemate: game.isStalemate(),
      isDraw: game.isDraw(),
      isGameOver: game.isGameOver(),
      captured: result.captured,
      promotion: result.promotion,
    };
  } catch {
    return {
      success: false,
      san: "",
      from: move.from,
      to: move.to,
      fen: game.fen(),
      isCheck: game.isCheck(),
      isCheckmate: game.isCheckmate(),
      isStalemate: game.isStalemate(),
      isDraw: game.isDraw(),
      isGameOver: game.isGameOver(),
    };
  }
}

export function getGameState(game: Chess): GameState {
  const fen = game.fen();
  const halfMoves = parseInt(fen.split(" ")[4] ?? "0", 10);

  return {
    fen,
    pgn: game.pgn(),
    turn: game.turn() as ChessColor,
    moveCount: game.moveNumber(),
    isCheck: game.isCheck(),
    isCheckmate: game.isCheckmate(),
    isStalemate: game.isStalemate(),
    isDraw: game.isDraw(),
    isGameOver: game.isGameOver(),
    isInsufficientMaterial: game.isInsufficientMaterial(),
    isThreefoldRepetition: game.isThreefoldRepetition(),
    is50MoveRule: halfMoves >= 100,
  };
}

export function getLegalMovesForSquare(
  game: Chess,
  square: string,
): LegalMove[] {
  const moves = game.moves({ verbose: true, square: square as Square });
  return moves.map(m => ({
    from: m.from,
    to: m.to,
    san: m.san,
    flags: m.flags,
  }));
}

export function getAllLegalMoves(game: Chess): LegalMove[] {
  const moves = game.moves({ verbose: true });
  return moves.map(m => ({
    from: m.from,
    to: m.to,
    san: m.san,
    flags: m.flags,
  }));
}

export function isValidFen(fen: string): boolean {
  return validateFen(fen).ok;
}

export function getBoard(
  game: Chess,
): (({ type: string; color: ChessColor; } | null)[])[] {
  return game.board().map(row =>
    row.map(cell => cell ? { type: cell.type, color: cell.color as ChessColor } : null)
  );
}

export function loadPgn(pgn: string): Chess {
  const game = new Chess();
  game.loadPgn(pgn);
  return game;
}

export function getTimeControlMs(timeControl: string): number {
  return TIME_CONTROL_MS[timeControl] ?? 0;
}
