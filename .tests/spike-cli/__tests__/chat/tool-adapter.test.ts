import { describe, expect, it, vi } from "vitest";
import { ASSERTION_METADATA_FIELD } from "../../../../src/cli/spike-cli/core-logic/chat/assertion-runtime.js";
import {
  executeToolCall,
  extractDefaults,
  getRequiredParams,
  mcpToolsToClaude,
} from "../../../../src/cli/spike-cli/core-logic/chat/tool-adapter.js";
import type {
  NamespacedTool,
  ServerManager,
} from "../../../../src/cli/spike-cli/core-logic/multiplexer/server-manager.js";

describe("mcpToolsToClaude", () => {
  it("converts MCP tools to Claude format", () => {
    const mcpTools: NamespacedTool[] = [
      {
        namespacedName: "vitest__run_tests",
        originalName: "run_tests",
        serverName: "vitest",
        description: "Run vitest tests",
        inputSchema: {
          type: "object",
          properties: { filter: { type: "string" } },
        },
      },
    ];

    const result = mcpToolsToClaude(mcpTools);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: "vitest__run_tests",
      description: "Run vitest tests",
      input_schema: {
        type: "object",
        properties: {
          filter: { type: "string" },
        },
      },
    });
  });

  it("adds assertion metadata when assertion runtime is active", () => {
    const mcpTools: NamespacedTool[] = [
      {
        namespacedName: "vitest__run_tests",
        originalName: "run_tests",
        serverName: "vitest",
        description: "Run vitest tests",
        inputSchema: {
          type: "object",
          properties: { filter: { type: "string" } },
        },
      },
    ];

    const result = mcpToolsToClaude(mcpTools, true);

    expect(result[0]).toEqual({
      name: "vitest__run_tests",
      description: "Run vitest tests",
      input_schema: {
        type: "object",
        properties: {
          filter: { type: "string" },
          [ASSERTION_METADATA_FIELD]: {
            type: "array",
            items: { type: "string" },
            description:
              "Optional runtime metadata. Assertion IDs that this tool call is gathering evidence for. The runtime strips this field before execution.",
          },
        },
      },
    });
  });

  it("adds type: object when missing from schema", () => {
    const mcpTools: NamespacedTool[] = [
      {
        namespacedName: "tool",
        originalName: "tool",
        serverName: "s",
        description: "desc",
        inputSchema: { properties: { x: { type: "number" } } },
      },
    ];

    const result = mcpToolsToClaude(mcpTools);
    expect(result[0].input_schema.type).toBe("object");
  });

  it("uses empty string for missing description", () => {
    const mcpTools: NamespacedTool[] = [
      {
        namespacedName: "tool",
        originalName: "tool",
        serverName: "s",
        inputSchema: { type: "object" },
      },
    ];

    const result = mcpToolsToClaude(mcpTools);
    expect(result[0].description).toBe("");
  });
});

describe("executeToolCall", () => {
  it("executes tool and returns text result", async () => {
    const manager = {
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "test passed" }],
        isError: false,
      }),
    } as unknown as ServerManager;

    const result = await executeToolCall(manager, "vitest__run_tests", {
      filter: "*.test.ts",
    });

    expect(manager.callTool).toHaveBeenCalledWith("vitest__run_tests", {
      filter: "*.test.ts",
    });
    expect(result).toEqual({ result: "test passed", isError: false });
  });

  it("joins multiple content blocks", async () => {
    const manager = {
      callTool: vi.fn().mockResolvedValue({
        content: [
          { type: "text", text: "line 1" },
          { type: "text", text: "line 2" },
        ],
      }),
    } as unknown as ServerManager;

    const result = await executeToolCall(manager, "tool", {});
    expect(result.result).toBe("line 1\nline 2");
  });

  it("returns error on tool failure", async () => {
    const manager = {
      callTool: vi.fn().mockRejectedValue(new Error("Tool not found: bad_tool")),
    } as unknown as ServerManager;

    const result = await executeToolCall(manager, "bad_tool", {});
    expect(result.isError).toBe(true);
    expect(result.result).toContain("Tool not found: bad_tool");
  });

  it("handles isError from callTool result", async () => {
    const manager = {
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "validation failed" }],
        isError: true,
      }),
    } as unknown as ServerManager;

    const result = await executeToolCall(manager, "tool", {});
    expect(result.isError).toBe(true);
    expect(result.result).toBe("validation failed");
  });

  it("uses JSON.stringify for non-text content block (line 92 ?? branch)", async () => {
    const manager = {
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "image", data: "base64data" }], // no .text field
        isError: false,
      }),
    } as unknown as ServerManager;

    const result = await executeToolCall(manager, "tool", {});
    expect(result.result).toContain("base64data");
    expect(result.isError).toBe(false);
  });

  it("handles non-Error thrown in catch (line 95 String branch)", async () => {
    const manager = {
      callTool: vi.fn().mockRejectedValue("plain string error"),
    } as unknown as ServerManager;

    const result = await executeToolCall(manager, "tool", {});
    expect(result.isError).toBe(true);
    expect(result.result).toContain("plain string error");
  });
});

describe("extractDefaults", () => {
  it("extracts defaults from properties", () => {
    const schema = {
      type: "object",
      properties: {
        time_control: { type: "string", default: "BLITZ_5" },
        rated: { type: "boolean", default: true },
        opponent: { type: "string" },
      },
    };

    const defaults = extractDefaults(schema);
    expect(defaults).toEqual({
      time_control: "BLITZ_5",
      rated: true,
    });
  });

  it("returns empty object when no properties", () => {
    expect(extractDefaults({ type: "object" })).toEqual({});
  });

  it("returns empty object when no defaults exist", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
    };
    expect(extractDefaults(schema)).toEqual({});
  });

  it("handles default value of null", () => {
    const schema = {
      type: "object",
      properties: {
        optional: { type: "string", default: null },
      },
    };
    expect(extractDefaults(schema)).toEqual({ optional: null });
  });

  it("handles default value of 0 and empty string", () => {
    const schema = {
      type: "object",
      properties: {
        count: { type: "number", default: 0 },
        label: { type: "string", default: "" },
      },
    };
    expect(extractDefaults(schema)).toEqual({ count: 0, label: "" });
  });
});

describe("getRequiredParams", () => {
  it("returns required params without defaults", () => {
    const schema = {
      type: "object",
      properties: {
        game_id: { type: "string", description: "The game ID" },
        time_control: { type: "string", default: "BLITZ_5" },
        from: { type: "string", description: "Source square" },
      },
      required: ["game_id", "time_control", "from"],
    };

    const params = getRequiredParams(schema);
    expect(params).toEqual([
      { name: "game_id", description: "The game ID", type: "string" },
      { name: "from", description: "Source square", type: "string" },
    ]);
  });

  it("returns empty array when no required params", () => {
    const schema = {
      type: "object",
      properties: {
        optional: { type: "string", default: "value" },
      },
    };
    expect(getRequiredParams(schema)).toEqual([]);
  });

  it("returns empty array when no properties", () => {
    expect(getRequiredParams({ type: "object" })).toEqual([]);
  });

  it("handles missing description and type", () => {
    const schema = {
      type: "object",
      properties: {
        x: {},
      },
      required: ["x"],
    };

    const params = getRequiredParams(schema);
    expect(params).toEqual([{ name: "x", description: "", type: "string" }]);
  });

  it("uses empty object when required param is not in properties (line 71 ?? branch)", () => {
    const schema = {
      type: "object",
      properties: {
        y: { type: "string" },
      },
      required: ["x"], // "x" is required but not in properties
    };

    const params = getRequiredParams(schema);
    // props["x"] is undefined → ?? {} → description: "" and type: "string"
    expect(params).toEqual([{ name: "x", description: "", type: "string" }]);
  });

  it("excludes required params that have defaults", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        color: { type: "string", default: "blue" },
      },
      required: ["name", "color"],
    };

    const params = getRequiredParams(schema);
    expect(params).toHaveLength(1);
    expect(params[0].name).toBe("name");
  });
});
