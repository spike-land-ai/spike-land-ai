/**
 * Chess Player MCP Tools
 *
 * Create and manage chess player profiles, view stats, and list online players.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const CreatePlayerSchema = z.object({
  name: z.string().min(1).max(30).describe(
    "Display name for the player profile.",
  ),
  avatar: z.string().optional().describe(
    "Avatar URL or emoji for the profile.",
  ),
});

const GetPlayerSchema = z.object({
  player_id: z.string().min(1).describe("Chess player profile ID."),
});

const ListProfilesSchema = z.object({});

const UpdatePlayerSchema = z.object({
  player_id: z.string().min(1).describe("Chess player profile ID to update."),
  name: z.string().optional().describe("New display name."),
  avatar: z.string().optional().describe("New avatar URL or emoji."),
  sound_enabled: z.boolean().optional().describe(
    "Enable or disable move sounds.",
  ),
});

const GetStatsSchema = z.object({
  player_id: z.string().min(1).describe("Chess player profile ID."),
});

const ListOnlineSchema = z.object({});

export function registerChessPlayerTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "chess_create_player",
    description: "Create a new chess player profile with name and avatar.",
    category: "chess-player",
    tier: "free",
    inputSchema: CreatePlayerSchema.shape,
    handler: async (
      args: z.infer<typeof CreatePlayerSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_create_player", async () => {
        const { createPlayer } = await import("@/lib/chess/player-manager");
        const player = await createPlayer(userId, args.name, args.avatar);
        return textResult(
          `**Player Created**\n\n`
            + `**ID:** ${player.id}\n`
            + `**Name:** ${player.name}\n`
            + `**ELO:** ${player.elo}`,
        );
      }),
  });

  registry.register({
    name: "chess_get_player",
    description: "Get a chess player profile by ID.",
    category: "chess-player",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: GetPlayerSchema.shape,
    handler: async (
      args: z.infer<typeof GetPlayerSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_get_player", async () => {
        const { getPlayer } = await import("@/lib/chess/player-manager");
        const player = await getPlayer(args.player_id);
        if (!player) {
          return textResult("**Player not found.**");
        }
        return textResult(
          `**Chess Player**\n\n`
            + `**ID:** ${player.id}\n`
            + `**Name:** ${player.name}\n`
            + `**ELO:** ${player.elo}\n`
            + `**Online:** ${player.isOnline}`,
        );
      }),
  });

  registry.register({
    name: "chess_list_profiles",
    description: "List all your chess player profiles.",
    category: "chess-player",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: ListProfilesSchema.shape,
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("chess_list_profiles", async () => {
        const { getPlayersByUser } = await import(
          "@/lib/chess/player-manager"
        );
        const players = await getPlayersByUser(userId);
        if (players.length === 0) {
          return textResult(
            "**No profiles found.** Create one with chess_create_player.",
          );
        }
        const lines = players.map(
          (p: { id: string; name: string; elo: number; }) =>
            `- **${p.name}** (${p.elo} ELO) — ID: ${p.id}`,
        );
        return textResult(
          `**Your Profiles (${players.length})**\n\n${lines.join("\n")}`,
        );
      }),
  });

  registry.register({
    name: "chess_update_player",
    description: "Update your player profile name, avatar, or sound settings.",
    category: "chess-player",
    tier: "free",
    inputSchema: UpdatePlayerSchema.shape,
    handler: async (
      args: z.infer<typeof UpdatePlayerSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_update_player", async () => {
        const { updatePlayer } = await import("@/lib/chess/player-manager");
        const player = await updatePlayer(args.player_id, userId, {
          name: args.name,
          avatar: args.avatar,
          soundEnabled: args.sound_enabled,
        });
        return textResult(
          `**Player Updated**\n\n`
            + `**Name:** ${player.name}\n`
            + `**Sound:** ${player.soundEnabled}`,
        );
      }),
  });

  registry.register({
    name: "chess_get_stats",
    description: "Get detailed statistics for a chess player.",
    category: "chess-player",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: GetStatsSchema.shape,
    handler: async (
      args: z.infer<typeof GetStatsSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_get_stats", async () => {
        const { getPlayerStats } = await import("@/lib/chess/player-manager");
        const stats = await getPlayerStats(args.player_id);
        return textResult(
          `**Player Stats**\n\n`
            + `**ELO:** ${stats.elo} (Best: ${stats.bestElo})\n`
            + `**Record:** ${stats.wins}W / ${stats.losses}L / ${stats.draws}D\n`
            + `**Total Games:** ${stats.totalGames}\n`
            + `**Win Rate:** ${(stats.winRate * 100).toFixed(1)}%\n`
            + `**Streak:** ${stats.streak}`,
        );
      }),
  });

  registry.register({
    name: "chess_list_online",
    description: "List all online chess players in the lobby.",
    category: "chess-player",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: ListOnlineSchema.shape,
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("chess_list_online", async () => {
        const { listOnlinePlayers } = await import(
          "@/lib/chess/player-manager"
        );
        const players = await listOnlinePlayers();
        if (players.length === 0) {
          return textResult("**No players online.**");
        }
        const lines = players.map(
          (p: { id: string; name: string; elo: number; }) =>
            `- **${p.name}** (${p.elo} ELO) — ID: ${p.id}`,
        );
        return textResult(
          `**Online Players (${players.length})**\n\n${lines.join("\n")}`,
        );
      }),
  });
}
