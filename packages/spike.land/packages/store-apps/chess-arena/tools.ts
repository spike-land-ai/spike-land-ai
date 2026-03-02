/**
 * Chess Arena — Standalone MCP Tool Definitions
 *
 * 27 tools spanning game management, player profiles, challenges,
 * replay/leaderboard, and tournaments/puzzles.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext, StandaloneToolDefinition } from "../shared/types";
import { safeToolCall, textResult } from "../shared/tool-helpers";

// ---------------------------------------------------------------------------
// Schemas — Game
// ---------------------------------------------------------------------------

const CreateGameSchema = z.object({
  player_id: z.string().min(1).describe("Your chess player profile ID."),
  time_control: z
    .enum([
      "BULLET_1",
      "BULLET_2",
      "BLITZ_3",
      "BLITZ_5",
      "RAPID_10",
      "RAPID_15",
      "CLASSICAL_30",
      "UNLIMITED",
    ])
    .optional()
    .default("BLITZ_5")
    .describe("Time control (default BLITZ_5)."),
});

const JoinGameSchema = z.object({
  game_id: z.string().min(1).describe("ID of the game to join."),
  player_id: z.string().min(1).describe("Your chess player profile ID."),
});

const MakeMoveSchema = z.object({
  game_id: z.string().min(1).describe("ID of the active game."),
  player_id: z.string().min(1).describe("Your chess player profile ID."),
  from: z.string().min(2).max(2).describe("Source square (e.g. 'e2')."),
  to: z.string().min(2).max(2).describe("Target square (e.g. 'e4')."),
  promotion: z.string().optional().describe("Promotion piece: q, r, b, n (for pawn promotion)."),
});

const GetGameSchema = z.object({
  game_id: z.string().min(1).describe("ID of the game."),
});

const ListGamesSchema = z.object({
  player_id: z.string().min(1).describe("Your chess player profile ID."),
  status: z.string().optional().describe("Filter by status: WAITING, ACTIVE, CHECKMATE, etc."),
});

const ResignSchema = z.object({
  game_id: z.string().min(1).describe("ID of the game to resign from."),
  player_id: z.string().min(1).describe("Your chess player profile ID."),
});

const OfferDrawSchema = z.object({
  game_id: z.string().min(1).describe("ID of the active game."),
  player_id: z.string().min(1).describe("Your chess player profile ID."),
});

const AcceptDrawSchema = z.object({
  game_id: z.string().min(1).describe("ID of the active game."),
  player_id: z.string().min(1).describe("Your chess player profile ID."),
});

const DeclineDrawSchema = z.object({
  game_id: z.string().min(1).describe("ID of the active game."),
  player_id: z.string().min(1).describe("Your chess player profile ID."),
});

// ---------------------------------------------------------------------------
// Schemas — Player
// ---------------------------------------------------------------------------

const CreatePlayerSchema = z.object({
  name: z.string().min(1).max(30).describe("Display name for the player profile."),
  avatar: z.string().optional().describe("Avatar URL or emoji for the profile."),
});

const GetPlayerSchema = z.object({
  player_id: z.string().min(1).describe("Chess player profile ID."),
});

const ListProfilesSchema = z.object({});

const UpdatePlayerSchema = z.object({
  player_id: z.string().min(1).describe("Chess player profile ID to update."),
  name: z.string().optional().describe("New display name."),
  avatar: z.string().optional().describe("New avatar URL or emoji."),
  sound_enabled: z.boolean().optional().describe("Enable or disable move sounds."),
});

const GetStatsSchema = z.object({
  player_id: z.string().min(1).describe("Chess player profile ID."),
});

const ListOnlineSchema = z.object({});

// ---------------------------------------------------------------------------
// Schemas — Challenge
// ---------------------------------------------------------------------------

const SendChallengeSchema = z.object({
  sender_id: z.string().min(1).describe("Your chess player profile ID."),
  receiver_id: z.string().min(1).describe("Opponent's chess player profile ID."),
  time_control: z
    .enum([
      "BULLET_1",
      "BULLET_2",
      "BLITZ_3",
      "BLITZ_5",
      "RAPID_10",
      "RAPID_15",
      "CLASSICAL_30",
      "UNLIMITED",
    ])
    .optional()
    .default("BLITZ_5")
    .describe("Time control (default BLITZ_5)."),
  sender_color: z
    .enum(["white", "black"])
    .optional()
    .describe("Preferred color. Omit for random assignment."),
});

const AcceptChallengeSchema = z.object({
  challenge_id: z.string().min(1).describe("ID of the challenge to accept."),
  player_id: z.string().min(1).describe("Your chess player profile ID (must be receiver)."),
});

const DeclineChallengeSchema = z.object({
  challenge_id: z.string().min(1).describe("ID of the challenge to decline."),
  player_id: z.string().min(1).describe("Your chess player profile ID (must be receiver)."),
});

const CancelChallengeSchema = z.object({
  challenge_id: z.string().min(1).describe("ID of the challenge to cancel."),
  player_id: z.string().min(1).describe("Your chess player profile ID (must be sender)."),
});

const ListChallengesSchema = z.object({
  player_id: z.string().min(1).describe("Your chess player profile ID."),
  status: z.string().optional().describe("Filter by status: PENDING, ACCEPTED, etc."),
});

// ---------------------------------------------------------------------------
// Schemas — Replay & Leaderboard
// ---------------------------------------------------------------------------

const ReplayGameSchema = z.object({
  game_id: z.string().min(1).describe("ID of the completed game to replay."),
});

const LeaderboardSchema = z.object({
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Number of top players to return (default 10)."),
});

// ---------------------------------------------------------------------------
// Schemas — Tournament & Puzzle
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

const TournamentFormatEnum = z.enum(["swiss", "round-robin", "elimination", "arena"]);

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
  start_time: z.string().optional().describe("ISO 8601 start time. Omit to start immediately."),
});

const JoinTournamentSchema = z.object({
  tournament_id: z.string().min(1).describe("ID of the tournament to join."),
  player_id: z.string().min(1).describe("Your chess player profile ID."),
});

const GetTournamentSchema = z.object({
  tournament_id: z.string().min(1).describe("ID of the tournament to retrieve."),
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
    .enum(["mate_in_1", "mate_in_2", "fork", "pin", "skewer", "discovery", "random"])
    .optional()
    .default("random")
    .describe("Tactical theme (default: random)."),
});

// ---------------------------------------------------------------------------
// Lightweight in-process types (tournament handlers)
// ---------------------------------------------------------------------------

interface TournamentListItem {
  id: string;
  name: string;
  format: string;
  timeControl: string;
  maxPlayers: number;
  startTime: string | null;
  status: string;
  joinCode: string;
  participants: Array<{ playerId: string }>;
}

interface TournamentParticipantWithPlayer {
  playerId: string;
  points: number;
  player: { id: string; name: string };
}

interface TournamentPairing {
  round: number;
  whiteId: string;
  blackId: string;
  result: string | null;
}

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

interface PuzzleRecord {
  id: string;
  fen: string;
  rating: number;
  theme: string;
  movesToSolve: number;
  difficulty: string;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const chessArenaTools: StandaloneToolDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // Game tools (9)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "chess_create_game",
    description: "Create a new chess game with configurable time controls.",
    category: "chess-game",
    tier: "free",
    inputSchema: CreateGameSchema.shape,
    dependencies: {
      enables: ["chess_join_game", "chess_make_move", "chess_resign"],
    },
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_create_game", async () => {
        const args = input as z.infer<typeof CreateGameSchema>;
        const { createGameRecord } = await import("@/lib/chess/game-manager");
        const game = await createGameRecord(args.player_id, args.time_control);
        return textResult(
          `**Game Created**\n\n` +
            `**Game ID:** ${game.id}\n` +
            `**Time Control:** ${args.time_control}\n` +
            `**Status:** WAITING for opponent`,
        );
      }),
  },
  {
    name: "chess_join_game",
    description: "Join an existing game as the black player.",
    category: "chess-game",
    tier: "free",
    inputSchema: JoinGameSchema.shape,
    dependencies: {
      enables: ["chess_make_move"],
    },
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_join_game", async () => {
        const args = input as z.infer<typeof JoinGameSchema>;
        const { joinGame } = await import("@/lib/chess/game-manager");
        const game = await joinGame(args.game_id, args.player_id);
        return textResult(
          `**Game Joined**\n\n` +
            `**Game ID:** ${game.id}\n` +
            `**Status:** ACTIVE — White moves first`,
        );
      }),
  },
  {
    name: "chess_make_move",
    description: "Make a move in an active chess game.",
    category: "chess-game",
    tier: "free",
    inputSchema: MakeMoveSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_make_move", async () => {
        const args = input as z.infer<typeof MakeMoveSchema>;
        const { makeGameMove } = await import("@/lib/chess/game-manager");
        const result = await makeGameMove(
          args.game_id,
          args.player_id,
          args.from,
          args.to,
          args.promotion,
        );
        if (!result.success) {
          return textResult(`**Invalid Move**\n\nThe move ${args.from}-${args.to} is not legal.`);
        }
        let text =
          `**Move Played:** ${result.san}\n` +
          `**From:** ${result.from} → **To:** ${result.to}\n` +
          `**FEN:** ${result.fen}`;
        if (result.isCheckmate) text += `\n\n**CHECKMATE!**`;
        else if (result.isCheck) text += `\n\n**Check!**`;
        else if (result.isStalemate) text += `\n\n**Stalemate — Draw**`;
        else if (result.isDraw) text += `\n\n**Draw**`;
        if (result.captured) text += `\n**Captured:** ${result.captured}`;
        return textResult(text);
      }),
  },
  {
    name: "chess_get_game",
    description: "Get the current state of a chess game with move history.",
    category: "chess-game",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: GetGameSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_get_game", async () => {
        const args = input as z.infer<typeof GetGameSchema>;
        const { getGame } = await import("@/lib/chess/game-manager");
        const game = await getGame(args.game_id);
        const moves = game.moves ?? [];
        const moveList =
          moves.length > 0
            ? moves
                .map((m: { moveNumber: number; san: string }) => `${m.moveNumber}. ${m.san}`)
                .join(" ")
            : "No moves yet";
        return textResult(
          `**Chess Game**\n\n` +
            `**ID:** ${game.id}\n` +
            `**Status:** ${game.status}\n` +
            `**FEN:** ${game.fen}\n` +
            `**Moves (${moves.length}):** ${moveList}\n` +
            `**Time Control:** ${game.timeControl}`,
        );
      }),
  },
  {
    name: "chess_list_games",
    description: "List your chess games with optional status filter.",
    category: "chess-game",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: ListGamesSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_list_games", async () => {
        const args = input as z.infer<typeof ListGamesSchema>;
        const { listGames } = await import("@/lib/chess/game-manager");
        const games = await listGames(args.player_id, args.status);
        if (games.length === 0) {
          return textResult("**No games found.**");
        }
        const lines = games.map(
          (g: { id: string; status: string; moveCount: number }) =>
            `- **${g.id}** — ${g.status} (${g.moveCount} moves)`,
        );
        return textResult(`**Your Games (${games.length})**\n\n${lines.join("\n")}`);
      }),
  },
  {
    name: "chess_resign",
    description: "Resign from an active chess game.",
    category: "chess-game",
    tier: "free",
    inputSchema: ResignSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_resign", async () => {
        const args = input as z.infer<typeof ResignSchema>;
        const { resignGame } = await import("@/lib/chess/game-manager");
        await resignGame(args.game_id, args.player_id);
        return textResult(`**Game Resigned**\n\nYou resigned from game ${args.game_id}.`);
      }),
  },
  {
    name: "chess_offer_draw",
    description: "Offer a draw to your opponent in an active game.",
    category: "chess-game",
    tier: "free",
    inputSchema: OfferDrawSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_offer_draw", async () => {
        const args = input as z.infer<typeof OfferDrawSchema>;
        const { offerDraw } = await import("@/lib/chess/game-manager");
        await offerDraw(args.game_id, args.player_id);
        return textResult(`**Draw Offered**\n\nDraw offer sent in game ${args.game_id}.`);
      }),
  },
  {
    name: "chess_accept_draw",
    description: "Accept a draw offer from your opponent.",
    category: "chess-game",
    tier: "free",
    inputSchema: AcceptDrawSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_accept_draw", async () => {
        const args = input as z.infer<typeof AcceptDrawSchema>;
        const { acceptDraw } = await import("@/lib/chess/game-manager");
        await acceptDraw(args.game_id, args.player_id);
        return textResult(`**Draw Accepted**\n\nGame ${args.game_id} ended in a draw.`);
      }),
  },
  {
    name: "chess_decline_draw",
    description: "Decline a draw offer from your opponent.",
    category: "chess-game",
    tier: "free",
    inputSchema: DeclineDrawSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_decline_draw", async () => {
        const args = input as z.infer<typeof DeclineDrawSchema>;
        const { declineDraw } = await import("@/lib/chess/game-manager");
        await declineDraw(args.game_id, args.player_id);
        return textResult(`**Draw Declined**\n\nDraw offer declined in game ${args.game_id}.`);
      }),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Player tools (6)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "chess_create_player",
    description: "Create a new chess player profile with name and avatar.",
    category: "chess-player",
    tier: "free",
    inputSchema: CreatePlayerSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_create_player", async () => {
        const args = input as z.infer<typeof CreatePlayerSchema>;
        const { createPlayer } = await import("@/lib/chess/player-manager");
        const player = await createPlayer(ctx.userId, args.name, args.avatar);
        return textResult(
          `**Player Created**\n\n` +
            `**ID:** ${player.id}\n` +
            `**Name:** ${player.name}\n` +
            `**ELO:** ${player.elo}`,
        );
      }),
  },
  {
    name: "chess_get_player",
    description: "Get a chess player profile by ID.",
    category: "chess-player",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: GetPlayerSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_get_player", async () => {
        const args = input as z.infer<typeof GetPlayerSchema>;
        const { getPlayer } = await import("@/lib/chess/player-manager");
        const player = await getPlayer(args.player_id);
        if (!player) {
          return textResult("**Player not found.**");
        }
        return textResult(
          `**Chess Player**\n\n` +
            `**ID:** ${player.id}\n` +
            `**Name:** ${player.name}\n` +
            `**ELO:** ${player.elo}\n` +
            `**Online:** ${player.isOnline}`,
        );
      }),
  },
  {
    name: "chess_list_profiles",
    description: "List all your chess player profiles.",
    category: "chess-player",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: ListProfilesSchema.shape,
    handler: async (_input: never, ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_list_profiles", async () => {
        const { getPlayersByUser } = await import("@/lib/chess/player-manager");
        const players = await getPlayersByUser(ctx.userId);
        if (players.length === 0) {
          return textResult("**No profiles found.** Create one with chess_create_player.");
        }
        const lines = players.map(
          (p: { id: string; name: string; elo: number }) =>
            `- **${p.name}** (${p.elo} ELO) — ID: ${p.id}`,
        );
        return textResult(`**Your Profiles (${players.length})**\n\n${lines.join("\n")}`);
      }),
  },
  {
    name: "chess_update_player",
    description: "Update your player profile name, avatar, or sound settings.",
    category: "chess-player",
    tier: "free",
    inputSchema: UpdatePlayerSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_update_player", async () => {
        const args = input as z.infer<typeof UpdatePlayerSchema>;
        const { updatePlayer } = await import("@/lib/chess/player-manager");
        const player = await updatePlayer(args.player_id, ctx.userId, {
          name: args.name,
          avatar: args.avatar,
          soundEnabled: args.sound_enabled,
        });
        return textResult(
          `**Player Updated**\n\n` +
            `**Name:** ${player.name}\n` +
            `**Sound:** ${player.soundEnabled}`,
        );
      }),
  },
  {
    name: "chess_get_stats",
    description: "Get detailed statistics for a chess player.",
    category: "chess-player",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: GetStatsSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_get_stats", async () => {
        const args = input as z.infer<typeof GetStatsSchema>;
        const { getPlayerStats } = await import("@/lib/chess/player-manager");
        const stats = await getPlayerStats(args.player_id);
        return textResult(
          `**Player Stats**\n\n` +
            `**ELO:** ${stats.elo} (Best: ${stats.bestElo})\n` +
            `**Record:** ${stats.wins}W / ${stats.losses}L / ${stats.draws}D\n` +
            `**Total Games:** ${stats.totalGames}\n` +
            `**Win Rate:** ${(stats.winRate * 100).toFixed(1)}%\n` +
            `**Streak:** ${stats.streak}`,
        );
      }),
  },
  {
    name: "chess_list_online",
    description: "List all online chess players in the lobby.",
    category: "chess-player",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: ListOnlineSchema.shape,
    handler: async (_input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_list_online", async () => {
        const { listOnlinePlayers } = await import("@/lib/chess/player-manager");
        const players = await listOnlinePlayers();
        if (players.length === 0) {
          return textResult("**No players online.**");
        }
        const lines = players.map(
          (p: { id: string; name: string; elo: number }) =>
            `- **${p.name}** (${p.elo} ELO) — ID: ${p.id}`,
        );
        return textResult(`**Online Players (${players.length})**\n\n${lines.join("\n")}`);
      }),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Challenge tools (5)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "chess_send_challenge",
    description:
      "Send a challenge to another player with optional time control and color preference.",
    category: "chess-challenge",
    tier: "free",
    inputSchema: SendChallengeSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_send_challenge", async () => {
        const args = input as z.infer<typeof SendChallengeSchema>;
        const { sendChallenge } = await import("@/lib/chess/challenge-manager");
        const challenge = await sendChallenge(
          args.sender_id,
          args.receiver_id,
          args.time_control,
          args.sender_color,
        );
        return textResult(
          `**Challenge Sent**\n\n` +
            `**ID:** ${challenge.id}\n` +
            `**Time Control:** ${args.time_control}\n` +
            `**Expires:** ${challenge.expiresAt}`,
        );
      }),
  },
  {
    name: "chess_accept_challenge",
    description: "Accept an incoming chess challenge and start the game.",
    category: "chess-challenge",
    tier: "free",
    inputSchema: AcceptChallengeSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_accept_challenge", async () => {
        const args = input as z.infer<typeof AcceptChallengeSchema>;
        const { acceptChallenge } = await import("@/lib/chess/challenge-manager");
        const { challenge, gameId } = await acceptChallenge(args.challenge_id, args.player_id);
        return textResult(
          `**Challenge Accepted**\n\n` +
            `**Challenge ID:** ${challenge.id}\n` +
            `**Game ID:** ${gameId}\n` +
            `**Status:** Game is starting!`,
        );
      }),
  },
  {
    name: "chess_decline_challenge",
    description: "Decline an incoming chess challenge.",
    category: "chess-challenge",
    tier: "free",
    inputSchema: DeclineChallengeSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_decline_challenge", async () => {
        const args = input as z.infer<typeof DeclineChallengeSchema>;
        const { declineChallenge } = await import("@/lib/chess/challenge-manager");
        await declineChallenge(args.challenge_id, args.player_id);
        return textResult(
          `**Challenge Declined**\n\nChallenge ${args.challenge_id} has been declined.`,
        );
      }),
  },
  {
    name: "chess_cancel_challenge",
    description: "Cancel a challenge you sent.",
    category: "chess-challenge",
    tier: "free",
    inputSchema: CancelChallengeSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_cancel_challenge", async () => {
        const args = input as z.infer<typeof CancelChallengeSchema>;
        const { cancelChallenge } = await import("@/lib/chess/challenge-manager");
        await cancelChallenge(args.challenge_id, args.player_id);
        return textResult(
          `**Challenge Cancelled**\n\nChallenge ${args.challenge_id} has been cancelled.`,
        );
      }),
  },
  {
    name: "chess_list_challenges",
    description: "List your pending chess challenges.",
    category: "chess-challenge",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: ListChallengesSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_list_challenges", async () => {
        const args = input as z.infer<typeof ListChallengesSchema>;
        const { listChallenges } = await import("@/lib/chess/challenge-manager");
        const challenges = await listChallenges(args.player_id, args.status);
        if (challenges.length === 0) {
          return textResult("**No challenges found.**");
        }
        const lines = challenges.map(
          (c: {
            id: string;
            status: string;
            senderId: string;
            receiverId: string;
            timeControl: string;
          }) =>
            `- **${c.id}** — ${c.status} (${c.timeControl}) sender: ${c.senderId}, receiver: ${c.receiverId}`,
        );
        return textResult(`**Challenges (${challenges.length})**\n\n${lines.join("\n")}`);
      }),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Replay & Leaderboard tools (2)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "chess_replay_game",
    description: "Get the full move-by-move replay of a completed game with PGN.",
    category: "chess-replay",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: ReplayGameSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_replay_game", async () => {
        const args = input as z.infer<typeof ReplayGameSchema>;
        const { getGameReplay } = await import("@/lib/chess/game-manager");
        const replay = await getGameReplay(args.game_id);
        const moveList =
          replay.moves.length > 0
            ? replay.moves
                .map((m: { moveNumber: number; san: string }) => `${m.moveNumber}. ${m.san}`)
                .join(" ")
            : "No moves";
        return textResult(
          `**Game Replay**\n\n` +
            `**Result:** ${replay.result ?? "Unknown"}\n` +
            `**Moves (${replay.moves.length}):** ${moveList}\n\n` +
            `**PGN:**\n${replay.pgn || "(empty)"}`,
        );
      }),
  },
  {
    name: "chess_get_leaderboard",
    description: "Get the top chess players ranked by ELO rating.",
    category: "chess-replay",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: LeaderboardSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_get_leaderboard", async () => {
        const args = input as z.infer<typeof LeaderboardSchema>;
        const prisma = (await import("@/lib/prisma")).default;
        const players = await prisma.chessPlayer.findMany({
          orderBy: { elo: "desc" },
          take: args.limit,
        });
        if (players.length === 0) {
          return textResult("**No players on the leaderboard yet.**");
        }
        const lines = players.map(
          (
            p: {
              name: string;
              elo: number;
              wins: number;
              losses: number;
              draws: number;
            },
            i: number,
          ) => `${i + 1}. **${p.name}** — ${p.elo} ELO (${p.wins}W/${p.losses}L/${p.draws}D)`,
        );
        return textResult(`**Leaderboard (Top ${players.length})**\n\n${lines.join("\n")}`);
      }),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Tournament & Puzzle tools (5)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "chess_create_tournament",
    description:
      "Create a new chess tournament with a chosen format, time control, and player cap.",
    category: "chess-tournament",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: CreateTournamentSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_create_tournament", async () => {
        const args = input as z.infer<typeof CreateTournamentSchema>;
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
          `**Tournament Created**\n\n` +
            `**ID:** ${tournament.id}\n` +
            `**Name:** ${tournament.name}\n` +
            `**Format:** ${tournament.format} — ${formatDetails[tournament.format]}\n` +
            `**Time Control:** ${tournament.timeControl}\n` +
            `**Max Players:** ${tournament.maxPlayers}\n` +
            `**Join Code:** ${tournament.joinCode}\n` +
            `**Start Time:** ${tournament.startTime ?? "Immediate"}`,
        );
      }),
  },
  {
    name: "chess_join_tournament",
    description: "Join an open tournament by ID. Returns seeding position.",
    category: "chess-tournament",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: JoinTournamentSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_join_tournament", async () => {
        const args = input as z.infer<typeof JoinTournamentSchema>;
        const prisma = (await import("@/lib/prisma")).default;

        const tournament = await prisma.chessTournament.findUnique({
          where: { id: args.tournament_id },
          include: { participants: true },
        });

        if (!tournament) {
          return textResult("**Tournament not found.**");
        }

        if (tournament.status !== "upcoming") {
          return textResult(`**Cannot Join**\n\nTournament is already **${tournament.status}**.`);
        }

        const alreadyJoined = tournament.participants.some((p) => p.playerId === args.player_id);
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
          `**Joined Tournament**\n\n` +
            `**Tournament:** ${tournament.name}\n` +
            `**Players:** ${newCount} / ${tournament.maxPlayers}\n` +
            `**Your Seeding Position:** #${seedPosition}`,
        );
      }),
  },
  {
    name: "chess_get_tournament",
    description:
      "Get full tournament state: format, round info, standings, pairings, and completed games.",
    category: "chess-tournament",
    tier: "free",
    alwaysEnabled: true,
    annotations: { readOnlyHint: true },
    inputSchema: GetTournamentSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_get_tournament", async () => {
        const args = input as z.infer<typeof GetTournamentSchema>;
        const prisma = (await import("@/lib/prisma")).default;

        const raw = (await prisma.chessTournament.findUnique({
          where: { id: args.tournament_id },
          include: {
            participants: { include: { player: { select: { id: true, name: true } } } },
            pairings: true,
          },
        })) as TournamentWithRelations | null;

        if (!raw) {
          return textResult("**Tournament not found.**");
        }

        const standings = raw.participants
          .sort((a, b) => b.points - a.points)
          .map((p, idx) => `${idx + 1}. **${p.player.name}** — ${p.points} pts`);

        const recentPairings = raw.pairings
          .slice(0, 10)
          .map((p) => `Round ${p.round}: ${p.whiteId} vs ${p.blackId} — ${p.result ?? "pending"}`);

        const completedGames = raw.pairings.filter((p) => p.result !== null).length;

        return textResult(
          `**Tournament: ${raw.name}**\n\n` +
            `**Format:** ${raw.format}\n` +
            `**Time Control:** ${raw.timeControl}\n` +
            `**Status:** ${raw.status}\n` +
            `**Players:** ${raw.participants.length} / ${raw.maxPlayers}\n` +
            `**Current Round:** ${raw.currentRound ?? 0}\n` +
            `**Completed Games:** ${completedGames}\n\n` +
            `**Standings:**\n${
              standings.length > 0 ? standings.join("\n") : "No standings yet."
            }\n\n` +
            `**Recent Pairings:**\n${
              recentPairings.length > 0 ? recentPairings.join("\n") : "No pairings yet."
            }`,
        );
      }),
  },
  {
    name: "chess_list_tournaments",
    description: "List tournaments filtered by status.",
    category: "chess-tournament",
    tier: "free",
    alwaysEnabled: true,
    annotations: { readOnlyHint: true },
    inputSchema: ListTournamentsSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_list_tournaments", async () => {
        const args = input as z.infer<typeof ListTournamentsSchema>;
        const prisma = (await import("@/lib/prisma")).default;

        const where = args.status && args.status !== "all" ? { status: args.status } : {};

        const tournaments = (await prisma.chessTournament.findMany({
          where,
          include: { participants: { select: { playerId: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        })) as TournamentListItem[];

        if (tournaments.length === 0) {
          return textResult("**No tournaments found.**");
        }

        const lines = tournaments.map(
          (t) =>
            `- **${t.name}** (${t.format} / ${t.timeControl}) — ` +
            `${t.participants.length}/${t.maxPlayers} players — **${t.status}**` +
            (t.startTime ? ` — Starts: ${t.startTime}` : "") +
            ` — ID: ${t.id}`,
        );

        return textResult(`**Tournaments (${tournaments.length})**\n\n${lines.join("\n")}`);
      }),
  },
  {
    name: "chess_get_puzzle",
    description: "Get a chess puzzle filtered by difficulty and tactical theme.",
    category: "chess-tournament",
    tier: "free",
    alwaysEnabled: true,
    annotations: { readOnlyHint: true },
    inputSchema: GetPuzzleSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("chess_get_puzzle", async () => {
        const args = input as z.infer<typeof GetPuzzleSchema>;
        const prisma = (await import("@/lib/prisma")).default;

        const difficultyRatingMap: Record<string, { min: number; max: number }> = {
          beginner: { min: 600, max: 1200 },
          intermediate: { min: 1200, max: 1800 },
          advanced: { min: 1800, max: 2400 },
          expert: { min: 2400, max: 3200 },
        };

        const ratingRange = args.difficulty
          ? (difficultyRatingMap[args.difficulty] ?? { min: 600, max: 3200 })
          : { min: 600, max: 3200 };

        const themeFilter = args.theme && args.theme !== "random" ? { theme: args.theme } : {};

        const puzzles = (await prisma.chessPuzzle.findMany({
          where: {
            rating: { gte: ratingRange.min, lte: ratingRange.max },
            ...themeFilter,
          },
          take: 50,
        })) as PuzzleRecord[];

        if (puzzles.length === 0) {
          return textResult(
            "**No puzzles found** for the selected difficulty and theme. Try different filters.",
          );
        }

        const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
        if (!puzzle) {
          return textResult(
            "**No puzzles found** for the selected difficulty and theme. Try different filters.",
          );
        }

        return textResult(
          `**Chess Puzzle**\n\n` +
            `**ID:** ${puzzle.id}\n` +
            `**FEN:** ${puzzle.fen}\n` +
            `**Rating:** ${puzzle.rating}\n` +
            `**Theme:** ${puzzle.theme}\n` +
            `**Difficulty:** ${puzzle.difficulty}\n` +
            `**Moves to Solve:** ${puzzle.movesToSolve}`,
        );
      }),
  },
];
