/**
 * Chess Arena — Standalone Tool Tests
 */

import { describe, expect, it } from "vitest";
import { chessArenaTools } from "./tools";
import { createMockRegistry } from "../shared/test-utils";

describe("chess-arena tools", () => {
  const registry = createMockRegistry(chessArenaTools);

  it("exports all 27 chess tools", () => {
    expect(chessArenaTools).toHaveLength(27);
  });

  it("has unique tool names", () => {
    const names = chessArenaTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("all tool names start with chess_", () => {
    for (const tool of chessArenaTools) {
      expect(tool.name).toMatch(/^chess_/);
    }
  });

  it("all tools have tier set to free", () => {
    for (const tool of chessArenaTools) {
      expect(tool.tier).toBe("free");
    }
  });

  it("registry can list all tool names", () => {
    const names = registry.getToolNames();
    expect(names).toHaveLength(27);
    expect(names).toContain("chess_create_game");
    expect(names).toContain("chess_make_move");
    expect(names).toContain("chess_create_player");
    expect(names).toContain("chess_send_challenge");
    expect(names).toContain("chess_replay_game");
    expect(names).toContain("chess_create_tournament");
    expect(names).toContain("chess_get_puzzle");
  });

  describe("categories", () => {
    it("has chess-game tools", () => {
      const gameTools = registry.getToolsByCategory("chess-game");
      expect(gameTools).toHaveLength(9);
    });

    it("has chess-player tools", () => {
      const playerTools = registry.getToolsByCategory("chess-player");
      expect(playerTools).toHaveLength(6);
    });

    it("has chess-challenge tools", () => {
      const challengeTools = registry.getToolsByCategory("chess-challenge");
      expect(challengeTools).toHaveLength(5);
    });

    it("has chess-replay tools", () => {
      const replayTools = registry.getToolsByCategory("chess-replay");
      expect(replayTools).toHaveLength(2);
    });

    it("has chess-tournament tools", () => {
      const tournamentTools = registry.getToolsByCategory("chess-tournament");
      expect(tournamentTools).toHaveLength(5);
    });
  });

  describe("dependency chains", () => {
    it("chess_create_game enables join, move, and resign", () => {
      const tool = chessArenaTools.find((t) => t.name === "chess_create_game");
      expect(tool?.dependencies?.enables).toEqual(
        expect.arrayContaining(["chess_join_game", "chess_make_move", "chess_resign"]),
      );
    });

    it("chess_join_game enables make_move", () => {
      const tool = chessArenaTools.find((t) => t.name === "chess_join_game");
      expect(tool?.dependencies?.enables).toEqual(expect.arrayContaining(["chess_make_move"]));
    });
  });

  describe("annotations", () => {
    it("read-only tools have readOnlyHint annotation", () => {
      const readOnlyNames = [
        "chess_get_game",
        "chess_list_games",
        "chess_get_player",
        "chess_list_profiles",
        "chess_get_stats",
        "chess_list_online",
        "chess_list_challenges",
        "chess_replay_game",
        "chess_get_leaderboard",
        "chess_get_tournament",
        "chess_list_tournaments",
        "chess_get_puzzle",
      ];

      for (const name of readOnlyNames) {
        const tool = chessArenaTools.find((t) => t.name === name);
        expect(tool?.annotations?.readOnlyHint, `${name} should have readOnlyHint`).toBe(true);
      }
    });
  });

  describe("alwaysEnabled", () => {
    it("tournament tools are alwaysEnabled", () => {
      const tournamentTools = registry.getToolsByCategory("chess-tournament");
      for (const tool of tournamentTools) {
        expect(tool.alwaysEnabled, `${tool.name} should be alwaysEnabled`).toBe(true);
      }
    });
  });

  describe("input schemas", () => {
    it("all tools have inputSchema defined", () => {
      for (const tool of chessArenaTools) {
        expect(tool.inputSchema, `${tool.name} should have inputSchema`).toBeDefined();
      }
    });
  });
});
