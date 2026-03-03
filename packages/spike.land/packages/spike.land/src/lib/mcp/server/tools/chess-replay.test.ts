import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGameManager = vi.hoisted(() => ({
  getGameReplay: vi.fn(),
}));

vi.mock("@/lib/chess/game-manager", () => mockGameManager);

const mockPrisma = vi.hoisted(() => ({
  chessPlayer: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerChessReplayTools } from "./chess-replay";

describe("chess-replay tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerChessReplayTools(registry, userId);
  });

  it("should register 2 chess replay tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(2);
    expect(registry.handlers.has("chess_replay_game")).toBe(true);
    expect(registry.handlers.has("chess_get_leaderboard")).toBe(true);
  });

  describe("chess_replay_game", () => {
    it("should return game replay", async () => {
      mockGameManager.getGameReplay.mockResolvedValue({
        moves: [
          { moveNumber: 1, san: "e4" },
          { moveNumber: 2, san: "e5" },
        ],
        pgn: "1. e4 e5",
        result: "white",
      });
      const handler = registry.handlers.get("chess_replay_game")!;
      const result = await handler({ game_id: "game-1" });
      const text = getText(result);
      expect(text).toContain("Game Replay");
      expect(text).toContain("1. e4");
      expect(text).toContain("2. e5");
      expect(text).toContain("white");
    });

    it("should handle game with no moves", async () => {
      mockGameManager.getGameReplay.mockResolvedValue({
        moves: [],
        pgn: "",
        result: null,
      });
      const handler = registry.handlers.get("chess_replay_game")!;
      const result = await handler({ game_id: "game-1" });
      const text = getText(result);
      expect(text).toContain("No moves");
    });
  });

  describe("chess_get_leaderboard", () => {
    it("should return leaderboard", async () => {
      mockPrisma.chessPlayer.findMany.mockResolvedValue([
        { name: "Magnus", elo: 2800, wins: 100, losses: 10, draws: 20 },
        { name: "Bobby", elo: 2700, wins: 90, losses: 15, draws: 15 },
      ]);
      const handler = registry.handlers.get("chess_get_leaderboard")!;
      const result = await handler({ limit: 10 });
      const text = getText(result);
      expect(text).toContain("Leaderboard");
      expect(text).toContain("Magnus");
      expect(text).toContain("2800");
      expect(text).toContain("Bobby");
    });

    it("should handle empty leaderboard", async () => {
      mockPrisma.chessPlayer.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("chess_get_leaderboard")!;
      const result = await handler({ limit: 10 });
      expect(getText(result)).toContain("No players on the leaderboard");
    });
  });
});
