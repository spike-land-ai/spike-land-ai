import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPlayerManager = vi.hoisted(() => ({
  createPlayer: vi.fn(),
  getPlayer: vi.fn(),
  getPlayersByUser: vi.fn(),
  updatePlayer: vi.fn(),
  getPlayerStats: vi.fn(),
  listOnlinePlayers: vi.fn(),
}));

vi.mock("@/lib/chess/player-manager", () => mockPlayerManager);

import { createMockRegistry, getText } from "../__test-utils__";
import { registerChessPlayerTools } from "./chess-player";

describe("chess-player tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerChessPlayerTools(registry, userId);
  });

  it("should register 6 chess player tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(6);
    expect(registry.handlers.has("chess_create_player")).toBe(true);
    expect(registry.handlers.has("chess_get_player")).toBe(true);
    expect(registry.handlers.has("chess_list_profiles")).toBe(true);
    expect(registry.handlers.has("chess_update_player")).toBe(true);
    expect(registry.handlers.has("chess_get_stats")).toBe(true);
    expect(registry.handlers.has("chess_list_online")).toBe(true);
  });

  describe("chess_create_player", () => {
    it("should create a player profile", async () => {
      mockPlayerManager.createPlayer.mockResolvedValue({
        id: "player-1",
        name: "Magnus",
        elo: 1200,
      });
      const handler = registry.handlers.get("chess_create_player")!;
      const result = await handler({ name: "Magnus" });
      const text = getText(result);
      expect(text).toContain("Player Created");
      expect(text).toContain("Magnus");
      expect(text).toContain("1200");
      expect(mockPlayerManager.createPlayer).toHaveBeenCalledWith(
        userId,
        "Magnus",
        undefined,
      );
    });

    it("should pass avatar when provided", async () => {
      mockPlayerManager.createPlayer.mockResolvedValue({
        id: "player-1",
        name: "Bobby",
        elo: 1200,
      });
      const handler = registry.handlers.get("chess_create_player")!;
      await handler({ name: "Bobby", avatar: "https://img.com/bobby.png" });
      expect(mockPlayerManager.createPlayer).toHaveBeenCalledWith(
        userId,
        "Bobby",
        "https://img.com/bobby.png",
      );
    });
  });

  describe("chess_get_player", () => {
    it("should return player info", async () => {
      mockPlayerManager.getPlayer.mockResolvedValue({
        id: "p1",
        name: "Magnus",
        elo: 2800,
        isOnline: true,
      });
      const handler = registry.handlers.get("chess_get_player")!;
      const result = await handler({ player_id: "p1" });
      const text = getText(result);
      expect(text).toContain("Magnus");
      expect(text).toContain("2800");
    });

    it("should handle player not found", async () => {
      mockPlayerManager.getPlayer.mockResolvedValue(null);
      const handler = registry.handlers.get("chess_get_player")!;
      const result = await handler({ player_id: "nonexistent" });
      expect(getText(result)).toContain("Player not found");
    });
  });

  describe("chess_list_profiles", () => {
    it("should list profiles", async () => {
      mockPlayerManager.getPlayersByUser.mockResolvedValue([
        { id: "p1", name: "Profile A", elo: 1200 },
        { id: "p2", name: "Profile B", elo: 1500 },
      ]);
      const handler = registry.handlers.get("chess_list_profiles")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Your Profiles (2)");
      expect(text).toContain("Profile A");
      expect(text).toContain("Profile B");
    });

    it("should handle no profiles", async () => {
      mockPlayerManager.getPlayersByUser.mockResolvedValue([]);
      const handler = registry.handlers.get("chess_list_profiles")!;
      const result = await handler({});
      expect(getText(result)).toContain("No profiles found");
    });
  });

  describe("chess_update_player", () => {
    it("should update player", async () => {
      mockPlayerManager.updatePlayer.mockResolvedValue({
        name: "NewName",
        soundEnabled: false,
      });
      const handler = registry.handlers.get("chess_update_player")!;
      const result = await handler({
        player_id: "p1",
        name: "NewName",
        sound_enabled: false,
      });
      const text = getText(result);
      expect(text).toContain("Player Updated");
      expect(text).toContain("NewName");
    });
  });

  describe("chess_get_stats", () => {
    it("should return player stats", async () => {
      mockPlayerManager.getPlayerStats.mockResolvedValue({
        elo: 1500,
        bestElo: 1600,
        wins: 20,
        losses: 10,
        draws: 5,
        totalGames: 35,
        winRate: 0.571,
        streak: 3,
      });
      const handler = registry.handlers.get("chess_get_stats")!;
      const result = await handler({ player_id: "p1" });
      const text = getText(result);
      expect(text).toContain("1500");
      expect(text).toContain("1600");
      expect(text).toContain("20W");
      expect(text).toContain("57.1%");
    });
  });

  describe("chess_list_online", () => {
    it("should list online players", async () => {
      mockPlayerManager.listOnlinePlayers.mockResolvedValue([
        { id: "p1", name: "Alice", elo: 1300 },
      ]);
      const handler = registry.handlers.get("chess_list_online")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Online Players (1)");
      expect(text).toContain("Alice");
    });

    it("should handle no online players", async () => {
      mockPlayerManager.listOnlinePlayers.mockResolvedValue([]);
      const handler = registry.handlers.get("chess_list_online")!;
      const result = await handler({});
      expect(getText(result)).toContain("No players online");
    });
  });
});
