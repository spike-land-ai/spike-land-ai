import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGameManager = vi.hoisted(() => ({
  createGameRecord: vi.fn(),
  joinGame: vi.fn(),
  makeGameMove: vi.fn(),
  getGame: vi.fn(),
  listGames: vi.fn(),
  resignGame: vi.fn(),
  offerDraw: vi.fn(),
  acceptDraw: vi.fn(),
  declineDraw: vi.fn(),
}));

vi.mock("@/lib/chess/game-manager", () => mockGameManager);

import { createMockRegistry, getText } from "../__test-utils__";
import { registerChessGameTools } from "./chess-game";

describe("chess-game tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerChessGameTools(registry, userId);
  });

  it("should register 9 chess game tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(9);
    expect(registry.handlers.has("chess_create_game")).toBe(true);
    expect(registry.handlers.has("chess_join_game")).toBe(true);
    expect(registry.handlers.has("chess_make_move")).toBe(true);
    expect(registry.handlers.has("chess_get_game")).toBe(true);
    expect(registry.handlers.has("chess_list_games")).toBe(true);
    expect(registry.handlers.has("chess_resign")).toBe(true);
    expect(registry.handlers.has("chess_offer_draw")).toBe(true);
    expect(registry.handlers.has("chess_accept_draw")).toBe(true);
    expect(registry.handlers.has("chess_decline_draw")).toBe(true);
  });

  describe("chess_create_game", () => {
    it("should create a game", async () => {
      mockGameManager.createGameRecord.mockResolvedValue({ id: "game-1" });
      const handler = registry.handlers.get("chess_create_game")!;
      const result = await handler({
        player_id: "p1",
        time_control: "BLITZ_5",
      });
      const text = getText(result);
      expect(text).toContain("Game Created");
      expect(text).toContain("game-1");
      expect(text).toContain("BLITZ_5");
    });
  });

  describe("chess_join_game", () => {
    it("should join a game", async () => {
      mockGameManager.joinGame.mockResolvedValue({ id: "game-1" });
      const handler = registry.handlers.get("chess_join_game")!;
      const result = await handler({ game_id: "game-1", player_id: "p2" });
      const text = getText(result);
      expect(text).toContain("Game Joined");
      expect(text).toContain("ACTIVE");
    });
  });

  describe("chess_make_move", () => {
    it("should make a valid move", async () => {
      mockGameManager.makeGameMove.mockResolvedValue({
        success: true,
        san: "e4",
        from: "e2",
        to: "e4",
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        isCheck: false,
        isCheckmate: false,
        isStalemate: false,
        isDraw: false,
        isGameOver: false,
      });
      const handler = registry.handlers.get("chess_make_move")!;
      const result = await handler({
        game_id: "game-1",
        player_id: "p1",
        from: "e2",
        to: "e4",
      });
      const text = getText(result);
      expect(text).toContain("e4");
      expect(text).toContain("e2");
    });

    it("should handle invalid move", async () => {
      mockGameManager.makeGameMove.mockResolvedValue({ success: false });
      const handler = registry.handlers.get("chess_make_move")!;
      const result = await handler({
        game_id: "game-1",
        player_id: "p1",
        from: "e2",
        to: "e5",
      });
      const text = getText(result);
      expect(text).toContain("Invalid Move");
    });

    it("should show draw (not stalemate)", async () => {
      mockGameManager.makeGameMove.mockResolvedValue({
        success: true,
        san: "Kd2",
        from: "e1",
        to: "d2",
        fen: "some-fen",
        isCheck: false,
        isCheckmate: false,
        isStalemate: false,
        isDraw: true,
        isGameOver: true,
      });
      const handler = registry.handlers.get("chess_make_move")!;
      const result = await handler({
        game_id: "game-1",
        player_id: "p1",
        from: "e1",
        to: "d2",
      });
      const text = getText(result);
      expect(text).toContain("Draw");
      expect(text).not.toContain("CHECKMATE");
      expect(text).not.toContain("Stalemate");
    });

    it("should show stalemate", async () => {
      mockGameManager.makeGameMove.mockResolvedValue({
        success: true,
        san: "Qg6",
        from: "f5",
        to: "g6",
        fen: "some-fen",
        isCheck: false,
        isCheckmate: false,
        isStalemate: true,
        isDraw: false,
        isGameOver: true,
      });
      const handler = registry.handlers.get("chess_make_move")!;
      const result = await handler({
        game_id: "game-1",
        player_id: "p1",
        from: "f5",
        to: "g6",
      });
      const text = getText(result);
      expect(text).toContain("Stalemate");
      expect(text).not.toContain("CHECKMATE");
    });

    it("should show check", async () => {
      mockGameManager.makeGameMove.mockResolvedValue({
        success: true,
        san: "Bb5+",
        from: "f1",
        to: "b5",
        fen: "some-fen",
        isCheck: true,
        isCheckmate: false,
        isStalemate: false,
        isDraw: false,
        isGameOver: false,
      });
      const handler = registry.handlers.get("chess_make_move")!;
      const result = await handler({
        game_id: "game-1",
        player_id: "p1",
        from: "f1",
        to: "b5",
      });
      const text = getText(result);
      expect(text).toContain("Check!");
      expect(text).not.toContain("CHECKMATE");
    });

    it("should show captured piece", async () => {
      mockGameManager.makeGameMove.mockResolvedValue({
        success: true,
        san: "Nxe5",
        from: "c4",
        to: "e5",
        fen: "some-fen",
        isCheck: false,
        isCheckmate: false,
        isStalemate: false,
        isDraw: false,
        isGameOver: false,
        captured: "p",
      });
      const handler = registry.handlers.get("chess_make_move")!;
      const result = await handler({
        game_id: "game-1",
        player_id: "p1",
        from: "c4",
        to: "e5",
      });
      const text = getText(result);
      expect(text).toContain("Captured:** p");
    });

    it("should show checkmate", async () => {
      mockGameManager.makeGameMove.mockResolvedValue({
        success: true,
        san: "Qxf7#",
        from: "h5",
        to: "f7",
        fen: "some-fen",
        isCheck: true,
        isCheckmate: true,
        isStalemate: false,
        isDraw: false,
        isGameOver: true,
      });
      const handler = registry.handlers.get("chess_make_move")!;
      const result = await handler({
        game_id: "game-1",
        player_id: "p1",
        from: "h5",
        to: "f7",
      });
      const text = getText(result);
      expect(text).toContain("CHECKMATE");
    });
  });

  describe("chess_get_game", () => {
    it("should return game state", async () => {
      mockGameManager.getGame.mockResolvedValue({
        id: "game-1",
        status: "ACTIVE",
        fen: "some-fen",
        timeControl: "BLITZ_5",
        moves: [{ moveNumber: 1, san: "e4" }],
      });
      const handler = registry.handlers.get("chess_get_game")!;
      const result = await handler({ game_id: "game-1" });
      const text = getText(result);
      expect(text).toContain("Chess Game");
      expect(text).toContain("ACTIVE");
      expect(text).toContain("1. e4");
    });
  });

  describe("chess_list_games", () => {
    it("should list games", async () => {
      mockGameManager.listGames.mockResolvedValue([
        { id: "g1", status: "ACTIVE", moveCount: 5 },
        { id: "g2", status: "CHECKMATE", moveCount: 30 },
      ]);
      const handler = registry.handlers.get("chess_list_games")!;
      const result = await handler({ player_id: "p1" });
      const text = getText(result);
      expect(text).toContain("Your Games (2)");
      expect(text).toContain("g1");
      expect(text).toContain("g2");
    });

    it("should handle no games", async () => {
      mockGameManager.listGames.mockResolvedValue([]);
      const handler = registry.handlers.get("chess_list_games")!;
      const result = await handler({ player_id: "p1" });
      expect(getText(result)).toContain("No games found");
    });
  });

  describe("chess_resign", () => {
    it("should resign from a game", async () => {
      mockGameManager.resignGame.mockResolvedValue(undefined);
      const handler = registry.handlers.get("chess_resign")!;
      const result = await handler({ game_id: "game-1", player_id: "p1" });
      expect(getText(result)).toContain("Game Resigned");
    });
  });

  describe("chess_offer_draw", () => {
    it("should offer a draw", async () => {
      mockGameManager.offerDraw.mockResolvedValue({ offered: true });
      const handler = registry.handlers.get("chess_offer_draw")!;
      const result = await handler({ game_id: "game-1", player_id: "p1" });
      expect(getText(result)).toContain("Draw Offered");
    });
  });

  describe("chess_accept_draw", () => {
    it("should accept a draw", async () => {
      mockGameManager.acceptDraw.mockResolvedValue(undefined);
      const handler = registry.handlers.get("chess_accept_draw")!;
      const result = await handler({ game_id: "game-1", player_id: "p1" });
      expect(getText(result)).toContain("Draw Accepted");
    });
  });

  describe("chess_decline_draw", () => {
    it("should decline a draw", async () => {
      mockGameManager.declineDraw.mockResolvedValue({ declined: true });
      const handler = registry.handlers.get("chess_decline_draw")!;
      const result = await handler({ game_id: "game-1", player_id: "p1" });
      expect(getText(result)).toContain("Draw Declined");
    });
  });
});
