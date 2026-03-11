import { describe, expect, it, beforeEach } from "vitest";
import { DynamicToolRegistry } from "../../../../src/cli/spike-cli/core-logic/chat/tool-registry.js";
import type { NamespacedTool } from "../../../../src/cli/spike-cli/core-logic/multiplexer/server-manager.js";

function makeTool(name: string, server: string, desc?: string): NamespacedTool {
  return {
    namespacedName: `${server}__${name}`,
    originalName: name,
    serverName: server,
    description: desc ?? `Description for ${name}`,
    inputSchema: { type: "object", properties: { q: { type: "string" } } },
  };
}

const metaTool = (name: string): NamespacedTool => ({
  namespacedName: `spike__${name}`,
  originalName: name,
  serverName: "spike",
  description: `Meta tool: ${name}`,
  inputSchema: { type: "object" },
});

describe("DynamicToolRegistry", () => {
  let registry: DynamicToolRegistry;
  const tools: NamespacedTool[] = [
    makeTool("create_game", "chess", "Create a chess game"),
    makeTool("list_games", "chess", "List chess games"),
    makeTool("move", "chess", "Make a move"),
    makeTool("generate", "image", "Generate an image"),
    makeTool("enhance", "image", "Enhance an image"),
    metaTool("tool_search"),
    metaTool("list_toolsets"),
  ];

  beforeEach(() => {
    registry = new DynamicToolRegistry();
    registry.refresh(tools);
  });

  describe("refresh", () => {
    it("loads all tools", () => {
      expect(registry.totalTools).toBe(7);
    });

    it("auto-activates spike__ meta-tools", () => {
      expect(registry.isActive("spike__tool_search")).toBe(true);
      expect(registry.isActive("spike__list_toolsets")).toBe(true);
    });

    it("does not auto-activate regular tools", () => {
      expect(registry.isActive("chess__create_game")).toBe(false);
    });
  });

  describe("buildCatalog", () => {
    it("returns grouped tool listing", () => {
      const catalog = registry.buildCatalog();
      expect(catalog).toContain("[chess]");
      expect(catalog).toContain("[image]");
      expect(catalog).toContain("[spike]");
      expect(catalog).toContain("chess__create_game");
      expect(catalog).toContain("Create a chess game");
    });

    it("marks active tools", () => {
      registry.activate("chess__create_game");
      const catalog = registry.buildCatalog();
      expect(catalog).toContain("chess__create_game: Create a chess game [active]");
    });

    it("truncates long descriptions", () => {
      const longDesc = "A".repeat(100);
      const longTool = makeTool("long_desc", "test", longDesc);
      registry.refresh([...tools, longTool]);
      const catalog = registry.buildCatalog();
      expect(catalog).toContain("...");
    });
  });

  describe("search", () => {
    it("finds tools by name", () => {
      const result = registry.search("create_game");
      expect(result.tools.length).toBeGreaterThan(0);
      expect(result.tools[0]?.namespacedName).toBe("chess__create_game");
    });

    it("activates found tools", () => {
      expect(registry.isActive("chess__create_game")).toBe(false);
      registry.search("create_game");
      expect(registry.isActive("chess__create_game")).toBe(true);
    });

    it("limits results to maxResults", () => {
      const result = registry.search("chess", 2);
      expect(result.tools.length).toBeLessThanOrEqual(2);
      expect(result.totalMatches).toBeGreaterThanOrEqual(result.tools.length);
    });

    it("returns empty for no matches", () => {
      const result = registry.search("zzzznonexistent");
      expect(result.tools).toHaveLength(0);
    });

    it("searches by description too", () => {
      const result = registry.search("Generate an image");
      expect(result.tools.length).toBeGreaterThan(0);
    });
  });

  describe("getActiveTools", () => {
    it("returns only active tools", () => {
      const active = registry.getActiveTools();
      // Only meta-tools should be active initially
      expect(active.every((t) => t.namespacedName.startsWith("spike__"))).toBe(true);
    });

    it("includes search-activated tools", () => {
      registry.search("create_game");
      const active = registry.getActiveTools();
      const names = active.map((t) => t.namespacedName);
      expect(names).toContain("chess__create_game");
    });
  });

  describe("activate / deactivate", () => {
    it("activates a known tool", () => {
      expect(registry.activate("chess__move")).toBe(true);
      expect(registry.isActive("chess__move")).toBe(true);
    });

    it("returns false for unknown tool", () => {
      expect(registry.activate("unknown__tool")).toBe(false);
    });

    it("deactivates a tool", () => {
      registry.activate("chess__move");
      expect(registry.deactivate("chess__move")).toBe(true);
      expect(registry.isActive("chess__move")).toBe(false);
    });

    it("cannot deactivate always-on tools", () => {
      expect(registry.deactivate("spike__tool_search")).toBe(false);
      expect(registry.isActive("spike__tool_search")).toBe(true);
    });
  });

  describe("resetToAlwaysOn", () => {
    it("removes non-always-on tools", () => {
      registry.activate("chess__create_game");
      registry.activate("image__generate");
      expect(registry.activeCount).toBeGreaterThan(2);

      registry.resetToAlwaysOn();
      expect(registry.isActive("chess__create_game")).toBe(false);
      expect(registry.isActive("image__generate")).toBe(false);
      expect(registry.isActive("spike__tool_search")).toBe(true);
    });
  });

  describe("isKnown", () => {
    it("returns true for registered tools", () => {
      expect(registry.isKnown("chess__create_game")).toBe(true);
    });

    it("returns false for unknown tools", () => {
      expect(registry.isKnown("unknown__tool")).toBe(false);
    });
  });

  describe("alwaysOnPatterns", () => {
    it("supports glob patterns", () => {
      const reg = new DynamicToolRegistry({
        alwaysOnPatterns: ["chess__*"],
      });
      reg.refresh(tools);
      expect(reg.isActive("chess__create_game")).toBe(true);
      expect(reg.isActive("chess__list_games")).toBe(true);
      expect(reg.isActive("image__generate")).toBe(false);
    });

    it("supports exact match patterns", () => {
      const reg = new DynamicToolRegistry({
        alwaysOnPatterns: ["image__generate"],
      });
      reg.refresh(tools);
      expect(reg.isActive("image__generate")).toBe(true);
      expect(reg.isActive("image__enhance")).toBe(false);
    });
  });

  describe("activeCount / totalTools", () => {
    it("tracks counts correctly", () => {
      expect(registry.totalTools).toBe(7);
      // 2 meta-tools always active
      expect(registry.activeCount).toBe(2);

      registry.activate("chess__move");
      expect(registry.activeCount).toBe(3);
    });
  });
});
