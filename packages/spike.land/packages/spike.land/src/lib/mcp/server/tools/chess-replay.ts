/**
 * Chess Replay & Leaderboard MCP Tools
 *
 * Replay completed games and view the ELO leaderboard.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

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

export function registerChessReplayTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  registry.register({
    name: "chess_replay_game",
    description: "Get the full move-by-move replay of a completed game with PGN.",
    category: "chess-replay",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: ReplayGameSchema.shape,
    handler: async (
      args: z.infer<typeof ReplayGameSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_replay_game", async () => {
        const { getGameReplay } = await import("@/lib/chess/game-manager");
        const replay = await getGameReplay(args.game_id);
        const moveList = replay.moves.length > 0
          ? replay.moves
            .map(
              (m: { moveNumber: number; san: string; }) => `${m.moveNumber}. ${m.san}`,
            )
            .join(" ")
          : "No moves";
        return textResult(
          `**Game Replay**\n\n`
            + `**Result:** ${replay.result ?? "Unknown"}\n`
            + `**Moves (${replay.moves.length}):** ${moveList}\n\n`
            + `**PGN:**\n${replay.pgn || "(empty)"}`,
        );
      }),
  });

  registry.register({
    name: "chess_get_leaderboard",
    description: "Get the top chess players ranked by ELO rating.",
    category: "chess-replay",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: LeaderboardSchema.shape,
    handler: async (
      args: z.infer<typeof LeaderboardSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_get_leaderboard", async () => {
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
        return textResult(
          `**Leaderboard (Top ${players.length})**\n\n${lines.join("\n")}`,
        );
      }),
  });
}
