/**
 * Chess Tournament MCP Tools
 *
 * Create tournaments, join them, query standings and brackets, list open
 * tournaments, and fetch chess puzzles.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

const TimeControlEnum = z.enum([
  "BULLET_1",
  "BULLET_2",
  "BLITZ_3",
  "BLITZ_5",
  "RAPID_10",
  "RAPID_15",
  "CLASSICAL_30",
]);

const TournamentFormatEnum = z.enum([
  "swiss",
  "round-robin",
  "elimination",
  "arena",
]);

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const CreateTournamentSchema = z.object({
  name: z.string().min(1).max(80).describe("Display name for the tournament."),
  format: TournamentFormatEnum.describe(
    "Tournament format: swiss, round-robin, elimination, or arena.",
  ),
  time_control: TimeControlEnum.describe("Time control for all games."),
  max_players: z
    .number()
    .int()
    .min(4)
    .max(64)
    .optional()
    .default(16)
    .describe("Maximum number of participants (4-64, default 16)."),
  start_time: z
    .string()
    .optional()
    .describe("ISO 8601 start time. Omit to start immediately."),
});

const JoinTournamentSchema = z.object({
  tournament_id: z.string().min(1).describe("ID of the tournament to join."),
  player_id: z.string().min(1).describe("Your chess player profile ID."),
});

const GetTournamentSchema = z.object({
  tournament_id: z
    .string()
    .min(1)
    .describe("ID of the tournament to retrieve."),
});

const ListTournamentsSchema = z.object({
  status: z
    .enum(["upcoming", "in_progress", "completed", "all"])
    .optional()
    .default("all")
    .describe("Filter by status (default: all)."),
});

const GetPuzzleSchema = z.object({
  difficulty: z
    .enum(["beginner", "intermediate", "advanced", "expert"])
    .optional()
    .describe("Puzzle difficulty level. Omit for any difficulty."),
  theme: z
    .enum([
      "mate_in_1",
      "mate_in_2",
      "fork",
      "pin",
      "skewer",
      "discovery",
      "random",
    ])
    .optional()
    .default("random")
    .describe("Tactical theme (default: random)."),
});

// ---------------------------------------------------------------------------
// Lightweight in-process types used by the handlers
// ---------------------------------------------------------------------------

/** Shape returned by prisma.chessTournament.findMany with participants select. */
interface TournamentListItem {
  id: string;
  name: string;
  format: string;
  timeControl: string;
  maxPlayers: number;
  startTime: string | null;
  status: string;
  joinCode: string;
  participants: Array<{ playerId: string; }>;
}

/** Participant shape returned by findUnique with player include. */
interface TournamentParticipantWithPlayer {
  playerId: string;
  points: number;
  player: { id: string; name: string; };
}

/** Pairing shape returned by findUnique with pairings include. */
interface TournamentPairing {
  round: number;
  whiteId: string;
  blackId: string;
  result: string | null;
}

/** Full tournament shape returned by findUnique with participants+pairings include. */
interface TournamentWithRelations {
  id: string;
  name: string;
  format: string;
  timeControl: string;
  maxPlayers: number;
  startTime: string | null;
  status: string;
  joinCode: string;
  currentRound?: number;
  participants: TournamentParticipantWithPlayer[];
  pairings: TournamentPairing[];
}

/** Shape returned by prisma.chessPuzzle.findMany. */
interface PuzzleRecord {
  id: string;
  fen: string;
  rating: number;
  theme: string;
  movesToSolve: number;
  difficulty: string;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerChessTournamentTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  // -------------------------------------------------------------------------
  // chess_create_tournament
  // -------------------------------------------------------------------------
  registry.register({
    name: "chess_create_tournament",
    description:
      "Create a new chess tournament with a chosen format, time control, and player cap.",
    category: "chess-tournament",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: CreateTournamentSchema.shape,
    handler: async (
      args: z.infer<typeof CreateTournamentSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_create_tournament", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const joinCode = Math.random().toString(36).slice(2, 8).toUpperCase();

        const tournament = await prisma.chessTournament.create({
          data: {
            name: args.name,
            format: args.format,
            timeControl: args.time_control,
            maxPlayers: args.max_players,
            startTime: args.start_time ? new Date(args.start_time) : null,
            status: "upcoming",
            joinCode,
          },
        });

        const formatDetails: Record<string, string> = {
          swiss: "Paired by score each round; no eliminations.",
          "round-robin": "Every player faces every other player once.",
          elimination: "Single-elimination bracket; one loss ends your run.",
          arena: "Continuous pairing while the clock runs; most points wins.",
        };

        return textResult(
          `**Tournament Created**\n\n`
            + `**ID:** ${tournament.id}\n`
            + `**Name:** ${tournament.name}\n`
            + `**Format:** ${tournament.format} — ${formatDetails[tournament.format]}\n`
            + `**Time Control:** ${tournament.timeControl}\n`
            + `**Max Players:** ${tournament.maxPlayers}\n`
            + `**Join Code:** ${tournament.joinCode}\n`
            + `**Start Time:** ${tournament.startTime ?? "Immediate"}`,
        );
      }),
  });

  // -------------------------------------------------------------------------
  // chess_join_tournament
  // -------------------------------------------------------------------------
  registry.register({
    name: "chess_join_tournament",
    description: "Join an open tournament by ID. Returns seeding position.",
    category: "chess-tournament",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: JoinTournamentSchema.shape,
    handler: async (
      args: z.infer<typeof JoinTournamentSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_join_tournament", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const tournament = await prisma.chessTournament.findUnique({
          where: { id: args.tournament_id },
          include: { participants: true },
        });

        if (!tournament) {
          return textResult("**Tournament not found.**");
        }

        if (tournament.status !== "upcoming") {
          return textResult(
            `**Cannot Join**\n\nTournament is already **${tournament.status}**.`,
          );
        }

        const alreadyJoined = tournament.participants.some(
          p => p.playerId === args.player_id,
        );
        if (alreadyJoined) {
          return textResult("**Already Joined**\n\nYou are already registered in this tournament.");
        }

        if (tournament.participants.length >= tournament.maxPlayers) {
          return textResult("**Tournament Full**\n\nNo seats remaining.");
        }

        await prisma.chessTournamentParticipant.create({
          data: {
            tournamentId: args.tournament_id,
            playerId: args.player_id,
          },
        });

        const newCount = tournament.participants.length + 1;
        const seedPosition = newCount;

        return textResult(
          `**Joined Tournament**\n\n`
            + `**Tournament:** ${tournament.name}\n`
            + `**Players:** ${newCount} / ${tournament.maxPlayers}\n`
            + `**Your Seeding Position:** #${seedPosition}`,
        );
      }),
  });

  // -------------------------------------------------------------------------
  // chess_get_tournament
  // -------------------------------------------------------------------------
  registry.register({
    name: "chess_get_tournament",
    description:
      "Get full tournament state: format, round info, standings, pairings, and completed games.",
    category: "chess-tournament",
    tier: "free",
    alwaysEnabled: true,
    annotations: { readOnlyHint: true },
    inputSchema: GetTournamentSchema.shape,
    handler: async (
      args: z.infer<typeof GetTournamentSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_get_tournament", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const raw = await prisma.chessTournament.findUnique({
          where: { id: args.tournament_id },
          include: {
            participants: { include: { player: { select: { id: true, name: true } } } },
            pairings: true,
          },
        }) as TournamentWithRelations | null;

        if (!raw) {
          return textResult("**Tournament not found.**");
        }

        const standings = raw.participants
          .sort((a, b) => b.points - a.points)
          .map((p, idx) => `${idx + 1}. **${p.player.name}** — ${p.points} pts`);

        const recentPairings = raw.pairings
          .slice(0, 10)
          .map(
            p => `Round ${p.round}: ${p.whiteId} vs ${p.blackId} — ${p.result ?? "pending"}`,
          );

        const completedGames = raw.pairings.filter(p => p.result !== null).length;

        return textResult(
          `**Tournament: ${raw.name}**\n\n`
            + `**Format:** ${raw.format}\n`
            + `**Time Control:** ${raw.timeControl}\n`
            + `**Status:** ${raw.status}\n`
            + `**Players:** ${raw.participants.length} / ${raw.maxPlayers}\n`
            + `**Current Round:** ${raw.currentRound ?? 0}\n`
            + `**Completed Games:** ${completedGames}\n\n`
            + `**Standings:**\n${
              standings.length > 0 ? standings.join("\n") : "No standings yet."
            }\n\n`
            + `**Recent Pairings:**\n${
              recentPairings.length > 0 ? recentPairings.join("\n") : "No pairings yet."
            }`,
        );
      }),
  });

  // -------------------------------------------------------------------------
  // chess_list_tournaments
  // -------------------------------------------------------------------------
  registry.register({
    name: "chess_list_tournaments",
    description: "List tournaments filtered by status.",
    category: "chess-tournament",
    tier: "free",
    alwaysEnabled: true,
    annotations: { readOnlyHint: true },
    inputSchema: ListTournamentsSchema.shape,
    handler: async (
      args: z.infer<typeof ListTournamentsSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_list_tournaments", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const where = args.status && args.status !== "all"
          ? { status: args.status }
          : {};

        const tournaments = await prisma.chessTournament.findMany({
          where,
          include: { participants: { select: { playerId: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        }) as TournamentListItem[];

        if (tournaments.length === 0) {
          return textResult("**No tournaments found.**");
        }

        const lines = tournaments.map(
          t =>
            `- **${t.name}** (${t.format} / ${t.timeControl}) — `
            + `${t.participants.length}/${t.maxPlayers} players — **${t.status}**`
            + (t.startTime ? ` — Starts: ${t.startTime}` : "")
            + ` — ID: ${t.id}`,
        );

        return textResult(
          `**Tournaments (${tournaments.length})**\n\n${lines.join("\n")}`,
        );
      }),
  });

  // -------------------------------------------------------------------------
  // chess_get_puzzle
  // -------------------------------------------------------------------------
  registry.register({
    name: "chess_get_puzzle",
    description: "Get a chess puzzle filtered by difficulty and tactical theme.",
    category: "chess-tournament",
    tier: "free",
    alwaysEnabled: true,
    annotations: { readOnlyHint: true },
    inputSchema: GetPuzzleSchema.shape,
    handler: async (
      args: z.infer<typeof GetPuzzleSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_get_puzzle", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const difficultyRatingMap: Record<string, { min: number; max: number; }> = {
          beginner: { min: 600, max: 1200 },
          intermediate: { min: 1200, max: 1800 },
          advanced: { min: 1800, max: 2400 },
          expert: { min: 2400, max: 3200 },
        };

        const ratingRange = args.difficulty
          ? difficultyRatingMap[args.difficulty] ?? { min: 600, max: 3200 }
          : { min: 600, max: 3200 };

        const themeFilter = args.theme && args.theme !== "random" ? { theme: args.theme } : {};

        const puzzles = await prisma.chessPuzzle.findMany({
          where: {
            rating: { gte: ratingRange.min, lte: ratingRange.max },
            ...themeFilter,
          },
          take: 50,
        }) as PuzzleRecord[];

        if (puzzles.length === 0) {
          return textResult(
            "**No puzzles found** for the selected difficulty and theme. Try different filters.",
          );
        }

        // Pick a random puzzle from the candidate set
        const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
        if (!puzzle) {
          return textResult(
            "**No puzzles found** for the selected difficulty and theme. Try different filters.",
          );
        }

        return textResult(
          `**Chess Puzzle**\n\n`
            + `**ID:** ${puzzle.id}\n`
            + `**FEN:** ${puzzle.fen}\n`
            + `**Rating:** ${puzzle.rating}\n`
            + `**Theme:** ${puzzle.theme}\n`
            + `**Difficulty:** ${puzzle.difficulty}\n`
            + `**Moves to Solve:** ${puzzle.movesToSolve}`,
        );
      }),
  });
}
