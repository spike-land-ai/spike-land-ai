import { describe, expect, it } from "vitest";

import {
  createGame,
  getAllLegalMoves,
  getBoard,
  getGameState,
  getLegalMovesForSquare,
  getTimeControlMs,
  isValidFen,
  loadPgn,
  makeMove,
} from "./engine";

describe("createGame", () => {
  it("creates a game with default starting position", () => {
    const game = createGame();
    expect(game.fen()).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  });

  it("creates a game from a custom FEN", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    const game = createGame(fen);
    expect(game.fen()).toBe(fen);
    expect(game.turn()).toBe("b");
  });
});

describe("makeMove", () => {
  it("makes a valid pawn move", () => {
    const game = createGame();
    const result = makeMove(game, { from: "e2", to: "e4" });
    expect(result.success).toBe(true);
    expect(result.san).toBe("e4");
    expect(result.from).toBe("e2");
    expect(result.to).toBe("e4");
    expect(result.isGameOver).toBe(false);
  });

  it("makes a valid knight move", () => {
    const game = createGame();
    const result = makeMove(game, { from: "g1", to: "f3" });
    expect(result.success).toBe(true);
    expect(result.san).toBe("Nf3");
  });

  it("makes a valid bishop move", () => {
    const game = createGame();
    makeMove(game, { from: "e2", to: "e4" });
    makeMove(game, { from: "e7", to: "e5" });
    const result = makeMove(game, { from: "f1", to: "c4" });
    expect(result.success).toBe(true);
    expect(result.san).toBe("Bc4");
  });

  it("makes a valid rook move", () => {
    const fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
    const game = createGame(fen);
    const result = makeMove(game, { from: "a1", to: "d1" });
    expect(result.success).toBe(true);
    expect(result.san).toBe("Rd1");
  });

  it("makes a valid queen move", () => {
    const game = createGame();
    makeMove(game, { from: "e2", to: "e4" });
    makeMove(game, { from: "e7", to: "e5" });
    const result = makeMove(game, { from: "d1", to: "h5" });
    expect(result.success).toBe(true);
    expect(result.san).toBe("Qh5");
  });

  it("makes a valid king move", () => {
    const game = createGame();
    makeMove(game, { from: "e2", to: "e4" });
    makeMove(game, { from: "e7", to: "e5" });
    const result = makeMove(game, { from: "e1", to: "e2" });
    expect(result.success).toBe(true);
    expect(result.san).toBe("Ke2");
  });

  it("returns success false for invalid move", () => {
    const game = createGame();
    const result = makeMove(game, { from: "e2", to: "e5" });
    expect(result.success).toBe(false);
    expect(result.san).toBe("");
    expect(result.from).toBe("e2");
    expect(result.to).toBe("e5");
  });

  it("detects check", () => {
    const game = createGame();
    makeMove(game, { from: "e2", to: "e4" });
    makeMove(game, { from: "f7", to: "f6" });
    const result = makeMove(game, { from: "d1", to: "h5" });
    expect(result.success).toBe(true);
    expect(result.isCheck).toBe(true);
    expect(result.isCheckmate).toBe(false);
  });

  it("detects checkmate (Scholar's mate)", () => {
    const game = createGame();
    makeMove(game, { from: "e2", to: "e4" });
    makeMove(game, { from: "e7", to: "e5" });
    makeMove(game, { from: "f1", to: "c4" });
    makeMove(game, { from: "b8", to: "c6" });
    makeMove(game, { from: "d1", to: "h5" });
    makeMove(game, { from: "g8", to: "f6" });
    const result = makeMove(game, { from: "h5", to: "f7" });
    expect(result.success).toBe(true);
    expect(result.isCheckmate).toBe(true);
    expect(result.isGameOver).toBe(true);
    expect(result.captured).toBe("p");
  });

  it("detects stalemate", () => {
    // Stalemate position: black king on a8, white king on c7, white queen on b6, black to move would be stalemate
    const fen = "k7/8/1Q1K4/8/8/8/8/8 b - - 0 1";
    const game = createGame(fen);
    expect(game.isStalemate()).toBe(true);
    expect(game.isGameOver()).toBe(true);
  });

  it("handles castling kingside", () => {
    const fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
    const game = createGame(fen);
    const result = makeMove(game, { from: "e1", to: "g1" });
    expect(result.success).toBe(true);
    expect(result.san).toBe("O-O");
  });

  it("handles castling queenside", () => {
    const fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
    const game = createGame(fen);
    const result = makeMove(game, { from: "e1", to: "c1" });
    expect(result.success).toBe(true);
    expect(result.san).toBe("O-O-O");
  });

  it("handles en passant", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4pP2/8/8/PPPPP1PP/RNBQKBNR w KQkq e6 0 3";
    const game = createGame(fen);
    const result = makeMove(game, { from: "f5", to: "e6" });
    expect(result.success).toBe(true);
    expect(result.captured).toBe("p");
  });

  it("handles pawn promotion", () => {
    const fen = "8/P7/8/8/8/8/8/4K2k w - - 0 1";
    const game = createGame(fen);
    const result = makeMove(game, { from: "a7", to: "a8", promotion: "q" });
    expect(result.success).toBe(true);
    expect(result.promotion).toBe("q");
  });
});

describe("getGameState", () => {
  it("returns correct state for starting position", () => {
    const game = createGame();
    const state = getGameState(game);
    expect(state.turn).toBe("w");
    expect(state.moveCount).toBe(1);
    expect(state.isCheck).toBe(false);
    expect(state.isCheckmate).toBe(false);
    expect(state.isStalemate).toBe(false);
    expect(state.isDraw).toBe(false);
    expect(state.isGameOver).toBe(false);
    expect(state.isInsufficientMaterial).toBe(false);
    expect(state.isThreefoldRepetition).toBe(false);
    expect(state.is50MoveRule).toBe(false);
  });

  it("detects insufficient material (king vs king)", () => {
    const fen = "8/8/8/4k3/8/8/8/4K3 w - - 0 1";
    const game = createGame(fen);
    const state = getGameState(game);
    expect(state.isInsufficientMaterial).toBe(true);
    expect(state.isDraw).toBe(true);
    expect(state.isGameOver).toBe(true);
  });

  it("detects 50-move rule", () => {
    // FEN with 100 half-moves (50 full moves)
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 100 51";
    const game = createGame(fen);
    const state = getGameState(game);
    expect(state.is50MoveRule).toBe(true);
  });

  it("handles FEN without half-move counter", () => {
    const game = createGame();
    // Mock fen() to return a short string
    const originalFen = game.fen;
    game.fen = () => "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";
    const state = getGameState(game);
    expect(state.is50MoveRule).toBe(false);
    game.fen = originalFen;
  });
});

describe("isValidFen", () => {
  it("returns true for valid FEN", () => {
    expect(isValidFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe(true);
  });

  it("returns false for invalid FEN", () => {
    expect(isValidFen("invalid")).toBe(false);
  });

  it("validates a mid-game FEN", () => {
    expect(isValidFen("rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2")).toBe(true);
  });
});

describe("FEN round-trip", () => {
  it("creates game from FEN and gets same FEN back", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";
    const game = createGame(fen);
    expect(game.fen()).toBe(fen);
  });
});

describe("loadPgn", () => {
  it("loads a game from PGN", () => {
    const game = loadPgn("1. e4 e5 2. Nf3 Nc6 3. Bb5");
    const state = getGameState(game);
    expect(state.turn).toBe("b");
    expect(state.moveCount).toBe(3);
  });
});

describe("getLegalMovesForSquare", () => {
  it("returns legal moves for a pawn on e2", () => {
    const game = createGame();
    const moves = getLegalMovesForSquare(game, "e2");
    expect(moves).toHaveLength(2);
    const targets = moves.map((m) => m.to);
    expect(targets).toContain("e3");
    expect(targets).toContain("e4");
  });

  it("returns no moves for an empty square", () => {
    const game = createGame();
    const moves = getLegalMovesForSquare(game, "e4");
    expect(moves).toHaveLength(0);
  });
});

describe("getAllLegalMoves", () => {
  it("returns 20 legal moves from starting position", () => {
    const game = createGame();
    const moves = getAllLegalMoves(game);
    expect(moves).toHaveLength(20);
  });
});

describe("getBoard", () => {
  it("returns 8x8 board representation", () => {
    const game = createGame();
    const board = getBoard(game);
    expect(board).toHaveLength(8);
    expect(board[0]).toHaveLength(8);
  });

  it("has correct pieces in starting position", () => {
    const game = createGame();
    const board = getBoard(game);
    // Top-left should be black rook
    expect(board[0]![0]).toEqual({ type: "r", color: "b" });
    // Bottom-right should be white rook
    expect(board[7]![7]).toEqual({ type: "r", color: "w" });
    // Middle of board should be empty
    expect(board[3]![3]).toBeNull();
  });
});

describe("getTimeControlMs", () => {
  it("returns correct ms for BULLET_1", () => {
    expect(getTimeControlMs("BULLET_1")).toBe(60_000);
  });

  it("returns correct ms for BULLET_2", () => {
    expect(getTimeControlMs("BULLET_2")).toBe(120_000);
  });

  it("returns correct ms for BLITZ_3", () => {
    expect(getTimeControlMs("BLITZ_3")).toBe(180_000);
  });

  it("returns correct ms for BLITZ_5", () => {
    expect(getTimeControlMs("BLITZ_5")).toBe(300_000);
  });

  it("returns correct ms for RAPID_10", () => {
    expect(getTimeControlMs("RAPID_10")).toBe(600_000);
  });

  it("returns correct ms for RAPID_15", () => {
    expect(getTimeControlMs("RAPID_15")).toBe(900_000);
  });

  it("returns correct ms for CLASSICAL_30", () => {
    expect(getTimeControlMs("CLASSICAL_30")).toBe(1_800_000);
  });

  it("returns 0 for UNLIMITED", () => {
    expect(getTimeControlMs("UNLIMITED")).toBe(0);
  });

  it("returns 0 for unknown time control", () => {
    expect(getTimeControlMs("UNKNOWN")).toBe(0);
  });
});
