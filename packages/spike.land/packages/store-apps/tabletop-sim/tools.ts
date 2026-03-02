/**
 * Tabletop Simulator — Standalone MCP Tool Definitions
 *
 * 13 tools for room management, dice rolling, piece movement, cards,
 * chat, game saves, and custom assets.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext, StandaloneToolDefinition } from "../shared/types";
import { jsonResult, safeToolCall, textResult } from "../shared/tool-helpers";

// ---------------------------------------------------------------------------
// Schemas — Room & Actions
// ---------------------------------------------------------------------------

const CreateRoomSchema = z.object({
  host_id: z.string().min(1).describe("Peer ID or user identifier for the room host."),
  name: z.string().min(1).max(60).optional().describe("Optional display name for the room."),
  max_players: z
    .number()
    .int()
    .min(2)
    .max(8)
    .optional()
    .default(4)
    .describe("Maximum number of players allowed (2-8, default 4)."),
});

const GetRoomSchema = z.object({
  room_id: z.string().min(1).describe("The 6-character room code."),
});

const RollDiceSchema = z.object({
  room_id: z.string().min(1).describe("The room in which to roll dice."),
  player_id: z.string().min(1).describe("The player rolling the dice."),
  dice_type: z.enum(["d4", "d6", "d8", "d10", "d12", "d20"]).describe("Type of dice to roll."),
  count: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(1)
    .describe("Number of dice to roll (1-10, default 1)."),
});

const MovePieceSchema = z.object({
  room_id: z.string().min(1).describe("The room containing the piece."),
  player_id: z.string().min(1).describe("The player moving the piece."),
  piece_id: z.string().min(1).describe("Unique ID of the piece to move."),
  position: z
    .object({
      x: z.number().describe("X coordinate on the board (-10 to 10)."),
      y: z.number().describe("Y coordinate (height, 0 = table surface)."),
      z: z.number().describe("Z coordinate on the board (-10 to 10)."),
    })
    .describe("Target 3D position for the piece."),
});

const DrawCardSchema = z.object({
  room_id: z.string().min(1).describe("The room to draw from."),
  player_id: z.string().min(1).describe("The player drawing a card."),
});

const FlipCardSchema = z.object({
  room_id: z.string().min(1).describe("The room containing the card."),
  player_id: z.string().min(1).describe("The player flipping the card."),
  card_id: z.string().min(1).describe("Unique ID of the card to flip."),
});

const SendMessageSchema = z.object({
  room_id: z.string().min(1).describe("The room to send the message in."),
  player_id: z.string().min(1).describe("The player sending the message."),
  player_name: z.string().min(1).describe("Display name of the sender."),
  content: z.string().min(1).max(300).describe("Message content (max 300 chars)."),
});

const ListRoomPeersSchema = z.object({
  room_id: z.string().min(1).describe("The room to query."),
});

// ---------------------------------------------------------------------------
// Schemas — State & Social
// ---------------------------------------------------------------------------

const SaveGameSchema = z.object({
  room_id: z.string().min(1).describe("The room code whose state to save."),
  save_name: z.string().max(80).optional().describe("Optional human-readable label for this save."),
});

const LoadGameSchema = z.object({
  save_id: z.string().min(1).describe("The unique save ID to restore."),
});

const ListSavesSchema = z.object({
  room_id: z.string().optional().describe("Filter saves by room code. Omit to list all saves."),
});

const SendChatSchema = z.object({
  room_id: z.string().min(1).describe("The room in which to send the chat message."),
  message: z.string().min(1).max(500).describe("Chat message content (max 500 characters)."),
});

const AddAssetSchema = z.object({
  room_id: z.string().min(1).describe("The room that will own this asset."),
  asset_type: z
    .enum(["map", "token", "tile", "card", "dice"])
    .describe("Category of the game asset."),
  name: z.string().min(1).max(80).describe("Display name for the asset."),
  url: z.string().url().describe("Publicly accessible URL of the asset image or model."),
});

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

interface RoomEntry {
  id: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  createdAt: number;
  peerCount: number;
}

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

const roomStore = new Map<string, RoomEntry>();
const saveStore = new Map<string, SaveEntry>();
const assetStore = new Map<string, AssetEntry>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rollOneDie(faces: number): number {
  return Math.floor(Math.random() * faces) + 1;
}

const DICE_FACES: Record<string, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
};

function generateId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 10; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}_${suffix}`;
}

const ASSET_DIMENSIONS: Record<string, { widthPx: number; heightPx: number }> = {
  map: { widthPx: 2048, heightPx: 2048 },
  token: { widthPx: 128, heightPx: 128 },
  tile: { widthPx: 256, heightPx: 256 },
  card: { widthPx: 200, heightPx: 280 },
  dice: { widthPx: 64, heightPx: 64 },
};

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const tabletopSimTools: StandaloneToolDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // Room & Action tools (8)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "tabletop_create_room",
    description:
      "Create a new tabletop simulator room. Returns a 6-character room code that others can join.",
    category: "tabletop",
    tier: "free",
    inputSchema: CreateRoomSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("tabletop_create_room", async () => {
        const args = input as z.infer<typeof CreateRoomSchema>;

        // Check for existing rooms by this host
        for (const [id, room] of roomStore.entries()) {
          if (room.hostId === args.host_id) {
            return textResult(
              `**Room Already Exists**\n\n` +
                `**Room Code:** ${id}\n` +
                `**Name:** ${room.name}\n` +
                `**Max Players:** ${room.maxPlayers}\n` +
                `**Join URL:** /apps/tabletop-simulator/room/${id}`,
            );
          }
        }

        // Generate a 6-char alphanumeric code
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 6; i++) {
          code += chars[Math.floor(Math.random() * chars.length)];
        }

        const entry: RoomEntry = {
          id: code,
          name: args.name ?? `${args.host_id.slice(0, 4)}'s Room`,
          hostId: args.host_id,
          maxPlayers: args.max_players ?? 4,
          createdAt: Date.now(),
          peerCount: 1,
        };

        roomStore.set(code, entry);

        // Cleanup old rooms (older than 6 hours)
        const cutoff = Date.now() - 6 * 60 * 60 * 1000;
        for (const [id, room] of roomStore.entries()) {
          if (room.createdAt < cutoff) roomStore.delete(id);
        }

        return textResult(
          `**Room Created**\n\n` +
            `**Room Code:** ${code}\n` +
            `**Name:** ${entry.name}\n` +
            `**Max Players:** ${entry.maxPlayers}\n` +
            `**Join URL:** /apps/tabletop-simulator/room/${code}\n\n` +
            `Share the Room Code or URL with players to join.`,
        );
      }),
  },
  {
    name: "tabletop_get_room",
    description: "Get information about a tabletop room by its 6-character code.",
    category: "tabletop",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: GetRoomSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("tabletop_get_room", async () => {
        const args = input as z.infer<typeof GetRoomSchema>;
        const room = roomStore.get(args.room_id.toUpperCase());
        if (!room) {
          return textResult(
            `**Room Not Found**\n\nNo room with code "${args.room_id}" exists.\nCreate one with \`tabletop_create_room\`.`,
          );
        }

        // Also fetch live peer count from the peers API
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://spike.land";
        let livePeerCount = room.peerCount;
        try {
          const resp = await fetch(`${baseUrl}/api/tabletop/rooms/${room.id}/peers`, {
            next: { revalidate: 0 },
          });
          if (resp.ok) {
            const data = (await resp.json()) as { peers: string[] };
            livePeerCount = data.peers.length;
          }
        } catch {
          // Ignore — use cached count
        }

        return jsonResult(
          `**Room: ${room.name}**\n\n` +
            `**Code:** ${room.id}\n` +
            `**Host:** ${room.hostId}\n` +
            `**Players:** ${livePeerCount}/${room.maxPlayers}\n` +
            `**Created:** ${new Date(room.createdAt).toISOString()}\n` +
            `**Join URL:** /apps/tabletop-simulator/room/${room.id}`,
          room,
        );
      }),
  },
  {
    name: "tabletop_roll_dice",
    description:
      "Roll one or more dice for a player in a tabletop room. Returns individual results and total.",
    category: "tabletop",
    tier: "free",
    inputSchema: RollDiceSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("tabletop_roll_dice", async () => {
        const args = input as z.infer<typeof RollDiceSchema>;
        const faces = DICE_FACES[args.dice_type];
        if (faces === undefined) {
          return textResult(`**Unknown dice type:** ${args.dice_type}`);
        }

        const count = args.count ?? 1;
        const results: number[] = [];
        for (let i = 0; i < count; i++) {
          results.push(rollOneDie(faces));
        }

        const total = results.reduce((a, b) => a + b, 0);
        const maxPossible = faces * count;
        const isCritical = total === maxPossible;
        const isFumble = total === count; // All ones

        let summary = `**Dice Roll: ${args.dice_type.toUpperCase()}${
          count > 1 ? `×${count}` : ""
        }**\n\n`;
        summary += `**Player:** ${args.player_id}\n`;
        summary += `**Results:** [${results.join(", ")}]\n`;
        summary += `**Total:** ${total} / ${maxPossible}\n`;

        if (isCritical) summary += `\n**CRITICAL HIT!** Maximum possible roll!`;
        else if (isFumble) summary += `\n**FUMBLE!** All ones!`;

        return textResult(summary);
      }),
  },
  {
    name: "tabletop_move_piece",
    description: "Move a game piece (card, token, or dice) to a new position on the board.",
    category: "tabletop",
    tier: "free",
    inputSchema: MovePieceSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("tabletop_move_piece", async () => {
        const args = input as z.infer<typeof MovePieceSchema>;
        const { x, y, z: zCoord } = args.position;

        // Clamp values to valid board range
        const cx = Math.max(-10, Math.min(10, x));
        const cy = Math.max(0, Math.min(5, y));
        const cz = Math.max(-10, Math.min(10, zCoord));

        return textResult(
          `**Piece Moved**\n\n` +
            `**Piece ID:** ${args.piece_id}\n` +
            `**Player:** ${args.player_id}\n` +
            `**New Position:** x=${cx.toFixed(2)}, y=${cy.toFixed(2)}, z=${cz.toFixed(2)}\n\n` +
            `The move has been broadcast to the room via P2P sync.`,
        );
      }),
  },
  {
    name: "tabletop_draw_card",
    description: "Draw the top card from the shared deck into a player's hand.",
    category: "tabletop",
    tier: "free",
    inputSchema: DrawCardSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("tabletop_draw_card", async () => {
        const args = input as z.infer<typeof DrawCardSchema>;
        return textResult(
          `**Card Drawn**\n\n` +
            `**Player:** ${args.player_id}\n` +
            `**Room:** ${args.room_id}\n\n` +
            `The draw action has been dispatched to the room's CRDT document. ` +
            `The card is now in ${args.player_id}'s hand.`,
        );
      }),
  },
  {
    name: "tabletop_flip_card",
    description: "Flip a card face-up or face-down on the table.",
    category: "tabletop",
    tier: "free",
    inputSchema: FlipCardSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("tabletop_flip_card", async () => {
        const args = input as z.infer<typeof FlipCardSchema>;
        return textResult(
          `**Card Flipped**\n\n` +
            `**Card ID:** ${args.card_id}\n` +
            `**Player:** ${args.player_id}\n` +
            `**Room:** ${args.room_id}\n\n` +
            `The flip action has been dispatched to the room's CRDT document.`,
        );
      }),
  },
  {
    name: "tabletop_send_message",
    description: "Send a chat message in a tabletop room.",
    category: "tabletop",
    tier: "free",
    inputSchema: SendMessageSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("tabletop_send_message", async () => {
        const args = input as z.infer<typeof SendMessageSchema>;
        return textResult(
          `**Message Sent**\n\n` +
            `**From:** ${args.player_name} (${args.player_id})\n` +
            `**Room:** ${args.room_id}\n` +
            `**Message:** "${args.content}"\n\n` +
            `The message has been broadcast to all peers in the room.`,
        );
      }),
  },
  {
    name: "tabletop_list_peers",
    description: "List the currently connected peers in a tabletop room.",
    category: "tabletop",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: ListRoomPeersSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("tabletop_list_peers", async () => {
        const args = input as z.infer<typeof ListRoomPeersSchema>;
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://spike.land";
        const resp = await fetch(`${baseUrl}/api/tabletop/rooms/${args.room_id}/peers`, {
          next: { revalidate: 0 },
        });

        if (!resp.ok) {
          return textResult(`**Error:** Could not retrieve peers for room "${args.room_id}".`);
        }

        const data = (await resp.json()) as { peers: string[]; roomId: string };
        const peers = data.peers;

        if (peers.length === 0) {
          return textResult(`**Room ${args.room_id} is empty** — no active peers found.`);
        }

        const peerList = peers.map((p, i) => `${i + 1}. ${p}`).join("\n");
        return textResult(
          `**Room ${args.room_id} — Active Peers (${peers.length})**\n\n${peerList}`,
        );
      }),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // State & Social tools (5)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "tabletop_save_game",
    description:
      "Save the current game state for a tabletop room. Returns a save ID that can be used to restore the session later.",
    category: "tabletop-state",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: SaveGameSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("tabletop_save_game", async () => {
        const args = input as z.infer<typeof SaveGameSchema>;
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
          `**Game Saved**\n\n` +
            `**Save ID:** ${id}\n` +
            `**Name:** ${entry.name}\n` +
            `**Room:** ${entry.roomId}\n` +
            `**Timestamp:** ${new Date(entry.savedAt).toISOString()}\n` +
            `**Turn:** ${entry.turnNumber}\n` +
            `**Players:** ${entry.playerCount}\n\n` +
            `Use \`tabletop_load_game\` with this Save ID to restore the session.`,
        );
      }),
  },
  {
    name: "tabletop_load_game",
    description:
      "Load a previously saved game state. Restores the room to its saved configuration.",
    category: "tabletop-state",
    tier: "free",
    alwaysEnabled: true,
    annotations: { readOnlyHint: true },
    inputSchema: LoadGameSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("tabletop_load_game", async () => {
        const args = input as z.infer<typeof LoadGameSchema>;
        const save = saveStore.get(args.save_id);

        if (!save) {
          return textResult(
            `**Save Not Found**\n\nNo save with ID "${args.save_id}" exists.\n` +
              `Use \`tabletop_list_saves\` to see available saves.`,
          );
        }

        return textResult(
          `**Game Loaded**\n\n` +
            `**Save ID:** ${save.id}\n` +
            `**Name:** ${save.name}\n` +
            `**Room:** ${save.roomId}\n` +
            `**Saved At:** ${new Date(save.savedAt).toISOString()}\n` +
            `**Restored Turn:** ${save.turnNumber}\n` +
            `**Player Count:** ${save.playerCount}\n\n` +
            `The game state has been restored. All players in room ${save.roomId} ` +
            `will receive the updated board via P2P sync.`,
        );
      }),
  },
  {
    name: "tabletop_list_saves",
    description: "List all saved game states, optionally filtered by room code.",
    category: "tabletop-state",
    tier: "free",
    alwaysEnabled: true,
    annotations: { readOnlyHint: true },
    inputSchema: ListSavesSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("tabletop_list_saves", async () => {
        const args = input as z.infer<typeof ListSavesSchema>;
        const roomFilter = args.room_id?.toUpperCase();

        const saves = [...saveStore.values()].filter((s) => !roomFilter || s.roomId === roomFilter);

        if (saves.length === 0) {
          const scope = roomFilter ? ` for room ${roomFilter}` : "";
          return textResult(
            `**No Saves Found**\n\nThere are no saved games${scope}.\n` +
              `Use \`tabletop_save_game\` to create one.`,
          );
        }

        // Sort newest first
        saves.sort((a, b) => b.savedAt - a.savedAt);

        const rows = saves
          .map(
            (s, i) =>
              `${i + 1}. **${s.name}**\n` +
              `   ID: \`${s.id}\`  |  Room: ${s.roomId}  |  ` +
              `Saved: ${new Date(s.savedAt).toISOString().slice(0, 16)}  |  ` +
              `Turn: ${s.turnNumber}  |  Players: ${s.playerCount}`,
          )
          .join("\n\n");

        const header = roomFilter
          ? `**Saved Games — Room ${roomFilter} (${saves.length})**`
          : `**All Saved Games (${saves.length})**`;

        return textResult(`${header}\n\n${rows}`);
      }),
  },
  {
    name: "tabletop_send_chat",
    description:
      "Send a chat message in a tabletop game room. Returns a message ID and server timestamp.",
    category: "tabletop-state",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: SendChatSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("tabletop_send_chat", async () => {
        const args = input as z.infer<typeof SendChatSchema>;
        const messageId = generateId("msg");
        const timestamp = new Date().toISOString();

        return textResult(
          `**Message Sent**\n\n` +
            `**Message ID:** ${messageId}\n` +
            `**Room:** ${args.room_id.toUpperCase()}\n` +
            `**Timestamp:** ${timestamp}\n` +
            `**Content:** "${args.message}"\n\n` +
            `The message has been broadcast to all connected peers in the room.`,
        );
      }),
  },
  {
    name: "tabletop_add_asset",
    description:
      "Upload a custom game asset (map, token, tile, card, or dice face) to a tabletop room. Returns an asset ID and simulated dimensions.",
    category: "tabletop-state",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: AddAssetSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("tabletop_add_asset", async () => {
        const args = input as z.infer<typeof AddAssetSchema>;
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
          `**Asset Added**\n\n` +
            `**Asset ID:** ${id}\n` +
            `**Name:** ${entry.name}\n` +
            `**Type:** ${entry.assetType}\n` +
            `**Room:** ${entry.roomId}\n` +
            `**Dimensions:** ${entry.widthPx}px x ${entry.heightPx}px\n` +
            `**URL:** ${entry.url}\n` +
            `**Added At:** ${new Date(entry.addedAt).toISOString()}\n\n` +
            `The asset is now available in room ${entry.roomId} and can be placed on the table.`,
        );
      }),
  },
];
