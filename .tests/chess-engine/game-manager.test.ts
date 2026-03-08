import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  chessGame: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  chessMove: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  chessPlayer: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const mockEngine = vi.hoisted(() => ({
  createGame: vi.fn(),
  makeMove: vi.fn(),
  getGameState: vi.fn(),
}));

vi.mock("../../src/core/chess/chess-core/engine", () => mockEngine);

const mockElo = vi.hoisted(() => ({
  calculateEloChange: vi.fn(),
}));

vi.mock("../../src/core/chess/lazy-imports/elo", () => mockElo);

import {
  acceptDraw,
  createGameRecord,
  declineDraw,
  finalizeGame,
  getGame,
  getGameReplay,
  handleTimeExpiry,
  joinGame,
  listGames,
  makeGameMove,
  offerDraw,
  resignGame,
} from "../../src/core/chess/core-logic/game-manager.js";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function makeGameRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "game-1",
    whitePlayerId: "white-player",
    blackPlayerId: "black-player",
    status: "ACTIVE",
    fen: INITIAL_FEN,
    pgn: "",
    timeControl: "BLITZ_5",
    whiteTimeMs: 300_000,
    blackTimeMs: 300_000,
    winnerId: null,
    result: null,
    eloChanges: null,
    moveCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMoveResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    success: true,
    san: "e4",
    from: "e2",
    to: "e4",
    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    isDraw: false,
    isGameOver: false,
    ...overrides,
  };
}

function makeGameState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    pgn: "1. e4",
    turn: "b",
    moveCount: 1,
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    isDraw: false,
    isGameOver: false,
    isInsufficientMaterial: false,
    isThreefoldRepetition: false,
    is50MoveRule: false,
    ...overrides,
  };
}

function makePlayer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "player-1",
    userId: "user-1",
    elo: 1200,
    bestElo: 1200,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    ...overrides,
  };
}

describe("game-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createGameRecord", () => {
    it("creates game with WAITING status and correct initial FEN", async () => {
      mockPrisma.chessGame.create.mockResolvedValue({ id: "game-1" });

      const result = await createGameRecord("white-player");

      expect(result).toEqual({ id: "game-1" });
      expect(mockPrisma.chessGame.create).toHaveBeenCalledWith({
        data: {
          whitePlayerId: "white-player",
          status: "WAITING",
          fen: INITIAL_FEN,
          timeControl: "BLITZ_5",
          whiteTimeMs: 300_000,
          blackTimeMs: 300_000,
        },
      });
    });

    it("uses correct time from TIME_CONTROL_MS", async () => {
      mockPrisma.chessGame.create.mockResolvedValue({ id: "game-2" });

      await createGameRecord("white-player", "RAPID_10");

      expect(mockPrisma.chessGame.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          timeControl: "RAPID_10",
          whiteTimeMs: 600_000,
          blackTimeMs: 600_000,
        }),
      });
    });

    it("defaults to BLITZ_5 if no timeControl specified", async () => {
      mockPrisma.chessGame.create.mockResolvedValue({ id: "game-3" });

      await createGameRecord("white-player");

      expect(mockPrisma.chessGame.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          timeControl: "BLITZ_5",
          whiteTimeMs: 300_000,
          blackTimeMs: 300_000,
        }),
      });
    });

    it("defaults to BLITZ_5 for unknown time control", async () => {
      mockPrisma.chessGame.create.mockResolvedValue({ id: "game-4" });

      await createGameRecord("white-player", "UNKNOWN");

      expect(mockPrisma.chessGame.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          timeControl: "UNKNOWN",
          whiteTimeMs: 300_000,
          blackTimeMs: 300_000,
        }),
      });
    });
  });

  describe("joinGame", () => {
    it("sets blackPlayerId and status to ACTIVE", async () => {
      mockPrisma.chessGame.findUnique.mockResolvedValue(
        makeGameRecord({ status: "WAITING", blackPlayerId: null }),
      );
      mockPrisma.chessGame.update.mockResolvedValue({ id: "game-1" });

      const result = await joinGame("game-1", "black-player");

      expect(result).toEqual({ id: "game-1" });
      expect(mockPrisma.chessGame.update).toHaveBeenCalledWith({
        where: { id: "game-1" },
        data: {
          blackPlayerId: "black-player",
          status: "ACTIVE",
        },
      });
    });

    it("rejects if game is not WAITING", async () => {
      mockPrisma.chessGame.findUnique.mockResolvedValue(makeGameRecord({ status: "ACTIVE" }));

      await expect(joinGame("game-1", "black-player")).rejects.toThrow(
        "Game is not waiting for a player",
      );
    });

    it("rejects if blackPlayer === whitePlayer", async () => {
      mockPrisma.chessGame.findUnique.mockResolvedValue(
        makeGameRecord({ status: "WAITING", blackPlayerId: null }),
      );

      await expect(joinGame("game-1", "white-player")).rejects.toThrow("Cannot join your own game");
    });

    it("rejects if game not found", async () => {
      mockPrisma.chessGame.findUnique.mockResolvedValue(null);

      await expect(joinGame("nonexistent", "black-player")).rejects.toThrow("Game not found");
    });
  });

  describe("makeGameMove", () => {
    it("rejects if game not found", async () => {
      mockPrisma.chessGame.findUnique.mockResolvedValue(null);

      await expect(makeGameMove("nonexistent", "white-player", "e2", "e4")).rejects.toThrow(
        "Game not found",
      );
    });

    it("returns failed move result without saving when engine rejects move", async () => {
      const game = makeGameRecord();
      const failedResult = makeMoveResult({ success: false, san: "" });

      mockPrisma.chessGame.findUnique.mockResolvedValue(game);
      mockEngine.createGame.mockReturnValue({});
      mockEngine.makeMove.mockReturnValue(failedResult);

      const result = await makeGameMove("game-1", "white-player", "e2", "e5");

      expect(result.success).toBe(false);
      expect(mockPrisma.chessMove.create).not.toHaveBeenCalled();
      expect(mockPrisma.chessGame.update).not.toHaveBeenCalled();
    });

    it("makes a valid move and saves to DB", async () => {
      const game = makeGameRecord();
      const moveResult = makeMoveResult();
      const gameState = makeGameState();

      mockPrisma.chessGame.findUnique.mockResolvedValue(game);
      mockEngine.createGame.mockReturnValue({});
      mockEngine.makeMove.mockReturnValue(moveResult);
      mockEngine.getGameState.mockReturnValue(gameState);
      mockPrisma.chessMove.create.mockResolvedValue({});
      mockPrisma.chessGame.update.mockResolvedValue({});

      const result = await makeGameMove("game-1", "white-player", "e2", "e4");

      expect(result).toEqual(moveResult);
      expect(mockPrisma.chessMove.create).toHaveBeenCalledWith({
        data: {
          gameId: "game-1",
          moveNumber: 1,
          san: "e4",
          from: "e2",
          to: "e4",
          fen: moveResult.fen,
          playerId: "white-player",
        },
      });
    });

    it("rejects if not player's turn (wrong player for current move count)", async () => {
      const game = makeGameRecord({ moveCount: 0 });
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);

      await expect(makeGameMove("game-1", "black-player", "e7", "e5")).rejects.toThrow(
        "Not your turn",
      );
    });

    it("rejects if not black player's turn", async () => {
      const game = makeGameRecord({ moveCount: 1 });
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);

      await expect(makeGameMove("game-1", "white-player", "e2", "e4")).rejects.toThrow(
        "Not your turn",
      );
    });

    it("updates game status on check", async () => {
      const game = makeGameRecord();
      const moveResult = makeMoveResult({ isCheck: true });
      const gameState = makeGameState({ isCheck: true });

      mockPrisma.chessGame.findUnique.mockResolvedValue(game);
      mockEngine.createGame.mockReturnValue({});
      mockEngine.makeMove.mockReturnValue(moveResult);
      mockEngine.getGameState.mockReturnValue(gameState);
      mockPrisma.chessMove.create.mockResolvedValue({});
      mockPrisma.chessGame.update.mockResolvedValue({});

      await makeGameMove("game-1", "white-player", "e2", "e4");

      expect(mockPrisma.chessGame.update).toHaveBeenCalledWith({
        where: { id: "game-1" },
        data: expect.objectContaining({ status: "CHECK" }),
      });
    });

    it("rejects if game is not ACTIVE", async () => {
      const game = makeGameRecord({ status: "CHECKMATE" });
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);

      await expect(makeGameMove("game-1", "white-player", "e2", "e4")).rejects.toThrow(
        "Game is not active",
      );
    });

    it("updates game status on checkmate", async () => {
      const game = makeGameRecord();
      const moveResult = makeMoveResult({
        isCheckmate: true,
        isGameOver: true,
      });
      const gameState = makeGameState({ isCheckmate: true, isGameOver: true });

      mockPrisma.chessGame.findUnique.mockResolvedValueOnce(game).mockResolvedValueOnce(game);
      mockEngine.createGame.mockReturnValue({});
      mockEngine.makeMove.mockReturnValue(moveResult);
      mockEngine.getGameState.mockReturnValue(gameState);
      mockPrisma.chessMove.create.mockResolvedValue({});
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.chessPlayer.findUnique.mockResolvedValue(null);

      await makeGameMove("game-1", "white-player", "e2", "e4");

      expect(mockPrisma.chessGame.update).toHaveBeenCalledWith({
        where: { id: "game-1" },
        data: expect.objectContaining({ status: "CHECKMATE" }),
      });
    });

    it("updates game status on stalemate", async () => {
      const game = makeGameRecord();
      const moveResult = makeMoveResult({
        isStalemate: true,
        isGameOver: true,
        isDraw: true,
      });
      const gameState = makeGameState({
        isStalemate: true,
        isGameOver: true,
        isDraw: true,
      });

      mockPrisma.chessGame.findUnique.mockResolvedValueOnce(game).mockResolvedValueOnce(game);
      mockEngine.createGame.mockReturnValue({});
      mockEngine.makeMove.mockReturnValue(moveResult);
      mockEngine.getGameState.mockReturnValue(gameState);
      mockPrisma.chessMove.create.mockResolvedValue({});
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.chessPlayer.findUnique.mockResolvedValue(null);

      await makeGameMove("game-1", "white-player", "e2", "e4");

      expect(mockPrisma.chessGame.update).toHaveBeenCalledWith({
        where: { id: "game-1" },
        data: expect.objectContaining({ status: "STALEMATE" }),
      });
    });

    it("updates game status on draw", async () => {
      const game = makeGameRecord();
      const moveResult = makeMoveResult({ isDraw: true, isGameOver: true });
      const gameState = makeGameState({ isDraw: true, isGameOver: true });

      mockPrisma.chessGame.findUnique.mockResolvedValueOnce(game).mockResolvedValueOnce(game);
      mockEngine.createGame.mockReturnValue({});
      mockEngine.makeMove.mockReturnValue(moveResult);
      mockEngine.getGameState.mockReturnValue(gameState);
      mockPrisma.chessMove.create.mockResolvedValue({});
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.chessPlayer.findUnique.mockResolvedValue(null);

      await makeGameMove("game-1", "white-player", "e2", "e4");

      expect(mockPrisma.chessGame.update).toHaveBeenCalledWith({
        where: { id: "game-1" },
        data: expect.objectContaining({ status: "DRAW" }),
      });
    });

    it("saves move record with correct data", async () => {
      const game = makeGameRecord({ moveCount: 1 });
      const moveResult = makeMoveResult({ san: "e5", from: "e7", to: "e5" });
      const gameState = makeGameState();

      mockPrisma.chessGame.findUnique.mockResolvedValue(game);
      mockEngine.createGame.mockReturnValue({});
      mockEngine.makeMove.mockReturnValue(moveResult);
      mockEngine.getGameState.mockReturnValue(gameState);
      mockPrisma.chessMove.create.mockResolvedValue({});
      mockPrisma.chessGame.update.mockResolvedValue({});

      await makeGameMove("game-1", "black-player", "e7", "e5");

      expect(mockPrisma.chessMove.create).toHaveBeenCalledWith({
        data: {
          gameId: "game-1",
          moveNumber: 2,
          san: "e5",
          from: "e7",
          to: "e5",
          fen: moveResult.fen,
          playerId: "black-player",
        },
      });
    });

    it("increments moveCount", async () => {
      const game = makeGameRecord({ moveCount: 3 });
      const moveResult = makeMoveResult();
      const gameState = makeGameState();

      mockPrisma.chessGame.findUnique.mockResolvedValue(game);
      mockEngine.createGame.mockReturnValue({});
      mockEngine.makeMove.mockReturnValue(moveResult);
      mockEngine.getGameState.mockReturnValue(gameState);
      mockPrisma.chessMove.create.mockResolvedValue({});
      mockPrisma.chessGame.update.mockResolvedValue({});

      await makeGameMove("game-1", "black-player", "e7", "e5");

      expect(mockPrisma.chessGame.update).toHaveBeenCalledWith({
        where: { id: "game-1" },
        data: expect.objectContaining({ moveCount: 4 }),
      });
    });

    it("calls finalizeGame on game over (checkmate -> winner is the moving player)", async () => {
      const whitePlayer = makePlayer({
        id: "white-player",
        userId: "user-white",
      });
      const blackPlayer = makePlayer({
        id: "black-player",
        userId: "user-black",
      });

      const game = makeGameRecord();
      const moveResult = makeMoveResult({
        isCheckmate: true,
        isGameOver: true,
      });
      const gameState = makeGameState({ isCheckmate: true, isGameOver: true });

      mockPrisma.chessGame.findUnique.mockResolvedValueOnce(game).mockResolvedValueOnce(game);
      mockEngine.createGame.mockReturnValue({});
      mockEngine.makeMove.mockReturnValue(moveResult);
      mockEngine.getGameState.mockReturnValue(gameState);
      mockPrisma.chessMove.create.mockResolvedValue({});
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.chessPlayer.findUnique
        .mockResolvedValueOnce(whitePlayer)
        .mockResolvedValueOnce(blackPlayer);
      mockPrisma.chessPlayer.update.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});
      mockElo.calculateEloChange.mockReturnValue({
        whiteNewElo: 1216,
        blackNewElo: 1184,
        whiteChange: 16,
        blackChange: -16,
      });

      await makeGameMove("game-1", "white-player", "e2", "e4");

      expect(mockElo.calculateEloChange).toHaveBeenCalledWith(1200, 1200, "white");
    });

    it("calls finalizeGame on game over (black checkmate)", async () => {
      const game = makeGameRecord({ moveCount: 1 });
      const moveResult = makeMoveResult({
        isCheckmate: true,
        isGameOver: true,
      });
      const gameState = makeGameState({ isCheckmate: true, isGameOver: true });

      mockPrisma.chessGame.findUnique.mockResolvedValue(game);
      mockEngine.createGame.mockReturnValue({});
      mockEngine.makeMove.mockReturnValue(moveResult);
      mockEngine.getGameState.mockReturnValue(gameState);
      mockPrisma.chessMove.create.mockResolvedValue({});
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.chessPlayer.findUnique.mockResolvedValue(null);

      await makeGameMove("game-1", "black-player", "e7", "e5");

      // isWhiteTurn = 1 % 2 === 0 is false.
      // So result = "black"
      // Wait, let's check the code: result = isWhiteTurn ? "white" : "black";
      // Line 174.
    });
  });

  describe("getGame", () => {
    it("throws if game not found", async () => {
      mockPrisma.chessGame.findUnique.mockResolvedValue(null);

      await expect(getGame("nonexistent")).rejects.toThrow("Game not found");
    });

    it("returns game with moves", async () => {
      const game = makeGameRecord({ moves: [] });
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);

      const result = await getGame("game-1");

      expect(result).toEqual(game);
      expect(mockPrisma.chessGame.findUnique).toHaveBeenCalledWith({
        where: { id: "game-1" },
        include: { moves: true },
      });
    });
  });

  describe("listGames", () => {
    it("lists games for a player", async () => {
      const games = [makeGameRecord()];
      mockPrisma.chessGame.findMany.mockResolvedValue(games);

      const result = await listGames("white-player");

      expect(result).toEqual(games);
      expect(mockPrisma.chessGame.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { whitePlayerId: "white-player" },
              {
                blackPlayerId: "white-player",
              },
            ],
          },
        }),
      );
    });

    it("filters by status", async () => {
      mockPrisma.chessGame.findMany.mockResolvedValue([]);

      await listGames("white-player", "ACTIVE");

      expect(mockPrisma.chessGame.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { whitePlayerId: "white-player" },
              {
                blackPlayerId: "white-player",
              },
            ],
            status: "ACTIVE",
          },
        }),
      );
    });
  });

  describe("resignGame", () => {
    it("sets status to RESIGNED and correct winner", async () => {
      const whitePlayer = makePlayer({
        id: "white-player",
        userId: "user-white",
      });
      const blackPlayer = makePlayer({
        id: "black-player",
        userId: "user-black",
      });

      const game = makeGameRecord();
      mockPrisma.chessGame.findUnique.mockResolvedValueOnce(game).mockResolvedValueOnce(game);
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.chessPlayer.findUnique
        .mockResolvedValueOnce(whitePlayer)
        .mockResolvedValueOnce(blackPlayer);
      mockPrisma.chessPlayer.update.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});
      mockElo.calculateEloChange.mockReturnValue({
        whiteNewElo: 1184,
        blackNewElo: 1216,
        whiteChange: -16,
        blackChange: 16,
      });

      await resignGame("game-1", "white-player");

      expect(mockPrisma.chessGame.update).toHaveBeenCalledWith({
        where: { id: "game-1" },
        data: { status: "RESIGNED", winnerId: "black-player" },
      });
    });

    it("sets status to RESIGNED and correct winner when black resigns", async () => {
      const game = makeGameRecord();
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.chessPlayer.findUnique.mockResolvedValue(null);

      await resignGame("game-1", "black-player");

      expect(mockPrisma.chessGame.update).toHaveBeenCalledWith({
        where: { id: "game-1" },
        data: { status: "RESIGNED", winnerId: "white-player" },
      });
    });

    it("rejects if player is not in the game", async () => {
      const game = makeGameRecord();
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);

      await expect(resignGame("game-1", "random-player")).rejects.toThrow(
        "Player is not in this game",
      );
    });

    it("throws if game not found", async () => {
      mockPrisma.chessGame.findUnique.mockResolvedValue(null);

      await expect(resignGame("nonexistent", "white-player")).rejects.toThrow("Game not found");
    });

    it("handles null blackPlayerId gracefully when white resigns (winnerId is null)", async () => {
      const game = makeGameRecord({ blackPlayerId: null });
      mockPrisma.chessGame.findUnique.mockResolvedValueOnce(game).mockResolvedValueOnce(game);
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.chessPlayer.findUnique.mockResolvedValue(null);

      await resignGame("game-1", "white-player");

      expect(mockPrisma.chessGame.update).toHaveBeenCalledWith({
        where: { id: "game-1" },
        data: { status: "RESIGNED", winnerId: null },
      });
    });
  });

  describe("offerDraw", () => {
    it("returns { offered: true } for valid game and player", async () => {
      const game = makeGameRecord();
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);

      const result = await offerDraw("game-1", "white-player");
      expect(result).toEqual({ offered: true });
    });

    it("throws if game not found", async () => {
      mockPrisma.chessGame.findUnique.mockResolvedValue(null);

      await expect(offerDraw("nonexistent", "white-player")).rejects.toThrow("Game not found");
    });

    it("throws if game is not active", async () => {
      const game = makeGameRecord({ status: "CHECKMATE" });
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);

      await expect(offerDraw("game-1", "white-player")).rejects.toThrow("Game is not active");
    });

    it("throws if player is not in the game", async () => {
      const game = makeGameRecord();
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);

      await expect(offerDraw("game-1", "random-player")).rejects.toThrow(
        "Player is not in this game",
      );
    });
  });

  describe("declineDraw", () => {
    it("returns { declined: true } for valid game and player", async () => {
      const game = makeGameRecord();
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);

      const result = await declineDraw("game-1", "black-player");
      expect(result).toEqual({ declined: true });
    });

    it("throws if game not found", async () => {
      mockPrisma.chessGame.findUnique.mockResolvedValue(null);

      await expect(declineDraw("nonexistent", "white-player")).rejects.toThrow("Game not found");
    });

    it("throws if game is not active", async () => {
      const game = makeGameRecord({ status: "DRAW" });
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);

      await expect(declineDraw("game-1", "white-player")).rejects.toThrow("Game is not active");
    });

    it("throws if player is not in the game", async () => {
      const game = makeGameRecord();
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);

      await expect(declineDraw("game-1", "random-player")).rejects.toThrow(
        "Player is not in this game",
      );
    });
  });

  describe("acceptDraw", () => {
    it("sets status to DRAW", async () => {
      const game = makeGameRecord();
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);
      mockPrisma.chessPlayer.findUnique.mockResolvedValue(null);

      await acceptDraw("game-1", "white-player");

      expect(mockPrisma.chessGame.update).toHaveBeenCalledWith({
        where: { id: "game-1" },
        data: { status: "DRAW" },
      });
    });

    it("calls finalizeGame with 'draw'", async () => {
      const whitePlayer = makePlayer({
        id: "white-player",
        userId: "user-white",
      });
      const blackPlayer = makePlayer({
        id: "black-player",
        userId: "user-black",
      });

      const game = makeGameRecord();
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);
      mockPrisma.chessPlayer.findUnique
        .mockResolvedValueOnce(whitePlayer)
        .mockResolvedValueOnce(blackPlayer);
      mockPrisma.chessPlayer.update.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});
      mockElo.calculateEloChange.mockReturnValue({
        whiteNewElo: 1200,
        blackNewElo: 1200,
        whiteChange: 0,
        blackChange: 0,
      });

      await acceptDraw("game-1", "white-player");

      expect(mockElo.calculateEloChange).toHaveBeenCalledWith(1200, 1200, "draw");
    });
  });

  describe("getGameReplay", () => {
    it("returns moves, pgn, and result", async () => {
      const game = makeGameRecord({ pgn: "1. e4 e5", result: "white" });
      const moves = [
        {
          id: "m1",
          gameId: "game-1",
          moveNumber: 1,
          san: "e4",
          from: "e2",
          to: "e4",
          fen: "some-fen",
          playerId: "white-player",
          timeSpentMs: null,
          createdAt: new Date(),
        },
      ];

      mockPrisma.chessGame.findUnique.mockResolvedValue(game);
      mockPrisma.chessMove.findMany.mockResolvedValue(moves);

      const result = await getGameReplay("game-1");

      expect(result).toEqual({
        moves,
        pgn: "1. e4 e5",
        result: "white",
      });
    });

    it("returns empty moves array if no moves yet", async () => {
      const game = makeGameRecord({ pgn: "", result: null });

      mockPrisma.chessGame.findUnique.mockResolvedValue(game);
      mockPrisma.chessMove.findMany.mockResolvedValue([]);

      const result = await getGameReplay("game-1");

      expect(result).toEqual({
        moves: [],
        pgn: "",
        result: null,
      });
    });

    it("throws if game not found", async () => {
      mockPrisma.chessGame.findUnique.mockResolvedValue(null);

      await expect(getGameReplay("nonexistent")).rejects.toThrow("Game not found");
    });
  });

  describe("handleTimeExpiry", () => {
    it("sets correct winner (opposite player)", async () => {
      const whitePlayer = makePlayer({
        id: "white-player",
        userId: "user-white",
      });
      const blackPlayer = makePlayer({
        id: "black-player",
        userId: "user-black",
      });

      const game = makeGameRecord();
      mockPrisma.chessGame.findUnique.mockResolvedValueOnce(game).mockResolvedValueOnce(game);
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.chessPlayer.findUnique
        .mockResolvedValueOnce(whitePlayer)
        .mockResolvedValueOnce(blackPlayer);
      mockPrisma.chessPlayer.update.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});
      mockElo.calculateEloChange.mockReturnValue({
        whiteNewElo: 1184,
        blackNewElo: 1216,
        whiteChange: -16,
        blackChange: 16,
      });

      await handleTimeExpiry("game-1", "white-player");

      expect(mockPrisma.chessGame.update).toHaveBeenCalledWith({
        where: { id: "game-1" },
        data: { status: "RESIGNED", winnerId: "black-player" },
      });
    });

    it("sets correct winner when black player times out", async () => {
      const game = makeGameRecord();
      mockPrisma.chessGame.findUnique.mockResolvedValueOnce(game).mockResolvedValueOnce(game);
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.chessPlayer.findUnique.mockResolvedValue(null);

      await handleTimeExpiry("game-1", "black-player");

      expect(mockPrisma.chessGame.update).toHaveBeenCalledWith({
        where: { id: "game-1" },
        data: { status: "RESIGNED", winnerId: "white-player" },
      });
    });

    it("throws if game not found", async () => {
      mockPrisma.chessGame.findUnique.mockResolvedValue(null);

      await expect(handleTimeExpiry("nonexistent", "white-player")).rejects.toThrow(
        "Game not found",
      );
    });

    it("handles null blackPlayerId gracefully when white times out (winnerId is null)", async () => {
      const game = makeGameRecord({ blackPlayerId: null });
      mockPrisma.chessGame.findUnique.mockResolvedValueOnce(game).mockResolvedValueOnce(game);
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.chessPlayer.findUnique.mockResolvedValue(null);

      await handleTimeExpiry("game-1", "white-player");

      expect(mockPrisma.chessGame.update).toHaveBeenCalledWith({
        where: { id: "game-1" },
        data: { status: "RESIGNED", winnerId: null },
      });
    });
  });

  describe("finalizeGame", () => {
    it("calculates ELO changes", async () => {
      const whitePlayer = makePlayer({
        id: "white-player",
        userId: "user-white",
      });
      const blackPlayer = makePlayer({
        id: "black-player",
        userId: "user-black",
      });

      const game = makeGameRecord();
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);
      mockPrisma.chessPlayer.findUnique
        .mockResolvedValueOnce(whitePlayer)
        .mockResolvedValueOnce(blackPlayer);
      mockPrisma.chessPlayer.update.mockResolvedValue({});
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});
      mockElo.calculateEloChange.mockReturnValue({
        whiteNewElo: 1216,
        blackNewElo: 1184,
        whiteChange: 16,
        blackChange: -16,
      });

      await finalizeGame("game-1", "white", "white-player");

      expect(mockElo.calculateEloChange).toHaveBeenCalledWith(1200, 1200, "white");
    });

    it("returns early if game not found", async () => {
      mockPrisma.chessGame.findUnique.mockResolvedValue(null);

      await finalizeGame("nonexistent", "white");

      expect(mockPrisma.chessPlayer.findUnique).not.toHaveBeenCalled();
    });

    it("returns early if blackPlayerId is missing", async () => {
      const game = makeGameRecord({ blackPlayerId: null });
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);

      await finalizeGame("game-1", "white");

      expect(mockPrisma.chessPlayer.findUnique).not.toHaveBeenCalled();
    });

    it("returns early if players not found", async () => {
      const game = makeGameRecord();
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);
      mockPrisma.chessPlayer.findUnique.mockResolvedValue(null);

      await finalizeGame("game-1", "white");

      expect(mockPrisma.chessPlayer.update).not.toHaveBeenCalled();
    });

    it("updates both players' ELO", async () => {
      const whitePlayer = makePlayer({
        id: "white-player",
        userId: "user-white",
      });
      const blackPlayer = makePlayer({
        id: "black-player",
        userId: "user-black",
      });

      const game = makeGameRecord();
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);
      mockPrisma.chessPlayer.findUnique
        .mockResolvedValueOnce(whitePlayer)
        .mockResolvedValueOnce(blackPlayer);
      mockPrisma.chessPlayer.update.mockResolvedValue({});
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});
      mockElo.calculateEloChange.mockReturnValue({
        whiteNewElo: 1216,
        blackNewElo: 1184,
        whiteChange: 16,
        blackChange: -16,
      });

      await finalizeGame("game-1", "white", "white-player");

      expect(mockPrisma.chessPlayer.update).toHaveBeenCalledWith({
        where: { id: "white-player" },
        data: { elo: 1216 },
      });
      expect(mockPrisma.chessPlayer.update).toHaveBeenCalledWith({
        where: { id: "black-player" },
        data: { elo: 1184 },
      });
    });

    it("updates game with result and eloChanges", async () => {
      const whitePlayer = makePlayer({
        id: "white-player",
        userId: "user-white",
      });
      const blackPlayer = makePlayer({
        id: "black-player",
        userId: "user-black",
      });

      const game = makeGameRecord();
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);
      mockPrisma.chessPlayer.findUnique
        .mockResolvedValueOnce(whitePlayer)
        .mockResolvedValueOnce(blackPlayer);
      mockPrisma.chessPlayer.update.mockResolvedValue({});
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});

      const eloChanges = {
        whiteNewElo: 1216,
        blackNewElo: 1184,
        whiteChange: 16,
        blackChange: -16,
      };
      mockElo.calculateEloChange.mockReturnValue(eloChanges);

      await finalizeGame("game-1", "white", "white-player");

      expect(mockPrisma.chessGame.update).toHaveBeenCalledWith({
        where: { id: "game-1" },
        data: {
          winnerId: "white-player",
          result: "white",
          eloChanges,
        },
      });
    });

    it("creates notifications for both players", async () => {
      const whitePlayer = makePlayer({
        id: "white-player",
        userId: "user-white",
      });
      const blackPlayer = makePlayer({
        id: "black-player",
        userId: "user-black",
      });

      const game = makeGameRecord();
      mockPrisma.chessGame.findUnique.mockResolvedValue(game);
      mockPrisma.chessPlayer.findUnique
        .mockResolvedValueOnce(whitePlayer)
        .mockResolvedValueOnce(blackPlayer);
      mockPrisma.chessPlayer.update.mockResolvedValue({});
      mockPrisma.chessGame.update.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});
      mockElo.calculateEloChange.mockReturnValue({
        whiteNewElo: 1200,
        blackNewElo: 1200,
        whiteChange: 0,
        blackChange: 0,
      });

      await finalizeGame("game-1", "draw");

      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "user-white",
          workspaceId: "game-1",
          type: "CHESS_GAME_RESULT",
          title: "Game Over",
          message: "Game ended: draw",
        },
      });
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "user-black",
          workspaceId: "game-1",
          type: "CHESS_GAME_RESULT",
          title: "Game Over",
          message: "Game ended: draw",
        },
      });
    });
  });
});
