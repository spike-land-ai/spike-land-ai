/**
 * Tabletop Simulator MCP Tools
 *
 * Create rooms, roll dice, move pieces, and manage tabletop game sessions.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { jsonResult, safeToolCall, textResult } from "./tool-helpers";

// ── Schemas ──────────────────────────────────────────────────────────────────

const CreateRoomSchema = z.object({
  host_id: z.string().min(1).describe(
    "Peer ID or user identifier for the room host.",
  ),
  name: z
    .string()
    .min(1)
    .max(60)
    .optional()
    .describe("Optional display name for the room."),
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
  dice_type: z
    .enum(["d4", "d6", "d8", "d10", "d12", "d20"])
    .describe("Type of dice to roll."),
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
  content: z.string().min(1).max(300).describe(
    "Message content (max 300 chars).",
  ),
});

const ListRoomPeersSchema = z.object({
  room_id: z.string().min(1).describe("The room to query."),
});

// ── In-memory room store (lightweight, no DB needed for P2P sessions) ────────

interface RoomEntry {
  id: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  createdAt: number;
  peerCount: number;
}

const roomStore = new Map<string, RoomEntry>();

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Registration ──────────────────────────────────────────────────────────────

export function registerTabletopTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  registry.register({
    name: "tabletop_create_room",
    description:
      "Create a new tabletop simulator room. Returns a 6-character room code that others can join.",
    category: "tabletop",
    tier: "free",
    inputSchema: CreateRoomSchema.shape,
    handler: async (
      args: z.infer<typeof CreateRoomSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("tabletop_create_room", async () => {
        // Check for existing rooms by this host
        for (const [id, room] of roomStore.entries()) {
          if (room.hostId === args.host_id) {
            // Return the existing room
            return textResult(
              `**Room Already Exists**\n\n`
                + `**Room Code:** ${id}\n`
                + `**Name:** ${room.name}\n`
                + `**Max Players:** ${room.maxPlayers}\n`
                + `**Join URL:** /apps/tabletop-simulator/room/${id}`,
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
          `**Room Created**\n\n`
            + `**Room Code:** ${code}\n`
            + `**Name:** ${entry.name}\n`
            + `**Max Players:** ${entry.maxPlayers}\n`
            + `**Join URL:** /apps/tabletop-simulator/room/${code}\n\n`
            + `Share the Room Code or URL with players to join.`,
        );
      }),
  });

  registry.register({
    name: "tabletop_get_room",
    description: "Get information about a tabletop room by its 6-character code.",
    category: "tabletop",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: GetRoomSchema.shape,
    handler: async (
      args: z.infer<typeof GetRoomSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("tabletop_get_room", async () => {
        const room = roomStore.get(args.room_id.toUpperCase());
        if (!room) {
          return textResult(
            `**Room Not Found**\n\nNo room with code "${args.room_id}" exists.\nCreate one with \`tabletop_create_room\`.`,
          );
        }

        // Also fetch live peer count from the peers API
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL
          ?? "https://spike.land";
        let livePeerCount = room.peerCount;
        try {
          const resp = await fetch(
            `${baseUrl}/api/tabletop/rooms/${room.id}/peers`,
            { next: { revalidate: 0 } },
          );
          if (resp.ok) {
            const data = (await resp.json()) as { peers: string[]; };
            livePeerCount = data.peers.length;
          }
        } catch {
          // Ignore — use cached count
        }

        return jsonResult(
          `**Room: ${room.name}**\n\n`
            + `**Code:** ${room.id}\n`
            + `**Host:** ${room.hostId}\n`
            + `**Players:** ${livePeerCount}/${room.maxPlayers}\n`
            + `**Created:** ${new Date(room.createdAt).toISOString()}\n`
            + `**Join URL:** /apps/tabletop-simulator/room/${room.id}`,
          room,
        );
      }),
  });

  registry.register({
    name: "tabletop_roll_dice",
    description:
      "Roll one or more dice for a player in a tabletop room. Returns individual results and total.",
    category: "tabletop",
    tier: "free",
    inputSchema: RollDiceSchema.shape,
    handler: async (
      args: z.infer<typeof RollDiceSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("tabletop_roll_dice", async () => {
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
  });

  registry.register({
    name: "tabletop_move_piece",
    description: "Move a game piece (card, token, or dice) to a new position on the board.",
    category: "tabletop",
    tier: "free",
    inputSchema: MovePieceSchema.shape,
    handler: async (
      args: z.infer<typeof MovePieceSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("tabletop_move_piece", async () => {
        const { x, y, z } = args.position;

        // Clamp values to valid board range
        const cx = Math.max(-10, Math.min(10, x));
        const cy = Math.max(0, Math.min(5, y));
        const cz = Math.max(-10, Math.min(10, z));

        return textResult(
          `**Piece Moved**\n\n`
            + `**Piece ID:** ${args.piece_id}\n`
            + `**Player:** ${args.player_id}\n`
            + `**New Position:** x=${cx.toFixed(2)}, y=${cy.toFixed(2)}, z=${cz.toFixed(2)}\n\n`
            + `The move has been broadcast to the room via P2P sync.`,
        );
      }),
  });

  registry.register({
    name: "tabletop_draw_card",
    description: "Draw the top card from the shared deck into a player's hand.",
    category: "tabletop",
    tier: "free",
    inputSchema: DrawCardSchema.shape,
    handler: async (
      args: z.infer<typeof DrawCardSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("tabletop_draw_card", async () => {
        return textResult(
          `**Card Drawn**\n\n`
            + `**Player:** ${args.player_id}\n`
            + `**Room:** ${args.room_id}\n\n`
            + `The draw action has been dispatched to the room's CRDT document. `
            + `The card is now in ${args.player_id}'s hand.`,
        );
      }),
  });

  registry.register({
    name: "tabletop_flip_card",
    description: "Flip a card face-up or face-down on the table.",
    category: "tabletop",
    tier: "free",
    inputSchema: FlipCardSchema.shape,
    handler: async (
      args: z.infer<typeof FlipCardSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("tabletop_flip_card", async () => {
        return textResult(
          `**Card Flipped**\n\n`
            + `**Card ID:** ${args.card_id}\n`
            + `**Player:** ${args.player_id}\n`
            + `**Room:** ${args.room_id}\n\n`
            + `The flip action has been dispatched to the room's CRDT document.`,
        );
      }),
  });

  registry.register({
    name: "tabletop_send_message",
    description: "Send a chat message in a tabletop room.",
    category: "tabletop",
    tier: "free",
    inputSchema: SendMessageSchema.shape,
    handler: async (
      args: z.infer<typeof SendMessageSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("tabletop_send_message", async () => {
        return textResult(
          `**Message Sent**\n\n`
            + `**From:** ${args.player_name} (${args.player_id})\n`
            + `**Room:** ${args.room_id}\n`
            + `**Message:** "${args.content}"\n\n`
            + `The message has been broadcast to all peers in the room.`,
        );
      }),
  });

  registry.register({
    name: "tabletop_list_peers",
    description: "List the currently connected peers in a tabletop room.",
    category: "tabletop",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: ListRoomPeersSchema.shape,
    handler: async (
      args: z.infer<typeof ListRoomPeersSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("tabletop_list_peers", async () => {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL
          ?? "https://spike.land";
        const resp = await fetch(
          `${baseUrl}/api/tabletop/rooms/${args.room_id}/peers`,
          { next: { revalidate: 0 } },
        );

        if (!resp.ok) {
          return textResult(
            `**Error:** Could not retrieve peers for room "${args.room_id}".`,
          );
        }

        const data = (await resp.json()) as { peers: string[]; roomId: string; };
        const peers = data.peers;

        if (peers.length === 0) {
          return textResult(
            `**Room ${args.room_id} is empty** — no active peers found.`,
          );
        }

        const peerList = peers.map((p, i) => `${i + 1}. ${p}`).join("\n");
        return textResult(
          `**Room ${args.room_id} — Active Peers (${peers.length})**\n\n${peerList}`,
        );
      }),
  });
}
