import { describe, expect, it } from "vitest";
import { ProxyToolRegistry } from "./proxy-tool-registry";
import type { ToolDefinition } from "./tool-registry";

function makeDef(
  overrides: Partial<ToolDefinition> & { name: string; },
): ToolDefinition {
  return {
    name: overrides.name,
    description: overrides.description ?? `${overrides.name} description`,
    category: overrides.category ?? "test-category",
    tier: overrides.tier ?? "free",
    handler: overrides.handler
      ?? (async () => ({ content: [{ type: "text", text: "ok" }] })),
    inputSchema: overrides.inputSchema,
  };
}

describe("ProxyToolRegistry", () => {
  describe("register / hasTool / callTool", () => {
    it("registers a tool and finds it by name", () => {
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({ name: "my_tool" }));
      expect(reg.hasTool("my_tool")).toBe(true);
      expect(reg.hasTool("other_tool")).toBe(false);
    });

    it("returns error result for unknown tool", async () => {
      const reg = new ProxyToolRegistry();
      const result = await reg.callTool("unknown_tool", {});
      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({ type: "text" });
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("Unknown tool");
      expect(text).toContain("unknown_tool");
    });

    it("validates required params via Zod schema", async () => {
      const { z } = await import("zod");
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({
        name: "validated_tool",
        inputSchema: { name: z.string().min(1) },
      }));
      const result = await reg.callTool("validated_tool", {});
      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("name");
    });

    it("validation error hint references search_tools not help", async () => {
      const { z } = await import("zod");
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({
        name: "my_tool",
        inputSchema: { query: z.string() },
      }));
      const result = await reg.callTool("my_tool", {});
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("search_tools");
      expect(text).not.toContain("`help ");
    });

    it("invokes handler directly when no inputSchema is defined (zero-arg tools)", async () => {
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({
        name: "no_schema_tool",
        handler: async () => ({
          content: [{ type: "text", text: "no schema ok" }],
        }),
        // No inputSchema
      }));
      const result = await reg.callTool("no_schema_tool", {});
      expect(result.isError).toBeUndefined();
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toBe("no schema ok");
    });

    it("invokes handler with validated params", async () => {
      const { z } = await import("zod");
      let received: unknown;
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({
        name: "echo_tool",
        inputSchema: { msg: z.string() },
        handler: async (input: unknown) => {
          received = input;
          return { content: [{ type: "text", text: "ok" }] };
        },
      }));
      await reg.callTool("echo_tool", { msg: "hello" });
      expect(received).toEqual({ msg: "hello" });
    });
  });

  describe("getToolCount / getEnabledCount", () => {
    it("returns 0 for empty registry", () => {
      const reg = new ProxyToolRegistry();
      expect(reg.getToolCount()).toBe(0);
      expect(reg.getEnabledCount()).toBe(0);
    });

    it("counts registered tools", () => {
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({ name: "tool_a" }));
      reg.register(makeDef({ name: "tool_b" }));
      expect(reg.getToolCount()).toBe(2);
      expect(reg.getEnabledCount()).toBe(2); // all always enabled
    });
  });

  describe("searchTools", () => {
    it("returns empty array for empty query terms", () => {
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({ name: "chess_get_game", category: "chess-game" }));
      expect(reg.searchTools("")).toHaveLength(0);
    });

    it("returns empty array for whitespace query terms", () => {
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({ name: "chess_get_game", category: "chess-game" }));
      expect(reg.searchTools("   ")).toHaveLength(0);
    });

    it("finds tools by name match", () => {
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({ name: "chess_get_game", category: "chess-game" }));
      reg.register(makeDef({ name: "image_generate", category: "image" }));
      const results = reg.searchTools("chess");
      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe("chess_get_game");
    });

    it("returns correct tool names (not 'handler')", () => {
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({ name: "sm_create", category: "state-machine" }));
      reg.register(makeDef({ name: "sm_list", category: "state-machine" }));
      const results = reg.searchTools("sm");
      expect(results.map(r => r.name)).not.toContain("handler");
      expect(results.every(r => r.name !== "handler")).toBe(true);
    });

    it("skips gateway-meta tools in search", () => {
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({ name: "get_status", category: "gateway-meta" }));
      reg.register(makeDef({ name: "chess_status", category: "chess-game" }));
      const results = reg.searchTools("status");
      expect(results.map(r => r.name)).not.toContain("get_status");
    });

    it("respects limit param", () => {
      const reg = new ProxyToolRegistry();
      for (let i = 0; i < 20; i++) {
        reg.register(
          makeDef({ name: `chess_tool_${i}`, category: "chess-game" }),
        );
      }
      expect(reg.searchTools("chess", 5)).toHaveLength(5);
    });

    it("marks all results as enabled", () => {
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({ name: "chess_get_game", category: "chess-game" }));
      const [result] = reg.searchTools("chess");
      expect(result?.enabled).toBe(true);
    });
  });

  describe("listCategories", () => {
    it("returns empty array for empty registry", () => {
      const reg = new ProxyToolRegistry();
      expect(reg.listCategories()).toHaveLength(0);
    });

    it("groups tools by category", () => {
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({ name: "chess_a", category: "chess-game" }));
      reg.register(makeDef({ name: "chess_b", category: "chess-game" }));
      reg.register(makeDef({ name: "image_gen", category: "image" }));
      const cats = reg.listCategories();
      expect(cats).toHaveLength(2);
      const chess = cats.find(c => c.name === "chess-game")!;
      expect(chess.toolCount).toBe(2);
      expect(chess.enabledCount).toBe(2); // all enabled
    });

    it("uses CATEGORY_DESCRIPTIONS for known categories", () => {
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({ name: "chess_a", category: "chess-game" }));
      const cats = reg.listCategories();
      const chess = cats.find(c => c.name === "chess-game")!;
      expect(chess.description).toBe(
        "Chess Arena game lifecycle: create, join, move, resign, draw, and manage chess games",
      );
    });

    it("falls back to '<name> tools' for unknown categories", () => {
      const reg = new ProxyToolRegistry();
      reg.register(
        makeDef({ name: "my_tool", category: "unknown-category-xyz" }),
      );
      const cats = reg.listCategories();
      expect(cats[0]!.description).toBe("unknown-category-xyz tools");
    });
  });

  describe("hasCategory", () => {
    it("returns false for empty registry", () => {
      expect(new ProxyToolRegistry().hasCategory("chess-game")).toBe(false);
    });

    it("returns true when category exists", () => {
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({ name: "chess_a", category: "chess-game" }));
      expect(reg.hasCategory("chess-game")).toBe(true);
      expect(reg.hasCategory("image")).toBe(false);
    });
  });

  describe("enableCategory / enableTools (no-ops in proxy registry)", () => {
    it("enableCategory returns empty array (all already active)", () => {
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({ name: "chess_a", category: "chess-game" }));
      expect(reg.enableCategory("chess-game")).toEqual([]);
    });

    it("enableTools returns empty array (all always active)", () => {
      const reg = new ProxyToolRegistry();
      reg.register(makeDef({ name: "chess_a", category: "chess-game" }));
      expect(reg.enableTools(["chess_a"])).toEqual([]);
    });
  });
});
