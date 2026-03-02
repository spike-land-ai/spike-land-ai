/**
 * Tabletop Simulator — Standalone Tool Tests
 */

import { describe, expect, it } from "vitest";
import { tabletopSimTools } from "./tools";
import { createMockContext, createMockRegistry } from "../shared/test-utils";

describe("tabletop-sim tools", () => {
  const registry = createMockRegistry(tabletopSimTools);

  it("exports all 13 tabletop tools", () => {
    expect(tabletopSimTools).toHaveLength(13);
  });

  it("has unique tool names", () => {
    const names = tabletopSimTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("all tool names start with tabletop_", () => {
    for (const tool of tabletopSimTools) {
      expect(tool.name).toMatch(/^tabletop_/);
    }
  });

  it("all tools have tier set to free", () => {
    for (const tool of tabletopSimTools) {
      expect(tool.tier).toBe("free");
    }
  });

  it("registry can list all tool names", () => {
    const names = registry.getToolNames();
    expect(names).toHaveLength(13);
    expect(names).toContain("tabletop_create_room");
    expect(names).toContain("tabletop_roll_dice");
    expect(names).toContain("tabletop_save_game");
    expect(names).toContain("tabletop_add_asset");
  });

  describe("categories", () => {
    it("has tabletop tools", () => {
      const tools = registry.getToolsByCategory("tabletop");
      expect(tools).toHaveLength(8);
    });

    it("has tabletop-state tools", () => {
      const tools = registry.getToolsByCategory("tabletop-state");
      expect(tools).toHaveLength(5);
    });
  });

  describe("annotations", () => {
    it("read-only tools have readOnlyHint annotation", () => {
      const readOnlyNames = [
        "tabletop_get_room",
        "tabletop_list_peers",
        "tabletop_load_game",
        "tabletop_list_saves",
      ];

      for (const name of readOnlyNames) {
        const tool = tabletopSimTools.find((t) => t.name === name);
        expect(tool?.annotations?.readOnlyHint, `${name} should have readOnlyHint`).toBe(true);
      }
    });
  });

  describe("alwaysEnabled", () => {
    it("tabletop-state tools are alwaysEnabled", () => {
      const stateTools = registry.getToolsByCategory("tabletop-state");
      for (const tool of stateTools) {
        expect(tool.alwaysEnabled, `${tool.name} should be alwaysEnabled`).toBe(true);
      }
    });
  });

  describe("input schemas", () => {
    it("all tools have inputSchema defined", () => {
      for (const tool of tabletopSimTools) {
        expect(tool.inputSchema, `${tool.name} should have inputSchema`).toBeDefined();
      }
    });
  });

  describe("handler invocation", () => {
    it("tabletop_roll_dice returns valid result", async () => {
      const ctx = createMockContext();
      const result = await registry.call(
        "tabletop_roll_dice",
        { room_id: "ROOM01", player_id: "player1", dice_type: "d6", count: 2 },
        ctx,
      );
      expect(result.isError).toBeUndefined();
      const text = result.content[0];
      expect(text).toBeDefined();
      if (text && text.type === "text") {
        expect(text.text).toContain("Dice Roll");
        expect(text.text).toContain("player1");
      }
    });

    it("tabletop_move_piece clamps coordinates", async () => {
      const ctx = createMockContext();
      const result = await registry.call(
        "tabletop_move_piece",
        {
          room_id: "ROOM01",
          player_id: "player1",
          piece_id: "piece1",
          position: { x: 99, y: -5, z: 99 },
        },
        ctx,
      );
      expect(result.isError).toBeUndefined();
      const text = result.content[0];
      expect(text).toBeDefined();
      if (text && text.type === "text") {
        expect(text.text).toContain("x=10.00");
        expect(text.text).toContain("y=0.00");
        expect(text.text).toContain("z=10.00");
      }
    });

    it("tabletop_save_game and tabletop_load_game round-trip", async () => {
      const ctx = createMockContext();

      const saveResult = await registry.call(
        "tabletop_save_game",
        { room_id: "ROOM01", save_name: "Test Save" },
        ctx,
      );
      expect(saveResult.isError).toBeUndefined();

      const saveText = saveResult.content[0];
      expect(saveText).toBeDefined();
      if (saveText && saveText.type === "text") {
        const match = saveText.text.match(/\*\*Save ID:\*\* (save_\w+)/);
        expect(match).toBeTruthy();

        if (match?.[1]) {
          const loadResult = await registry.call("tabletop_load_game", { save_id: match[1] }, ctx);
          expect(loadResult.isError).toBeUndefined();
          const loadText = loadResult.content[0];
          if (loadText && loadText.type === "text") {
            expect(loadText.text).toContain("Game Loaded");
            expect(loadText.text).toContain("Test Save");
          }
        }
      }
    });

    it("tabletop_load_game returns error for unknown save", async () => {
      const ctx = createMockContext();
      const result = await registry.call("tabletop_load_game", { save_id: "nonexistent" }, ctx);
      expect(result.isError).toBeUndefined();
      const text = result.content[0];
      if (text && text.type === "text") {
        expect(text.text).toContain("Save Not Found");
      }
    });

    it("tabletop_draw_card returns success text", async () => {
      const ctx = createMockContext();
      const result = await registry.call(
        "tabletop_draw_card",
        { room_id: "ROOM01", player_id: "player1" },
        ctx,
      );
      expect(result.isError).toBeUndefined();
      const text = result.content[0];
      if (text && text.type === "text") {
        expect(text.text).toContain("Card Drawn");
      }
    });

    it("tabletop_send_chat returns message ID", async () => {
      const ctx = createMockContext();
      const result = await registry.call(
        "tabletop_send_chat",
        { room_id: "ROOM01", message: "Hello everyone!" },
        ctx,
      );
      expect(result.isError).toBeUndefined();
      const text = result.content[0];
      if (text && text.type === "text") {
        expect(text.text).toContain("Message Sent");
        expect(text.text).toContain("msg_");
      }
    });

    it("tabletop_add_asset stores asset with dimensions", async () => {
      const ctx = createMockContext();
      const result = await registry.call(
        "tabletop_add_asset",
        {
          room_id: "ROOM01",
          asset_type: "token",
          name: "Warrior Token",
          url: "https://example.com/warrior.png",
        },
        ctx,
      );
      expect(result.isError).toBeUndefined();
      const text = result.content[0];
      if (text && text.type === "text") {
        expect(text.text).toContain("Asset Added");
        expect(text.text).toContain("128px x 128px");
        expect(text.text).toContain("Warrior Token");
      }
    });
  });
});
