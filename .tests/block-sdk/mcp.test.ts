import { describe, expect, it, _vi } from "vitest";
import { createMemoryAdapter, defineBlock, defineTable, t } from "@spike-land-ai/block-sdk";
import { blockToTools, registerBlockTools } from "@spike-land-ai/block-sdk/mcp";
import type { McpToolRegistry } from "@spike-land-ai/block-sdk/mcp";
import { z } from "zod";

const testBlock = defineBlock({
  name: "mcp-test",
  version: "1.0.0",
  storage: {
    notes: defineTable("notes", {
      id: t.string().primaryKey(),
      text: t.string(),
    }),
  },
  procedures: (ctx) => ({
    addNote: ctx.procedure
      .tool("add_note", "Add a note", { text: z.string() })
      .handler(async ({ input, ctx: blockCtx }) => {
        const id = blockCtx.nanoid(8);
        await blockCtx.storage.sql.execute("INSERT INTO notes (id, text) VALUES (?, ?)", [
          id,
          input.text,
        ]);
        return { content: [{ type: "text", text: JSON.stringify({ id }) }] };
      }),
    listNotes: ctx.procedure
      .tool("list_notes", "List all notes", {})
      .handler(async ({ ctx: blockCtx }) => {
        const result = await blockCtx.storage.sql.execute("SELECT * FROM notes");
        return { content: [{ type: "text", text: JSON.stringify(result.rows) }] };
      }),
  }),
  tools: "auto",
});

describe("blockToTools", () => {
  it("returns tools with correct names", async () => {
    const storage = createMemoryAdapter();
    await testBlock.initialize(storage);
    const tools = blockToTools(testBlock, storage, "user-1");
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name).sort()).toEqual(["add_note", "list_notes"]);
  });

  it("applies prefix to tool names", async () => {
    const storage = createMemoryAdapter();
    await testBlock.initialize(storage);
    const tools = blockToTools(testBlock, storage, "user-1", { prefix: "notes_" });
    expect(tools.map((t) => t.name).sort()).toEqual(["notes_add_note", "notes_list_notes"]);
  });

  it("tools are functional", async () => {
    const storage = createMemoryAdapter();
    await testBlock.initialize(storage);
    const tools = blockToTools(testBlock, storage, "user-1");
    const addTool = tools.find((t) => t.name === "add_note")!;
    const result = await addTool.handler({ text: "hello" });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0]!.text!);
    expect(data.id).toBeTruthy();
  });
});

describe("registerBlockTools", () => {
  it("registers all tools with the registry", async () => {
    const storage = createMemoryAdapter();
    await testBlock.initialize(storage);

    const registered: Array<{ name: string; description: string }> = [];
    const mockRegistry: McpToolRegistry = {
      register(tool) {
        registered.push({ name: tool.name, description: tool.description });
      },
    };

    registerBlockTools(testBlock, mockRegistry, storage, "user-1");
    expect(registered).toHaveLength(2);
    expect(registered.map((r) => r.name).sort()).toEqual(["add_note", "list_notes"]);
  });

  it("applies prefix during registration", async () => {
    const storage = createMemoryAdapter();
    await testBlock.initialize(storage);

    const registered: string[] = [];
    const mockRegistry: McpToolRegistry = {
      register(tool) {
        registered.push(tool.name);
      },
    };

    registerBlockTools(testBlock, mockRegistry, storage, "user-1", { prefix: "x_" });
    expect(registered.sort()).toEqual(["x_add_note", "x_list_notes"]);
  });

  it("registered handlers are callable", async () => {
    const storage = createMemoryAdapter();
    await testBlock.initialize(storage);

    const handlers = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();
    const mockRegistry: McpToolRegistry = {
      register(tool) {
        handlers.set(tool.name, tool.handler);
      },
    };

    registerBlockTools(testBlock, mockRegistry, storage, "user-1");

    const addHandler = handlers.get("add_note")!;
    const result = await addHandler({ text: "test note" });
    expect(result).toBeDefined();
  });
});
