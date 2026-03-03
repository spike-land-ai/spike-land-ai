import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted Prisma mock — must be declared before any imports that use Prisma
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
  chessTournament: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  chessTournamentParticipant: {
    create: vi.fn(),
  },
  chessPuzzle: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerChessTournamentTools } from "./chess-tournament";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTournament(overrides: Partial<{
  id: string;
  name: string;
  format: string;
  timeControl: string;
  maxPlayers: number;
  startTime: string | null;
  status: string;
  joinCode: string;
  participants: unknown[];
  pairings: unknown[];
}> = {}) {
  return {
    id: "t-1",
    name: "Spring Open",
    format: "swiss",
    timeControl: "BLITZ_5",
    maxPlayers: 16,
    startTime: null,
    status: "upcoming",
    joinCode: "ABC123",
    participants: [],
    pairings: [],
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("chess-tournament tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerChessTournamentTools(registry, userId);
  });

  // -------------------------------------------------------------------------
  // Registration smoke test
  // -------------------------------------------------------------------------

  it("should register 5 chess tournament tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("chess_create_tournament")).toBe(true);
    expect(registry.handlers.has("chess_join_tournament")).toBe(true);
    expect(registry.handlers.has("chess_get_tournament")).toBe(true);
    expect(registry.handlers.has("chess_list_tournaments")).toBe(true);
    expect(registry.handlers.has("chess_get_puzzle")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // chess_create_tournament
  // -------------------------------------------------------------------------

  describe("chess_create_tournament", () => {
    it("should create a swiss tournament and return ID and join code", async () => {
      mockPrisma.chessTournament.create.mockResolvedValue(
        makeTournament({ id: "t-1", joinCode: "XYZ999", format: "swiss" }),
      );

      const handler = registry.handlers.get("chess_create_tournament")!;
      const result = await handler({
        name: "Spring Open",
        format: "swiss",
        time_control: "BLITZ_5",
        max_players: 16,
      });

      const text = getText(result);
      expect(text).toContain("Tournament Created");
      expect(text).toContain("t-1");
      expect(text).toContain("swiss");
      expect(text).toContain("XYZ999");
    });

    it("should include format description for round-robin", async () => {
      mockPrisma.chessTournament.create.mockResolvedValue(
        makeTournament({ id: "t-2", format: "round-robin", joinCode: "RR0001" }),
      );

      const handler = registry.handlers.get("chess_create_tournament")!;
      const result = await handler({
        name: "Round Robin Cup",
        format: "round-robin",
        time_control: "RAPID_10",
      });

      const text = getText(result);
      expect(text).toContain("round-robin");
      expect(text).toContain("every other player");
    });

    it("should show start time when provided", async () => {
      mockPrisma.chessTournament.create.mockResolvedValue(
        makeTournament({
          id: "t-3",
          startTime: "2026-03-01T10:00:00.000Z",
          joinCode: "ST1234",
        }),
      );

      const handler = registry.handlers.get("chess_create_tournament")!;
      const result = await handler({
        name: "Timed Start",
        format: "elimination",
        time_control: "BULLET_1",
        start_time: "2026-03-01T10:00:00Z",
      });

      const text = getText(result);
      expect(text).toContain("2026-03-01");
    });

    it("should show Immediate when no start time", async () => {
      mockPrisma.chessTournament.create.mockResolvedValue(
        makeTournament({ id: "t-4", startTime: null, joinCode: "IMMD00" }),
      );

      const handler = registry.handlers.get("chess_create_tournament")!;
      const result = await handler({
        name: "No Delay",
        format: "arena",
        time_control: "BLITZ_3",
      });

      expect(getText(result)).toContain("Immediate");
    });
  });

  // -------------------------------------------------------------------------
  // chess_join_tournament
  // -------------------------------------------------------------------------

  describe("chess_join_tournament", () => {
    it("should join an upcoming tournament successfully", async () => {
      mockPrisma.chessTournament.findUnique.mockResolvedValue(
        makeTournament({ status: "upcoming", participants: [] }),
      );
      mockPrisma.chessTournamentParticipant.create.mockResolvedValue({});

      const handler = registry.handlers.get("chess_join_tournament")!;
      const result = await handler({
        tournament_id: "t-1",
        player_id: "player-99",
      });

      const text = getText(result);
      expect(text).toContain("Joined Tournament");
      expect(text).toContain("Spring Open");
      expect(text).toContain("#1");
    });

    it("should return error when tournament is not found", async () => {
      mockPrisma.chessTournament.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("chess_join_tournament")!;
      const result = await handler({
        tournament_id: "no-such-id",
        player_id: "player-99",
      });

      expect(getText(result)).toContain("not found");
    });

    it("should reject joining an in-progress tournament", async () => {
      mockPrisma.chessTournament.findUnique.mockResolvedValue(
        makeTournament({ status: "in_progress", participants: [] }),
      );

      const handler = registry.handlers.get("chess_join_tournament")!;
      const result = await handler({
        tournament_id: "t-1",
        player_id: "player-99",
      });

      expect(getText(result)).toContain("Cannot Join");
      expect(getText(result)).toContain("in_progress");
    });

    it("should reject when player has already joined", async () => {
      mockPrisma.chessTournament.findUnique.mockResolvedValue(
        makeTournament({
          status: "upcoming",
          participants: [{ playerId: "player-99" }],
        }),
      );

      const handler = registry.handlers.get("chess_join_tournament")!;
      const result = await handler({
        tournament_id: "t-1",
        player_id: "player-99",
      });

      expect(getText(result)).toContain("Already Joined");
    });

    it("should reject when tournament is full", async () => {
      const participants = Array.from({ length: 16 }, (_, i) => ({ playerId: `p-${i}` }));
      mockPrisma.chessTournament.findUnique.mockResolvedValue(
        makeTournament({ status: "upcoming", maxPlayers: 16, participants }),
      );

      const handler = registry.handlers.get("chess_join_tournament")!;
      const result = await handler({
        tournament_id: "t-1",
        player_id: "new-player",
      });

      expect(getText(result)).toContain("Tournament Full");
    });
  });

  // -------------------------------------------------------------------------
  // chess_get_tournament
  // -------------------------------------------------------------------------

  describe("chess_get_tournament", () => {
    it("should return tournament standings and pairings", async () => {
      mockPrisma.chessTournament.findUnique.mockResolvedValue(
        makeTournament({
          status: "in_progress",
          participants: [
            { playerId: "p1", points: 2, player: { id: "p1", name: "Alice" } },
            { playerId: "p2", points: 1, player: { id: "p2", name: "Bob" } },
          ],
          pairings: [
            { round: 1, whiteId: "p1", blackId: "p2", result: "1-0" },
          ],
        }),
      );

      const handler = registry.handlers.get("chess_get_tournament")!;
      const result = await handler({ tournament_id: "t-1" });
      const text = getText(result);

      expect(text).toContain("Spring Open");
      expect(text).toContain("Alice");
      expect(text).toContain("Bob");
      expect(text).toContain("Round 1");
      expect(text).toContain("1-0");
    });

    it("should show No standings yet when no participants", async () => {
      mockPrisma.chessTournament.findUnique.mockResolvedValue(
        makeTournament({ participants: [], pairings: [] }),
      );

      const handler = registry.handlers.get("chess_get_tournament")!;
      const result = await handler({ tournament_id: "t-1" });

      expect(getText(result)).toContain("No standings yet.");
    });

    it("should return not found for missing tournament", async () => {
      mockPrisma.chessTournament.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("chess_get_tournament")!;
      const result = await handler({ tournament_id: "ghost" });

      expect(getText(result)).toContain("not found");
    });

    it("should count completed games correctly", async () => {
      mockPrisma.chessTournament.findUnique.mockResolvedValue(
        makeTournament({
          pairings: [
            { round: 1, whiteId: "p1", blackId: "p2", result: "1-0" },
            { round: 1, whiteId: "p3", blackId: "p4", result: null },
          ],
          participants: [],
        }),
      );

      const handler = registry.handlers.get("chess_get_tournament")!;
      const result = await handler({ tournament_id: "t-1" });

      expect(getText(result)).toContain("Completed Games:** 1");
    });
  });

  // -------------------------------------------------------------------------
  // chess_list_tournaments
  // -------------------------------------------------------------------------

  describe("chess_list_tournaments", () => {
    it("should list tournaments with player counts", async () => {
      mockPrisma.chessTournament.findMany.mockResolvedValue([
        makeTournament({
          id: "t-1",
          name: "Open A",
          status: "upcoming",
          participants: [{ playerId: "p1" }, { playerId: "p2" }],
        }),
        makeTournament({
          id: "t-2",
          name: "Open B",
          status: "completed",
          participants: [{ playerId: "p3" }],
        }),
      ]);

      const handler = registry.handlers.get("chess_list_tournaments")!;
      const result = await handler({ status: "all" });
      const text = getText(result);

      expect(text).toContain("Tournaments (2)");
      expect(text).toContain("Open A");
      expect(text).toContain("Open B");
      expect(text).toContain("2/16");
      expect(text).toContain("1/16");
    });

    it("should handle no tournaments", async () => {
      mockPrisma.chessTournament.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("chess_list_tournaments")!;
      const result = await handler({ status: "upcoming" });

      expect(getText(result)).toContain("No tournaments found");
    });

    it("should include start time in listing when set", async () => {
      mockPrisma.chessTournament.findMany.mockResolvedValue([
        makeTournament({
          id: "t-1",
          startTime: "2026-04-01T09:00:00.000Z",
          participants: [],
        }),
      ]);

      const handler = registry.handlers.get("chess_list_tournaments")!;
      const result = await handler({});

      expect(getText(result)).toContain("Starts:");
    });
  });

  // -------------------------------------------------------------------------
  // chess_get_puzzle
  // -------------------------------------------------------------------------

  describe("chess_get_puzzle", () => {
    it("should return a random puzzle with all fields", async () => {
      mockPrisma.chessPuzzle.findMany.mockResolvedValue([
        {
          id: "puz-1",
          fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
          rating: 1350,
          theme: "fork",
          difficulty: "intermediate",
          movesToSolve: 2,
        },
      ]);

      const handler = registry.handlers.get("chess_get_puzzle")!;
      const result = await handler({ difficulty: "intermediate", theme: "fork" });
      const text = getText(result);

      expect(text).toContain("Chess Puzzle");
      expect(text).toContain("puz-1");
      expect(text).toContain("fork");
      expect(text).toContain("1350");
      expect(text).toContain("intermediate");
      expect(text).toContain("2");
    });

    it("should return a puzzle with no filters applied", async () => {
      mockPrisma.chessPuzzle.findMany.mockResolvedValue([
        {
          id: "puz-2",
          fen: "8/8/8/8/8/8/8/8 w - - 0 1",
          rating: 800,
          theme: "mate_in_1",
          difficulty: "beginner",
          movesToSolve: 1,
        },
      ]);

      const handler = registry.handlers.get("chess_get_puzzle")!;
      const result = await handler({});
      const text = getText(result);

      expect(text).toContain("puz-2");
      expect(text).toContain("mate_in_1");
    });

    it("should handle no puzzles found", async () => {
      mockPrisma.chessPuzzle.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("chess_get_puzzle")!;
      const result = await handler({ difficulty: "expert", theme: "skewer" });

      expect(getText(result)).toContain("No puzzles found");
    });

    it("should query beginner difficulty within 600-1200 rating range", async () => {
      mockPrisma.chessPuzzle.findMany.mockResolvedValue([
        {
          id: "puz-3",
          fen: "some-fen",
          rating: 900,
          theme: "pin",
          difficulty: "beginner",
          movesToSolve: 1,
        },
      ]);

      const handler = registry.handlers.get("chess_get_puzzle")!;
      await handler({ difficulty: "beginner" });

      expect(mockPrisma.chessPuzzle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            rating: { gte: 600, lte: 1200 },
          }),
        }),
      );
    });

    it("should query expert difficulty within 2400-3200 rating range", async () => {
      mockPrisma.chessPuzzle.findMany.mockResolvedValue([
        {
          id: "puz-4",
          fen: "some-fen",
          rating: 2700,
          theme: "discovery",
          difficulty: "expert",
          movesToSolve: 3,
        },
      ]);

      const handler = registry.handlers.get("chess_get_puzzle")!;
      await handler({ difficulty: "expert" });

      expect(mockPrisma.chessPuzzle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            rating: { gte: 2400, lte: 3200 },
          }),
        }),
      );
    });
  });
});
