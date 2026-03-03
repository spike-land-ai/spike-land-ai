import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerTabletopStateTools } from "./tabletop-state";

describe("Tabletop State MCP Tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerTabletopStateTools(
      registry as unknown as Parameters<typeof registerTabletopStateTools>[0],
      "user-test-1",
    );
  });

  // ── Registration ────────────────────────────────────────────────────────────

  it("registers exactly 5 tabletop-state tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("tabletop_save_game")).toBe(true);
    expect(registry.handlers.has("tabletop_load_game")).toBe(true);
    expect(registry.handlers.has("tabletop_list_saves")).toBe(true);
    expect(registry.handlers.has("tabletop_send_chat")).toBe(true);
    expect(registry.handlers.has("tabletop_add_asset")).toBe(true);
  });

  // ── tabletop_save_game ──────────────────────────────────────────────────────

  describe("tabletop_save_game", () => {
    it("returns a save ID and room info on success", async () => {
      const result = await registry.call("tabletop_save_game", {
        room_id: "ABC123",
      });
      const text = getText(result);
      expect(text).toContain("Game Saved");
      expect(text).toContain("Save ID:");
      expect(text).toContain("ABC123");
      expect(text).toContain("Turn:");
      expect(text).toContain("Players:");
    });

    it("uses the provided save_name when given", async () => {
      const result = await registry.call("tabletop_save_game", {
        room_id: "ROOM01",
        save_name: "My Epic Save",
      });
      const text = getText(result);
      expect(text).toContain("My Epic Save");
    });

    it("auto-generates a save name when save_name is omitted", async () => {
      const result = await registry.call("tabletop_save_game", {
        room_id: "ROOM02",
      });
      const text = getText(result);
      // Auto name contains ISO date prefix (e.g. "2026-02")
      expect(text).toMatch(/Save 20\d\d-\d\d/);
    });

    it("normalises room_id to upper case in output", async () => {
      const result = await registry.call("tabletop_save_game", {
        room_id: "abc999",
      });
      expect(getText(result)).toContain("ABC999");
    });

    it("includes tabletop_load_game hint in the response", async () => {
      const result = await registry.call("tabletop_save_game", {
        room_id: "HINT01",
      });
      expect(getText(result)).toContain("tabletop_load_game");
    });
  });

  // ── tabletop_load_game ──────────────────────────────────────────────────────

  describe("tabletop_load_game", () => {
    it("loads a previously saved game by its save ID", async () => {
      // First save
      const saveResult = await registry.call("tabletop_save_game", {
        room_id: "LOADME",
        save_name: "Test Save",
      });
      const saveText = getText(saveResult);
      const match = /Save ID:\** (.+)/.exec(saveText);
      expect(match).not.toBeNull();
      const saveId = match![1]!.trim();

      // Now load it
      const loadResult = await registry.call("tabletop_load_game", {
        save_id: saveId,
      });
      const loadText = getText(loadResult);
      expect(loadText).toContain("Game Loaded");
      expect(loadText).toContain("Test Save");
      expect(loadText).toContain("LOADME");
      expect(loadText).toContain(saveId);
    });

    it("returns not-found message for unknown save IDs", async () => {
      const result = await registry.call("tabletop_load_game", {
        save_id: "save_nonexistent999",
      });
      const text = getText(result);
      expect(isError(result)).toBe(false); // graceful message, not an error
      expect(text).toContain("Save Not Found");
      expect(text).toContain("tabletop_list_saves");
    });

    it("mentions P2P sync in the success response", async () => {
      const saveResult = await registry.call("tabletop_save_game", {
        room_id: "SYNC01",
      });
      const saveId = /Save ID:\** (.+)/.exec(getText(saveResult))![1]!.trim();

      const result = await registry.call("tabletop_load_game", {
        save_id: saveId,
      });
      expect(getText(result)).toContain("P2P sync");
    });
  });

  // ── tabletop_list_saves ─────────────────────────────────────────────────────

  describe("tabletop_list_saves", () => {
    it("returns empty message when no saves exist for a room", async () => {
      const result = await registry.call("tabletop_list_saves", {
        room_id: "EMPTY1",
      });
      const text = getText(result);
      expect(text).toContain("No Saves Found");
      expect(text).toContain("tabletop_save_game");
    });

    it("lists saves after creating one", async () => {
      await registry.call("tabletop_save_game", {
        room_id: "LISTME",
        save_name: "Listed Save",
      });

      const result = await registry.call("tabletop_list_saves", {
        room_id: "LISTME",
      });
      const text = getText(result);
      expect(text).toContain("Listed Save");
      expect(text).toContain("LISTME");
    });

    it("filters saves by room_id correctly", async () => {
      await registry.call("tabletop_save_game", {
        room_id: "ROOMA",
        save_name: "Room A Save",
      });
      await registry.call("tabletop_save_game", {
        room_id: "ROOMB",
        save_name: "Room B Save",
      });

      const result = await registry.call("tabletop_list_saves", {
        room_id: "ROOMA",
      });
      const text = getText(result);
      expect(text).toContain("Room A Save");
      expect(text).not.toContain("Room B Save");
    });

    it("returns all saves when room_id is omitted", async () => {
      await registry.call("tabletop_save_game", {
        room_id: "ALLA",
        save_name: "Save Alpha",
      });
      await registry.call("tabletop_save_game", {
        room_id: "ALLB",
        save_name: "Save Beta",
      });

      const result = await registry.call("tabletop_list_saves", {});
      const text = getText(result);
      expect(text).toContain("Save Alpha");
      expect(text).toContain("Save Beta");
    });
  });

  // ── tabletop_send_chat ──────────────────────────────────────────────────────

  describe("tabletop_send_chat", () => {
    it("returns a message ID and timestamp on success", async () => {
      const result = await registry.call("tabletop_send_chat", {
        room_id: "CHATR1",
        message: "Hello everyone!",
      });
      const text = getText(result);
      expect(text).toContain("Message Sent");
      expect(text).toContain("Message ID:");
      expect(text).toContain("CHATR1");
      expect(text).toContain("Hello everyone!");
    });

    it("normalises room_id to upper case", async () => {
      const result = await registry.call("tabletop_send_chat", {
        room_id: "chat42",
        message: "Testing",
      });
      expect(getText(result)).toContain("CHAT42");
    });

    it("mentions broadcast to peers in the response", async () => {
      const result = await registry.call("tabletop_send_chat", {
        room_id: "BCAST1",
        message: "Broadcast test",
      });
      expect(getText(result)).toContain("broadcast");
    });

    it("includes the full message text in the response", async () => {
      const msg = "This is a longer message with special chars: & < >";
      const result = await registry.call("tabletop_send_chat", {
        room_id: "MSGFULL",
        message: msg,
      });
      expect(getText(result)).toContain(msg);
    });
  });

  // ── tabletop_add_asset ──────────────────────────────────────────────────────

  describe("tabletop_add_asset", () => {
    it("adds a map asset and returns correct dimensions", async () => {
      const result = await registry.call("tabletop_add_asset", {
        room_id: "MAPROOM",
        asset_type: "map",
        name: "Forest Map",
        url: "https://cdn.example.com/forest-map.png",
      });
      const text = getText(result);
      expect(text).toContain("Asset Added");
      expect(text).toContain("Forest Map");
      expect(text).toContain("map");
      expect(text).toContain("2048px x 2048px");
    });

    it("adds a token asset with correct 128x128 dimensions", async () => {
      const result = await registry.call("tabletop_add_asset", {
        room_id: "TOKROOM",
        asset_type: "token",
        name: "Dragon Token",
        url: "https://cdn.example.com/dragon.png",
      });
      expect(getText(result)).toContain("128px x 128px");
    });

    it("adds a card asset with correct 200x280 dimensions", async () => {
      const result = await registry.call("tabletop_add_asset", {
        room_id: "CARDROOM",
        asset_type: "card",
        name: "Wild Card",
        url: "https://cdn.example.com/wild.png",
      });
      expect(getText(result)).toContain("200px x 280px");
    });

    it("adds a tile asset with correct 256x256 dimensions", async () => {
      const result = await registry.call("tabletop_add_asset", {
        room_id: "TILEROOM",
        asset_type: "tile",
        name: "Stone Tile",
        url: "https://cdn.example.com/stone.png",
      });
      expect(getText(result)).toContain("256px x 256px");
    });

    it("adds a dice asset with correct 64x64 dimensions", async () => {
      const result = await registry.call("tabletop_add_asset", {
        room_id: "DICEROOM",
        asset_type: "dice",
        name: "Crystal Die",
        url: "https://cdn.example.com/crystal-die.png",
      });
      expect(getText(result)).toContain("64px x 64px");
    });

    it("returns the asset ID in the response", async () => {
      const result = await registry.call("tabletop_add_asset", {
        room_id: "IDCHECK",
        asset_type: "token",
        name: "ID Token",
        url: "https://cdn.example.com/id-token.png",
      });
      const text = getText(result);
      expect(text).toContain("Asset ID:");
      expect(text).toMatch(/asset_[a-z0-9]{10}/);
    });

    it("normalises room_id to upper case in asset response", async () => {
      const result = await registry.call("tabletop_add_asset", {
        room_id: "lower1",
        asset_type: "map",
        name: "Test Map",
        url: "https://cdn.example.com/test-map.png",
      });
      expect(getText(result)).toContain("LOWER1");
    });
  });
});
