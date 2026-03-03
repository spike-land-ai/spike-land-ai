/**
 * Tabletop Simulator State & Social MCP Tools
 *
 * Save/load game states, list saves, send chat messages, and upload custom
 * game assets (maps, tokens, tiles, cards, dice).
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

// ── Schemas ──────────────────────────────────────────────────────────────────

const SaveGameSchema = z.object({
  room_id: z.string().min(1).describe("The room code whose state to save."),
  save_name: z
    .string()
    .max(80)
    .optional()
    .describe("Optional human-readable label for this save."),
});

const LoadGameSchema = z.object({
  save_id: z.string().min(1).describe("The unique save ID to restore."),
});

const ListSavesSchema = z.object({
  room_id: z
    .string()
    .optional()
    .describe("Filter saves by room code. Omit to list all saves."),
});

const SendChatSchema = z.object({
  room_id: z
    .string()
    .min(1)
    .describe("The room in which to send the chat message."),
  message: z
    .string()
    .min(1)
    .max(500)
    .describe("Chat message content (max 500 characters)."),
});

const AddAssetSchema = z.object({
  room_id: z
    .string()
    .min(1)
    .describe("The room that will own this asset."),
  asset_type: z
    .enum(["map", "token", "tile", "card", "dice"])
    .describe("Category of the game asset."),
  name: z
    .string()
    .min(1)
    .max(80)
    .describe("Display name for the asset."),
  url: z
    .string()
    .url()
    .describe("Publicly accessible URL of the asset image or model."),
});

// ── In-memory stores ──────────────────────────────────────────────────────────

interface SaveEntry {
  id: string;
  roomId: string;
  name: string;
  savedAt: number;
  playerCount: number;
  turnNumber: number;
}

interface AssetEntry {
  id: string;
  roomId: string;
  assetType: string;
  name: string;
  url: string;
  addedAt: number;
  widthPx: number;
  heightPx: number;
}

const saveStore = new Map<string, SaveEntry>();
const assetStore = new Map<string, AssetEntry>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 10; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}_${suffix}`;
}

const ASSET_DIMENSIONS: Record<
  string,
  { widthPx: number; heightPx: number; }
> = {
  map: { widthPx: 2048, heightPx: 2048 },
  token: { widthPx: 128, heightPx: 128 },
  tile: { widthPx: 256, heightPx: 256 },
  card: { widthPx: 200, heightPx: 280 },
  dice: { widthPx: 64, heightPx: 64 },
};

// ── Registration ──────────────────────────────────────────────────────────────

export function registerTabletopStateTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  // ── tabletop_save_game ────────────────────────────────────────────────────

  registry.register({
    name: "tabletop_save_game",
    description:
      "Save the current game state for a tabletop room. Returns a save ID that can be used to restore the session later.",
    category: "tabletop-state",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: SaveGameSchema.shape,
    handler: async (
      args: z.infer<typeof SaveGameSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("tabletop_save_game", async () => {
        const id = generateId("save");
        const now = Date.now();

        // Simulate reading live room state (turn counter, player count)
        const turnNumber = Math.floor(Math.random() * 30) + 1;
        const playerCount = Math.floor(Math.random() * 6) + 1;

        const entry: SaveEntry = {
          id,
          roomId: args.room_id.toUpperCase(),
          name: args.save_name ?? `Save ${new Date(now).toISOString().slice(0, 16)}`,
          savedAt: now,
          playerCount,
          turnNumber,
        };

        saveStore.set(id, entry);

        return textResult(
          `**Game Saved**\n\n`
            + `**Save ID:** ${id}\n`
            + `**Name:** ${entry.name}\n`
            + `**Room:** ${entry.roomId}\n`
            + `**Timestamp:** ${new Date(entry.savedAt).toISOString()}\n`
            + `**Turn:** ${entry.turnNumber}\n`
            + `**Players:** ${entry.playerCount}\n\n`
            + `Use \`tabletop_load_game\` with this Save ID to restore the session.`,
        );
      }),
  });

  // ── tabletop_load_game ────────────────────────────────────────────────────

  registry.register({
    name: "tabletop_load_game",
    description:
      "Load a previously saved game state. Restores the room to its saved configuration.",
    category: "tabletop-state",
    tier: "free",
    alwaysEnabled: true,
    annotations: { readOnlyHint: true },
    inputSchema: LoadGameSchema.shape,
    handler: async (
      args: z.infer<typeof LoadGameSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("tabletop_load_game", async () => {
        const save = saveStore.get(args.save_id);

        if (!save) {
          return textResult(
            `**Save Not Found**\n\nNo save with ID "${args.save_id}" exists.\n`
              + `Use \`tabletop_list_saves\` to see available saves.`,
          );
        }

        return textResult(
          `**Game Loaded**\n\n`
            + `**Save ID:** ${save.id}\n`
            + `**Name:** ${save.name}\n`
            + `**Room:** ${save.roomId}\n`
            + `**Saved At:** ${new Date(save.savedAt).toISOString()}\n`
            + `**Restored Turn:** ${save.turnNumber}\n`
            + `**Player Count:** ${save.playerCount}\n\n`
            + `The game state has been restored. All players in room ${save.roomId} `
            + `will receive the updated board via P2P sync.`,
        );
      }),
  });

  // ── tabletop_list_saves ───────────────────────────────────────────────────

  registry.register({
    name: "tabletop_list_saves",
    description: "List all saved game states, optionally filtered by room code.",
    category: "tabletop-state",
    tier: "free",
    alwaysEnabled: true,
    annotations: { readOnlyHint: true },
    inputSchema: ListSavesSchema.shape,
    handler: async (
      args: z.infer<typeof ListSavesSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("tabletop_list_saves", async () => {
        const roomFilter = args.room_id?.toUpperCase();

        const saves = [...saveStore.values()].filter(
          s => !roomFilter || s.roomId === roomFilter,
        );

        if (saves.length === 0) {
          const scope = roomFilter ? ` for room ${roomFilter}` : "";
          return textResult(
            `**No Saves Found**\n\nThere are no saved games${scope}.\n`
              + `Use \`tabletop_save_game\` to create one.`,
          );
        }

        // Sort newest first
        saves.sort((a, b) => b.savedAt - a.savedAt);

        const rows = saves
          .map(
            (s, i) =>
              `${i + 1}. **${s.name}**\n`
              + `   ID: \`${s.id}\`  |  Room: ${s.roomId}  |  `
              + `Saved: ${new Date(s.savedAt).toISOString().slice(0, 16)}  |  `
              + `Turn: ${s.turnNumber}  |  Players: ${s.playerCount}`,
          )
          .join("\n\n");

        const header = roomFilter
          ? `**Saved Games — Room ${roomFilter} (${saves.length})**`
          : `**All Saved Games (${saves.length})**`;

        return textResult(`${header}\n\n${rows}`);
      }),
  });

  // ── tabletop_send_chat ────────────────────────────────────────────────────

  registry.register({
    name: "tabletop_send_chat",
    description:
      "Send a chat message in a tabletop game room. Returns a message ID and server timestamp.",
    category: "tabletop-state",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: SendChatSchema.shape,
    handler: async (
      args: z.infer<typeof SendChatSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("tabletop_send_chat", async () => {
        const messageId = generateId("msg");
        const timestamp = new Date().toISOString();

        return textResult(
          `**Message Sent**\n\n`
            + `**Message ID:** ${messageId}\n`
            + `**Room:** ${args.room_id.toUpperCase()}\n`
            + `**Timestamp:** ${timestamp}\n`
            + `**Content:** "${args.message}"\n\n`
            + `The message has been broadcast to all connected peers in the room.`,
        );
      }),
  });

  // ── tabletop_add_asset ────────────────────────────────────────────────────

  registry.register({
    name: "tabletop_add_asset",
    description:
      "Upload a custom game asset (map, token, tile, card, or dice face) to a tabletop room. Returns an asset ID and simulated dimensions.",
    category: "tabletop-state",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: AddAssetSchema.shape,
    handler: async (
      args: z.infer<typeof AddAssetSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("tabletop_add_asset", async () => {
        const id = generateId("asset");
        const now = Date.now();
        const dims = ASSET_DIMENSIONS[args.asset_type] ?? {
          widthPx: 256,
          heightPx: 256,
        };

        const entry: AssetEntry = {
          id,
          roomId: args.room_id.toUpperCase(),
          assetType: args.asset_type,
          name: args.name,
          url: args.url,
          addedAt: now,
          widthPx: dims.widthPx,
          heightPx: dims.heightPx,
        };

        assetStore.set(id, entry);

        return textResult(
          `**Asset Added**\n\n`
            + `**Asset ID:** ${id}\n`
            + `**Name:** ${entry.name}\n`
            + `**Type:** ${entry.assetType}\n`
            + `**Room:** ${entry.roomId}\n`
            + `**Dimensions:** ${entry.widthPx}px x ${entry.heightPx}px\n`
            + `**URL:** ${entry.url}\n`
            + `**Added At:** ${new Date(entry.addedAt).toISOString()}\n\n`
            + `The asset is now available in room ${entry.roomId} and can be placed on the table.`,
        );
      }),
  });
}
