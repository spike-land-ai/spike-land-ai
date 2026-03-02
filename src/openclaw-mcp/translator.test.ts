import { describe, expect, it, vi } from "vitest";
import type { ToolLike } from "./types.js";
import { createToolExecutor } from "./translator.js";

describe("createToolExecutor", () => {
  function makeTool(name: string, result?: { content: Array<{ type: string; text?: string }> }) {
    const executeFn = vi
      .fn()
      .mockResolvedValue(result ?? { content: [{ type: "text", text: `${name} result` }] });
    const tool: ToolLike = {
      name,
      description: `${name} tool`,
      parameters: { properties: { input: { type: "string" } } },
      execute: executeFn,
    };
    return { tool, executeFn };
  }

  it("listTools() returns all tools", () => {
    const tools = [makeTool("a").tool, makeTool("b").tool, makeTool("c").tool];
    const executor = createToolExecutor(tools);

    expect(executor.listTools()).toEqual(tools);
  });

  it("executeTool() calls matching tool and maps text content", async () => {
    const { tool, executeFn } = makeTool("greet", {
      content: [{ type: "text", text: "hello" }],
    });
    const executor = createToolExecutor([tool]);

    const result = await executor.executeTool("greet", { input: "world" });

    expect(result).toEqual({
      content: [{ type: "text", text: "hello" }],
    });
    expect(executeFn).toHaveBeenCalledWith(expect.stringMatching(/^mcp-\d+$/), {
      input: "world",
    });
  });

  it("returns error result for unknown tool", async () => {
    const executor = createToolExecutor([makeTool("known").tool]);

    const result = await executor.executeTool("unknown", {});

    expect(result).toEqual({
      content: [{ type: "text", text: "Unknown tool: unknown" }],
      isError: true,
    });
  });

  it("toolCallId matches mcp-<timestamp> pattern", async () => {
    const { tool, executeFn } = makeTool("test");
    const executor = createToolExecutor([tool]);

    await executor.executeTool("test", {});

    const callId = executeFn.mock.calls[0][0] as string;
    expect(callId).toMatch(/^mcp-\d+$/);
  });

  it("handles missing text in tool result", async () => {
    const { tool } = makeTool("test", { content: [{ type: "text" }] }); // missing text
    const executor = createToolExecutor([tool]);
    const result = await executor.executeTool("test", {});
    expect(result.content[0].text).toBe("");
  });
});
