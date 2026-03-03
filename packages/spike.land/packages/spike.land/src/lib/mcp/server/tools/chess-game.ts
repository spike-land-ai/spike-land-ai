/**
 * Chess Game MCP Tools
 *
 * Create, join, play moves, resign, and manage chess games.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

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
  promotion: z
    .string()
    .optional()
    .describe("Promotion piece: q, r, b, n (for pawn promotion)."),
});

const GetGameSchema = z.object({
  game_id: z.string().min(1).describe("ID of the game."),
});

const ListGamesSchema = z.object({
  player_id: z.string().min(1).describe("Your chess player profile ID."),
  status: z
    .string()
    .optional()
    .describe("Filter by status: WAITING, ACTIVE, CHECKMATE, etc."),
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

export function registerChessGameTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  registry.register({
    name: "chess_create_game",
    description: "Create a new chess game with configurable time controls.",
    category: "chess-game",
    tier: "free",
    inputSchema: CreateGameSchema.shape,
    handler: async (
      args: z.infer<typeof CreateGameSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_create_game", async () => {
        const { createGameRecord } = await import("@/lib/chess/game-manager");
        const game = await createGameRecord(args.player_id, args.time_control);
        return textResult(
          `**Game Created**\n\n`
            + `**Game ID:** ${game.id}\n`
            + `**Time Control:** ${args.time_control}\n`
            + `**Status:** WAITING for opponent`,
        );
      }),
  });

  registry.register({
    name: "chess_join_game",
    description: "Join an existing game as the black player.",
    category: "chess-game",
    tier: "free",
    inputSchema: JoinGameSchema.shape,
    handler: async (
      args: z.infer<typeof JoinGameSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_join_game", async () => {
        const { joinGame } = await import("@/lib/chess/game-manager");
        const game = await joinGame(args.game_id, args.player_id);
        return textResult(
          `**Game Joined**\n\n`
            + `**Game ID:** ${game.id}\n`
            + `**Status:** ACTIVE — White moves first`,
        );
      }),
  });

  registry.register({
    name: "chess_make_move",
    description: "Make a move in an active chess game.",
    category: "chess-game",
    tier: "free",
    inputSchema: MakeMoveSchema.shape,
    handler: async (
      args: z.infer<typeof MakeMoveSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_make_move", async () => {
        const { makeGameMove } = await import("@/lib/chess/game-manager");
        const result = await makeGameMove(
          args.game_id,
          args.player_id,
          args.from,
          args.to,
          args.promotion,
        );
        if (!result.success) {
          return textResult(
            `**Invalid Move**\n\nThe move ${args.from}-${args.to} is not legal.`,
          );
        }
        let text = `**Move Played:** ${result.san}\n`
          + `**From:** ${result.from} → **To:** ${result.to}\n`
          + `**FEN:** ${result.fen}`;
        if (result.isCheckmate) text += `\n\n**CHECKMATE!**`;
        else if (result.isCheck) text += `\n\n**Check!**`;
        else if (result.isStalemate) text += `\n\n**Stalemate — Draw**`;
        else if (result.isDraw) text += `\n\n**Draw**`;
        if (result.captured) text += `\n**Captured:** ${result.captured}`;
        return textResult(text);
      }),
  });

  registry.register({
    name: "chess_get_game",
    description: "Get the current state of a chess game with move history.",
    category: "chess-game",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: GetGameSchema.shape,
    handler: async (
      args: z.infer<typeof GetGameSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_get_game", async () => {
        const { getGame } = await import("@/lib/chess/game-manager");
        const game = await getGame(args.game_id);
        const moves = game.moves ?? [];
        const moveList = moves.length > 0
          ? moves
            .map(
              (m: { moveNumber: number; san: string; }) => `${m.moveNumber}. ${m.san}`,
            )
            .join(" ")
          : "No moves yet";
        return textResult(
          `**Chess Game**\n\n`
            + `**ID:** ${game.id}\n`
            + `**Status:** ${game.status}\n`
            + `**FEN:** ${game.fen}\n`
            + `**Moves (${moves.length}):** ${moveList}\n`
            + `**Time Control:** ${game.timeControl}`,
        );
      }),
  });

  registry.register({
    name: "chess_list_games",
    description: "List your chess games with optional status filter.",
    category: "chess-game",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: ListGamesSchema.shape,
    handler: async (
      args: z.infer<typeof ListGamesSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_list_games", async () => {
        const { listGames } = await import("@/lib/chess/game-manager");
        const games = await listGames(args.player_id, args.status);
        if (games.length === 0) {
          return textResult("**No games found.**");
        }
        const lines = games.map(
          (g: { id: string; status: string; moveCount: number; }) =>
            `- **${g.id}** — ${g.status} (${g.moveCount} moves)`,
        );
        return textResult(
          `**Your Games (${games.length})**\n\n${lines.join("\n")}`,
        );
      }),
  });

  registry.register({
    name: "chess_resign",
    description: "Resign from an active chess game.",
    category: "chess-game",
    tier: "free",
    inputSchema: ResignSchema.shape,
    handler: async (
      args: z.infer<typeof ResignSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_resign", async () => {
        const { resignGame } = await import("@/lib/chess/game-manager");
        await resignGame(args.game_id, args.player_id);
        return textResult(
          `**Game Resigned**\n\nYou resigned from game ${args.game_id}.`,
        );
      }),
  });

  registry.register({
    name: "chess_offer_draw",
    description: "Offer a draw to your opponent in an active game.",
    category: "chess-game",
    tier: "free",
    inputSchema: OfferDrawSchema.shape,
    handler: async (
      args: z.infer<typeof OfferDrawSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_offer_draw", async () => {
        const { offerDraw } = await import("@/lib/chess/game-manager");
        await offerDraw(args.game_id, args.player_id);
        return textResult(
          `**Draw Offered**\n\nDraw offer sent in game ${args.game_id}.`,
        );
      }),
  });

  registry.register({
    name: "chess_accept_draw",
    description: "Accept a draw offer from your opponent.",
    category: "chess-game",
    tier: "free",
    inputSchema: AcceptDrawSchema.shape,
    handler: async (
      args: z.infer<typeof AcceptDrawSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_accept_draw", async () => {
        const { acceptDraw } = await import("@/lib/chess/game-manager");
        await acceptDraw(args.game_id, args.player_id);
        return textResult(
          `**Draw Accepted**\n\nGame ${args.game_id} ended in a draw.`,
        );
      }),
  });

  registry.register({
    name: "chess_decline_draw",
    description: "Decline a draw offer from your opponent.",
    category: "chess-game",
    tier: "free",
    inputSchema: DeclineDrawSchema.shape,
    handler: async (
      args: z.infer<typeof DeclineDrawSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_decline_draw", async () => {
        const { declineDraw } = await import("@/lib/chess/game-manager");
        await declineDraw(args.game_id, args.player_id);
        return textResult(
          `**Draw Declined**\n\nDraw offer declined in game ${args.game_id}.`,
        );
      }),
  });
}
