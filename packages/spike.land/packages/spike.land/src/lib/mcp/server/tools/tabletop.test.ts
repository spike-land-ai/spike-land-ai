import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock global fetch used by tabletop_get_room and tabletop_list_peers
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { createMockRegistry, getText } from "../__test-utils__";
import { registerTabletopTools } from "./tabletop";

// Helper to build a successful JSON fetch response
function makeFetchOk(body: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// Helper to build a failed fetch response
function makeFetchError(): Response {
  return {
    ok: false,
    json: () => Promise.reject(new Error("not ok")),
  } as unknown as Response;
}

describe("tabletop tools", () => {
  const userId = "test-user";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerTabletopTools(registry, userId);
  });

  it("registers 8 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(8);
    expect(registry.handlers.has("tabletop_create_room")).toBe(true);
    expect(registry.handlers.has("tabletop_get_room")).toBe(true);
    expect(registry.handlers.has("tabletop_roll_dice")).toBe(true);
    expect(registry.handlers.has("tabletop_move_piece")).toBe(true);
    expect(registry.handlers.has("tabletop_draw_card")).toBe(true);
    expect(registry.handlers.has("tabletop_flip_card")).toBe(true);
    expect(registry.handlers.has("tabletop_send_message")).toBe(true);
    expect(registry.handlers.has("tabletop_list_peers")).toBe(true);
  });

  // ── tabletop_create_room ─────────────────────────────────────────────────

  describe("tabletop_create_room", () => {
    it("creates a new room and returns a 6-character room code", async () => {
      const result = await registry.call("tabletop_create_room", {
        host_id: "host-unique-1",
        name: "My Test Room",
        max_players: 4,
      });
      const text = getText(result);
      expect(text).toContain("Room Created");
      expect(text).toContain("My Test Room");
      expect(text).toContain("Max Players:** 4");
      expect(text).toContain("Join URL:");
      // Room code embedded in URL should be 6 uppercase alphanumeric chars
      const codeMatch = text.match(/room\/([A-Z0-9]{6})/);
      expect(codeMatch).not.toBeNull();
    });

    it("uses default room name derived from host_id when name is omitted", async () => {
      const result = await registry.call("tabletop_create_room", {
        host_id: "abcd-efgh",
      });
      const text = getText(result);
      expect(text).toContain("Room Created");
      // Default name uses first 4 chars of host_id
      expect(text).toContain("abcd");
    });

    it("returns existing room when same host already has a room", async () => {
      // First call creates the room
      await registry.call("tabletop_create_room", {
        host_id: "returning-host",
        name: "First Room",
      });

      // Second call with same host_id should return the existing room
      const result = await registry.call("tabletop_create_room", {
        host_id: "returning-host",
        name: "Second Room Attempt",
      });
      const text = getText(result);
      expect(text).toContain("Room Already Exists");
      expect(text).toContain("Room Code:");
    });

    it("uses default max_players of 4 when not specified", async () => {
      const result = await registry.call("tabletop_create_room", {
        host_id: "host-default-max",
      });
      const text = getText(result);
      expect(text).toContain("Max Players:** 4");
    });
  });

  // ── tabletop_get_room ────────────────────────────────────────────────────

  describe("tabletop_get_room", () => {
    it("returns room details when room exists and peers API succeeds", async () => {
      // Create a room first so the store has an entry
      const createResult = await registry.call("tabletop_create_room", {
        host_id: "host-get-room-ok",
        name: "Lookup Room",
        max_players: 3,
      });
      const createText = getText(createResult);
      const codeMatch = createText.match(/Room Code:\*\* ([A-Z0-9]{6})/);
      expect(codeMatch).not.toBeNull();
      const roomCode = codeMatch![1]!;

      mockFetch.mockResolvedValueOnce(
        makeFetchOk({ peers: ["peer-1", "peer-2"] }),
      );

      const result = await registry.call("tabletop_get_room", {
        room_id: roomCode,
      });
      const text = getText(result);
      expect(text).toContain("Lookup Room");
      expect(text).toContain(roomCode);
      expect(text).toContain("host-get-room-ok");
      // Live peer count from mock response
      expect(text).toContain("2/3");
    });

    it("falls back to cached peer count when peers API fails", async () => {
      const createResult = await registry.call("tabletop_create_room", {
        host_id: "host-get-room-fail",
        name: "Fallback Room",
      });
      const createText = getText(createResult);
      const codeMatch = createText.match(/Room Code:\*\* ([A-Z0-9]{6})/);
      const roomCode = codeMatch![1]!;

      mockFetch.mockRejectedValueOnce(new Error("network error"));

      const result = await registry.call("tabletop_get_room", {
        room_id: roomCode,
      });
      const text = getText(result);
      // Should still return room info with cached peerCount of 1
      expect(text).toContain("Fallback Room");
      expect(text).toContain("1/4");
    });

    it("returns not-found message for unknown room code", async () => {
      const result = await registry.call("tabletop_get_room", {
        room_id: "ZZZZZZ",
      });
      const text = getText(result);
      expect(text).toContain("Room Not Found");
      expect(text).toContain("ZZZZZZ");
    });

    it("normalizes room_id to uppercase before lookup", async () => {
      const createResult = await registry.call("tabletop_create_room", {
        host_id: "host-case-test",
        name: "Case Room",
      });
      const createText = getText(createResult);
      const codeMatch = createText.match(/Room Code:\*\* ([A-Z0-9]{6})/);
      const roomCode = codeMatch![1]!;

      mockFetch.mockResolvedValueOnce(makeFetchOk({ peers: [] }));

      const result = await registry.call("tabletop_get_room", {
        room_id: roomCode.toLowerCase(),
      });
      const text = getText(result);
      expect(text).toContain("Case Room");
    });
  });

  // ── tabletop_roll_dice ───────────────────────────────────────────────────

  describe("tabletop_roll_dice", () => {
    it("rolls a single d6 and returns result within valid range", async () => {
      const result = await registry.call("tabletop_roll_dice", {
        room_id: "ROOM01",
        player_id: "player-1",
        dice_type: "d6",
        count: 1,
      });
      const text = getText(result);
      expect(text).toContain("Dice Roll: D6");
      expect(text).toContain("player-1");
      expect(text).toContain("Results:");
      expect(text).toContain("Total:");
      expect(text).toContain("/ 6");
    });

    it("rolls multiple d20 dice and sums them", async () => {
      const result = await registry.call("tabletop_roll_dice", {
        room_id: "ROOM01",
        player_id: "player-2",
        dice_type: "d20",
        count: 3,
      });
      const text = getText(result);
      expect(text).toContain("D20");
      // count > 1 shows multiplication symbol
      expect(text).toContain("×3");
      expect(text).toContain("/ 60");
    });

    it("shows CRITICAL HIT when total equals max possible", async () => {
      // Spy on Math.random to force max roll
      vi.spyOn(Math, "random").mockReturnValue(0.9999);
      const result = await registry.call("tabletop_roll_dice", {
        room_id: "ROOM01",
        player_id: "player-3",
        dice_type: "d4",
        count: 1,
      });
      vi.restoreAllMocks();
      const text = getText(result);
      expect(text).toContain("CRITICAL HIT");
    });

    it("shows FUMBLE when all dice roll ones", async () => {
      // Return 0 so floor(0 * faces) + 1 = 1 for all dice
      vi.spyOn(Math, "random").mockReturnValue(0);
      const result = await registry.call("tabletop_roll_dice", {
        room_id: "ROOM01",
        player_id: "player-4",
        dice_type: "d12",
        count: 2,
      });
      vi.restoreAllMocks();
      const text = getText(result);
      expect(text).toContain("FUMBLE");
    });

    it("uses default count of 1 when count is omitted", async () => {
      const result = await registry.call("tabletop_roll_dice", {
        room_id: "ROOM01",
        player_id: "player-5",
        dice_type: "d8",
      });
      const text = getText(result);
      // Single die shows type without multiplication
      expect(text).toContain("D8");
      expect(text).not.toContain("×");
    });

    it.each(["d4", "d6", "d8", "d10", "d12", "d20"] as const)(
      "accepts valid dice type %s",
      async diceType => {
        const result = await registry.call("tabletop_roll_dice", {
          room_id: "ROOM01",
          player_id: "player-x",
          dice_type: diceType,
          count: 1,
        });
        const text = getText(result);
        expect(text).toContain("Dice Roll:");
        expect(text).not.toContain("Unknown dice type");
      },
    );
  });

  // ── tabletop_move_piece ──────────────────────────────────────────────────

  describe("tabletop_move_piece", () => {
    it("moves a piece to the given position and confirms broadcast", async () => {
      const result = await registry.call("tabletop_move_piece", {
        room_id: "ROOM01",
        player_id: "player-1",
        piece_id: "token-42",
        position: { x: 3, y: 0, z: -5 },
      });
      const text = getText(result);
      expect(text).toContain("Piece Moved");
      expect(text).toContain("token-42");
      expect(text).toContain("player-1");
      expect(text).toContain("x=3.00");
      expect(text).toContain("y=0.00");
      expect(text).toContain("z=-5.00");
      expect(text).toContain("P2P sync");
    });

    it("clamps x and z coordinates to the [-10, 10] board boundary", async () => {
      const result = await registry.call("tabletop_move_piece", {
        room_id: "ROOM01",
        player_id: "player-1",
        piece_id: "token-out",
        position: { x: 99, y: 0, z: -99 },
      });
      const text = getText(result);
      expect(text).toContain("x=10.00");
      expect(text).toContain("z=-10.00");
    });

    it("clamps y coordinate to [0, 5] height range", async () => {
      const result = await registry.call("tabletop_move_piece", {
        room_id: "ROOM01",
        player_id: "player-1",
        piece_id: "token-high",
        position: { x: 0, y: 100, z: 0 },
      });
      const text = getText(result);
      expect(text).toContain("y=5.00");
    });

    it("does not clamp coordinates already within valid bounds", async () => {
      const result = await registry.call("tabletop_move_piece", {
        room_id: "ROOM01",
        player_id: "player-1",
        piece_id: "token-valid",
        position: { x: -10, y: 5, z: 10 },
      });
      const text = getText(result);
      expect(text).toContain("x=-10.00");
      expect(text).toContain("y=5.00");
      expect(text).toContain("z=10.00");
    });
  });

  // ── tabletop_draw_card ───────────────────────────────────────────────────

  describe("tabletop_draw_card", () => {
    it("draws a card and confirms it is in the player's hand", async () => {
      const result = await registry.call("tabletop_draw_card", {
        room_id: "ROOM01",
        player_id: "player-1",
      });
      const text = getText(result);
      expect(text).toContain("Card Drawn");
      expect(text).toContain("player-1");
      expect(text).toContain("ROOM01");
      expect(text).toContain("CRDT document");
    });

    it("reflects the correct room_id and player_id in the response", async () => {
      const result = await registry.call("tabletop_draw_card", {
        room_id: "ABCDEF",
        player_id: "alice",
      });
      const text = getText(result);
      expect(text).toContain("ABCDEF");
      expect(text).toContain("alice");
    });
  });

  // ── tabletop_flip_card ───────────────────────────────────────────────────

  describe("tabletop_flip_card", () => {
    it("flips a card and confirms the CRDT dispatch", async () => {
      const result = await registry.call("tabletop_flip_card", {
        room_id: "ROOM01",
        player_id: "player-1",
        card_id: "card-007",
      });
      const text = getText(result);
      expect(text).toContain("Card Flipped");
      expect(text).toContain("card-007");
      expect(text).toContain("player-1");
      expect(text).toContain("ROOM01");
      expect(text).toContain("CRDT document");
    });

    it("includes all three identifiers in the response", async () => {
      const result = await registry.call("tabletop_flip_card", {
        room_id: "XYZ999",
        player_id: "bob",
        card_id: "joker-red",
      });
      const text = getText(result);
      expect(text).toContain("XYZ999");
      expect(text).toContain("bob");
      expect(text).toContain("joker-red");
    });
  });

  // ── tabletop_send_message ────────────────────────────────────────────────

  describe("tabletop_send_message", () => {
    it("sends a chat message and confirms broadcast", async () => {
      const result = await registry.call("tabletop_send_message", {
        room_id: "ROOM01",
        player_id: "player-1",
        player_name: "Alice",
        content: "Hello everyone!",
      });
      const text = getText(result);
      expect(text).toContain("Message Sent");
      expect(text).toContain("Alice");
      expect(text).toContain("player-1");
      expect(text).toContain("ROOM01");
      expect(text).toContain("Hello everyone!");
      expect(text).toContain("broadcast to all peers");
    });

    it("includes display name and player_id together in the From field", async () => {
      const result = await registry.call("tabletop_send_message", {
        room_id: "ROOM02",
        player_id: "uid-456",
        player_name: "DragonSlayer",
        content: "Ready to play?",
      });
      const text = getText(result);
      expect(text).toContain("DragonSlayer");
      expect(text).toContain("uid-456");
      expect(text).toContain("Ready to play?");
    });
  });

  // ── tabletop_list_peers ──────────────────────────────────────────────────

  describe("tabletop_list_peers", () => {
    it("lists active peers when API returns a populated peer list", async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchOk({ peers: ["peer-alpha", "peer-beta", "peer-gamma"], roomId: "ROOM01" }),
      );

      const result = await registry.call("tabletop_list_peers", {
        room_id: "ROOM01",
      });
      const text = getText(result);
      expect(text).toContain("ROOM01");
      expect(text).toContain("Active Peers (3)");
      expect(text).toContain("peer-alpha");
      expect(text).toContain("peer-beta");
      expect(text).toContain("peer-gamma");
    });

    it("returns empty-room message when peer list is empty", async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchOk({ peers: [], roomId: "EMPTY1" }),
      );

      const result = await registry.call("tabletop_list_peers", {
        room_id: "EMPTY1",
      });
      const text = getText(result);
      expect(text).toContain("EMPTY1");
      expect(text).toContain("empty");
    });

    it("returns error message when peers API call fails", async () => {
      mockFetch.mockResolvedValueOnce(makeFetchError());

      const result = await registry.call("tabletop_list_peers", {
        room_id: "BADROOM",
      });
      const text = getText(result);
      expect(text).toContain("Error");
      expect(text).toContain("BADROOM");
    });

    it("numbers peers sequentially starting from 1", async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchOk({ peers: ["alice", "bob"], roomId: "ROOM01" }),
      );

      const result = await registry.call("tabletop_list_peers", {
        room_id: "ROOM01",
      });
      const text = getText(result);
      expect(text).toContain("1. alice");
      expect(text).toContain("2. bob");
    });
  });
});
