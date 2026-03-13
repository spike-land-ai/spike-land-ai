/**
 * chess-logic.ts
 *
 * Pure TypeScript chess move generator — no external dependencies.
 * Generates pseudo-legal and legal moves from a FEN string.
 *
 * This is a lightweight implementation sufficient for UI purposes:
 * - Legal move highlighting
 * - Promotion detection
 * - Check/checkmate detection for display
 *
 * All server-side move validation still happens in the backend engine
 * (src/core/chess/chess-core/engine.ts using chess.js).
 */

import type { ChessColor, LegalMove, PieceType } from "./chess-types";
import type { Board, BoardSquare } from "./chess-types";
import { parseFen, getTurnFromFen } from "./useChessEngine";
import { coordsToSquare, squareToCoords } from "./chess-types";

// ─── Board helpers ───────────────────────────────────────────────────────────

function inBounds(file: number, rank: number): boolean {
  return file >= 0 && file <= 7 && rank >= 0 && rank <= 7;
}

function getPiece(board: Board, file: number, rank: number): BoardSquare {
  // Board row 0 = rank 8, row 7 = rank 1
  const row = 7 - rank;
  return board[row]?.[file] ?? null;
}

function setPiece(board: Board, file: number, rank: number, piece: BoardSquare): Board {
  const row = 7 - rank;
  const newBoard = board.map((r, ri) =>
    ri === row ? r.map((c, ci) => (ci === file ? piece : c)) : r,
  );
  return newBoard;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

// ─── En-passant square from FEN ──────────────────────────────────────────────

function getEnPassantSquare(fen: string): [number, number] | null {
  const parts = fen.split(" ");
  const ep = parts[3];
  if (!ep || ep === "-") return null;
  const [file, rank] = squareToCoords(ep);
  return [file, rank];
}

function getCastlingRights(fen: string): string {
  return fen.split(" ")[2] ?? "-";
}

// ─── Is king in check ────────────────────────────────────────────────────────

function isInCheck(board: Board, color: ChessColor): boolean {
  // Find king
  let kingFile = -1;
  let kingRank = -1;
  for (let rank = 0; rank <= 7; rank++) {
    for (let file = 0; file <= 7; file++) {
      const p = getPiece(board, file, rank);
      if (p?.type === "k" && p.color === color) {
        kingFile = file;
        kingRank = rank;
      }
    }
  }
  if (kingFile === -1) return false;

  const opp: ChessColor = color === "w" ? "b" : "w";

  // Check knights
  const knightDeltas = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ];
  for (const [df, dr] of knightDeltas) {
    const p = getPiece(board, kingFile + df, kingRank + dr);
    if (p?.type === "n" && p.color === opp) return true;
  }

  // Check sliding pieces (bishop/rook/queen)
  const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const straightDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [df, dr] of diagDirs) {
    let f = kingFile + df;
    let r = kingRank + dr;
    while (inBounds(f, r)) {
      const p = getPiece(board, f, r);
      if (p) {
        if (p.color === opp && (p.type === "b" || p.type === "q")) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }
  for (const [df, dr] of straightDirs) {
    let f = kingFile + df;
    let r = kingRank + dr;
    while (inBounds(f, r)) {
      const p = getPiece(board, f, r);
      if (p) {
        if (p.color === opp && (p.type === "r" || p.type === "q")) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }

  // Check pawns
  const pawnDr = color === "w" ? 1 : -1;
  for (const df of [-1, 1]) {
    const p = getPiece(board, kingFile + df, kingRank + pawnDr);
    if (p?.type === "p" && p.color === opp) return true;
  }

  // Check king (for adjacent kings)
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const p = getPiece(board, kingFile + df, kingRank + dr);
      if (p?.type === "k" && p.color === opp) return true;
    }
  }

  return false;
}

// ─── Pseudo-legal move generation ────────────────────────────────────────────

interface RawMove {
  fromFile: number;
  fromRank: number;
  toFile: number;
  toRank: number;
  flags: string; // 'n' normal, 'p' promotion, 'e' en-passant, 'k'/'q' castle, 'c' capture
  promotion?: PieceType;
}

function generatePseudoLegal(
  board: Board,
  color: ChessColor,
  epSquare: [number, number] | null,
  castlingRights: string,
): RawMove[] {
  const moves: RawMove[] = [];
  const opp: ChessColor = color === "w" ? "b" : "w";

  for (let rank = 0; rank <= 7; rank++) {
    for (let file = 0; file <= 7; file++) {
      const piece = getPiece(board, file, rank);
      if (!piece || piece.color !== color) continue;

      switch (piece.type) {
        case "p": {
          const dir = color === "w" ? 1 : -1;
          const startRank = color === "w" ? 1 : 6;
          const promoRank = color === "w" ? 7 : 0;

          // Single push
          const pushRank = rank + dir;
          if (inBounds(file, pushRank) && !getPiece(board, file, pushRank)) {
            if (pushRank === promoRank) {
              for (const p of ["q", "r", "b", "n"] as PieceType[]) {
                moves.push({ fromFile: file, fromRank: rank, toFile: file, toRank: pushRank, flags: "p", promotion: p });
              }
            } else {
              moves.push({ fromFile: file, fromRank: rank, toFile: file, toRank: pushRank, flags: "n" });
              // Double push
              if (rank === startRank) {
                const dblRank = rank + dir * 2;
                if (!getPiece(board, file, dblRank)) {
                  moves.push({ fromFile: file, fromRank: rank, toFile: file, toRank: dblRank, flags: "n" });
                }
              }
            }
          }

          // Captures
          for (const df of [-1, 1]) {
            const cf = file + df;
            const cr = rank + dir;
            if (!inBounds(cf, cr)) continue;
            const target = getPiece(board, cf, cr);
            if (target && target.color === opp) {
              if (cr === promoRank) {
                for (const p of ["q", "r", "b", "n"] as PieceType[]) {
                  moves.push({ fromFile: file, fromRank: rank, toFile: cf, toRank: cr, flags: "pc", promotion: p });
                }
              } else {
                moves.push({ fromFile: file, fromRank: rank, toFile: cf, toRank: cr, flags: "c" });
              }
            }
            // En-passant
            if (epSquare && epSquare[0] === cf && epSquare[1] === cr) {
              moves.push({ fromFile: file, fromRank: rank, toFile: cf, toRank: cr, flags: "e" });
            }
          }
          break;
        }

        case "n": {
          const knightDeltas = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
          for (const [df, dr] of knightDeltas) {
            const tf = file + df;
            const tr = rank + dr;
            if (!inBounds(tf, tr)) continue;
            const target = getPiece(board, tf, tr);
            if (!target || target.color === opp) {
              moves.push({ fromFile: file, fromRank: rank, toFile: tf, toRank: tr, flags: target ? "c" : "n" });
            }
          }
          break;
        }

        case "b": {
          for (const [df, dr] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
            let f = file + df;
            let r = rank + dr;
            while (inBounds(f, r)) {
              const target = getPiece(board, f, r);
              if (target) {
                if (target.color === opp) moves.push({ fromFile: file, fromRank: rank, toFile: f, toRank: r, flags: "c" });
                break;
              }
              moves.push({ fromFile: file, fromRank: rank, toFile: f, toRank: r, flags: "n" });
              f += df;
              r += dr;
            }
          }
          break;
        }

        case "r": {
          for (const [df, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            let f = file + df;
            let r = rank + dr;
            while (inBounds(f, r)) {
              const target = getPiece(board, f, r);
              if (target) {
                if (target.color === opp) moves.push({ fromFile: file, fromRank: rank, toFile: f, toRank: r, flags: "c" });
                break;
              }
              moves.push({ fromFile: file, fromRank: rank, toFile: f, toRank: r, flags: "n" });
              f += df;
              r += dr;
            }
          }
          break;
        }

        case "q": {
          for (const [df, dr] of [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
            let f = file + df;
            let r = rank + dr;
            while (inBounds(f, r)) {
              const target = getPiece(board, f, r);
              if (target) {
                if (target.color === opp) moves.push({ fromFile: file, fromRank: rank, toFile: f, toRank: r, flags: "c" });
                break;
              }
              moves.push({ fromFile: file, fromRank: rank, toFile: f, toRank: r, flags: "n" });
              f += df;
              r += dr;
            }
          }
          break;
        }

        case "k": {
          for (let df = -1; df <= 1; df++) {
            for (let dr = -1; dr <= 1; dr++) {
              if (df === 0 && dr === 0) continue;
              const tf = file + df;
              const tr = rank + dr;
              if (!inBounds(tf, tr)) continue;
              const target = getPiece(board, tf, tr);
              if (!target || target.color === opp) {
                moves.push({ fromFile: file, fromRank: rank, toFile: tf, toRank: tr, flags: target ? "c" : "n" });
              }
            }
          }

          // Castling
          const backRank = color === "w" ? 0 : 7;
          if (rank === backRank && file === 4) {
            // Kingside
            const kRight = color === "w" ? "K" : "k";
            if (
              castlingRights.includes(kRight) &&
              !getPiece(board, 5, backRank) &&
              !getPiece(board, 6, backRank)
            ) {
              moves.push({ fromFile: 4, fromRank: backRank, toFile: 6, toRank: backRank, flags: "k" });
            }
            // Queenside
            const qRight = color === "w" ? "Q" : "q";
            if (
              castlingRights.includes(qRight) &&
              !getPiece(board, 3, backRank) &&
              !getPiece(board, 2, backRank) &&
              !getPiece(board, 1, backRank)
            ) {
              moves.push({ fromFile: 4, fromRank: backRank, toFile: 2, toRank: backRank, flags: "q" });
            }
          }
          break;
        }
      }
    }
  }

  return moves;
}

// ─── Apply move to board ─────────────────────────────────────────────────────

function applyMove(board: Board, move: RawMove): Board {
  const piece = getPiece(board, move.fromFile, move.fromRank);
  if (!piece) return board;

  let b = cloneBoard(board);
  b = setPiece(b, move.fromFile, move.fromRank, null);

  // En-passant capture
  if (move.flags === "e") {
    const dir = piece.color === "w" ? -1 : 1;
    b = setPiece(b, move.toFile, move.toRank + dir, null);
  }

  // Promotion
  if (move.flags.includes("p") && move.promotion) {
    b = setPiece(b, move.toFile, move.toRank, { type: move.promotion, color: piece.color });
  } else {
    b = setPiece(b, move.toFile, move.toRank, piece);
  }

  // Castling — move rook
  if (move.flags === "k") {
    const rank = move.fromRank;
    b = setPiece(b, 7, rank, null);
    b = setPiece(b, 5, rank, { type: "r", color: piece.color });
  } else if (move.flags === "q") {
    const rank = move.fromRank;
    b = setPiece(b, 0, rank, null);
    b = setPiece(b, 3, rank, { type: "r", color: piece.color });
  }

  return b;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns all legal moves for the side to move, given a FEN string.
 * Filters pseudo-legal moves that leave the king in check.
 */
export function getAllLegalMovesFromFen(fen: string): LegalMove[] {
  const board = parseFen(fen);
  const color = getTurnFromFen(fen);
  const epSquare = getEnPassantSquare(fen);
  const castlingRights = getCastlingRights(fen);

  const pseudoLegal = generatePseudoLegal(board, color, epSquare, castlingRights);
  const legal: LegalMove[] = [];

  for (const move of pseudoLegal) {
    const newBoard = applyMove(board, move);

    // Castling: ensure king doesn't pass through check
    if (move.flags === "k" || move.flags === "q") {
      if (isInCheck(board, color)) continue; // can't castle while in check
      const passThroughFile = move.flags === "k" ? 5 : 3;
      const passBoard = applyMove(board, { ...move, toFile: passThroughFile, flags: "n" });
      if (isInCheck(passBoard, color)) continue;
    }

    if (!isInCheck(newBoard, color)) {
      const from = coordsToSquare(move.fromFile, move.fromRank);
      const to = coordsToSquare(move.toFile, move.toRank);
      // Build SAN-like stub (full SAN requires more context; use for promotion flag detection)
      const flags = move.flags.includes("p") ? "p" : move.flags;
      legal.push({ from, to, san: `${from}${to}`, flags });
    }
  }

  return legal;
}
