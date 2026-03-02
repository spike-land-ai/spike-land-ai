import { describe, expect, it } from "vitest";
import type { ToolLike } from "./types.js";
import { convertToolToMcp } from "./tool-adapter.js";

describe("convertToolToMcp", () => {
  it("converts tool with properties and required fields", () => {
    const tool: ToolLike = {
      name: "search",
      description: "Search the web",
      parameters: {
        properties: {
          query: { type: "string", description: "Search query" },
          limit: { type: "number", description: "Max results" },
        },
        required: ["query"],
      },
      execute: async () => ({ content: [] }),
    };

    const result = convertToolToMcp(tool);

    expect(result).toEqual({
      name: "search",
      description: "Search the web",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          limit: { type: "number", description: "Max results" },
        },
        required: ["query"],
      },
    });
  });

  it("converts tool with no parameters to empty schema", () => {
    const tool: ToolLike = {
      name: "ping",
      description: "Ping the server",
      execute: async () => ({ content: [] }),
    };

    const result = convertToolToMcp(tool);

    expect(result).toEqual({
      name: "ping",
      description: "Ping the server",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    });
  });

  it("strips TypeBox symbols (only string keys survive Object.entries)", () => {
    const sym = Symbol("typebox-internal");
    const prop = { type: "string", description: "A field" } as Record<string | symbol, unknown>;
    prop[sym] = "should-be-stripped";

    const tool: ToolLike = {
      name: "test",
      description: "Test tool",
      parameters: {
        properties: { field: prop as Record<string, unknown> },
      },
      execute: async () => ({ content: [] }),
    };

    const result = convertToolToMcp(tool);
    const fieldSchema = result.inputSchema as {
      properties: Record<string, Record<string, unknown>>;
    };

    expect(fieldSchema.properties.field).toEqual({
      type: "string",
      description: "A field",
    });
    // Symbol key should not appear
    expect(Object.getOwnPropertySymbols(fieldSchema.properties.field)).toHaveLength(0);
  });

  it("uses empty string for missing description", () => {
    const tool: ToolLike = {
      name: "nodesc",
      execute: async () => ({ content: [] }),
    };

    const result = convertToolToMcp(tool);

    expect(result.description).toBe("");
  });
});
