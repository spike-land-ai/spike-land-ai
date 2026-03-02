/**
 * Tests for shared store-apps infrastructure.
 */

import { describe, expect, it } from "vitest";
import {
  checkDependsOn,
  checkRequires,
  createMockContext,
  createMockRegistry,
  detectCycles,
  errorResult,
  getEnables,
  jsonResult,
  safeToolCall,
  textResult,
} from "./index";
import type { StandaloneToolDefinition } from "./types";

/* ── Tool Helpers ────────────────────────────────────────────────── */

describe("textResult", () => {
  it("returns text content", () => {
    const result = textResult("hello");
    expect(result.content).toEqual([{ type: "text", text: "hello" }]);
    expect(result.isError).toBeUndefined();
  });

  it("truncates long text", () => {
    const longText = "x".repeat(9000);
    const result = textResult(longText);
    const text = (result.content[0] as { text: string }).text;
    expect(text.length).toBeLessThan(9000);
    expect(text).toContain("truncated");
  });
});

describe("jsonResult", () => {
  it("returns text and JSON content", () => {
    const result = jsonResult("summary", { count: 42 });
    expect(result.content).toHaveLength(2);
    expect((result.content[0] as { text: string }).text).toBe("summary");
    expect((result.content[1] as { text: string }).text).toContain("42");
  });
});

describe("errorResult", () => {
  it("returns error content", () => {
    const result = errorResult("something failed");
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toBe("something failed");
  });
});

describe("safeToolCall", () => {
  it("returns handler result on success", async () => {
    const result = await safeToolCall("test_tool", async () => textResult("ok"));
    expect(result.isError).toBeUndefined();
    expect((result.content[0] as { text: string }).text).toBe("ok");
  });

  it("catches errors and returns error result", async () => {
    const result = await safeToolCall("test_tool", async () => {
      throw new Error("boom");
    });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("boom");
    expect((result.content[0] as { text: string }).text).toContain("test_tool");
  });

  it("handles timeout", async () => {
    const result = await safeToolCall(
      "slow_tool",
      () => new Promise((resolve) => setTimeout(() => resolve(textResult("late")), 500)),
      { timeoutMs: 50 },
    );
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("timed out");
  });
});

/* ── Dependency Graph ────────────────────────────────────────────── */

const makeTool = (
  name: string,
  deps?: StandaloneToolDefinition["dependencies"],
): StandaloneToolDefinition => ({
  name,
  description: `Test tool ${name}`,
  category: "test",
  tier: "free",
  dependencies: deps,
  handler: async () => textResult("ok"),
});

describe("checkDependsOn", () => {
  it("passes when all deps are registered", () => {
    const tool = makeTool("b", { dependsOn: ["a"] });
    const registered = new Set(["a", "b"]);
    expect(checkDependsOn(tool, registered)).toEqual({ ok: true, missing: [] });
  });

  it("fails when deps are missing", () => {
    const tool = makeTool("b", { dependsOn: ["a", "c"] });
    const registered = new Set(["b"]);
    const result = checkDependsOn(tool, registered);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["a", "c"]);
  });

  it("passes when no deps declared", () => {
    const tool = makeTool("a");
    expect(checkDependsOn(tool, new Set())).toEqual({ ok: true, missing: [] });
  });
});

describe("checkRequires", () => {
  it("passes when all required tools were called", () => {
    const tool = makeTool("b", { requires: ["a"] });
    const called = new Set(["a"]);
    expect(checkRequires(tool, called)).toEqual({ ok: true, missing: [] });
  });

  it("fails when required tools were not called", () => {
    const tool = makeTool("b", { requires: ["a"] });
    expect(checkRequires(tool, new Set())).toEqual({ ok: false, missing: ["a"] });
  });
});

describe("getEnables", () => {
  it("returns enables list", () => {
    expect(getEnables({ enables: ["x", "y"] })).toEqual(["x", "y"]);
  });

  it("returns empty array for undefined", () => {
    expect(getEnables(undefined)).toEqual([]);
  });
});

describe("detectCycles", () => {
  it("finds no cycles in acyclic graph", () => {
    const tools = [
      makeTool("a"),
      makeTool("b", { dependsOn: ["a"] }),
      makeTool("c", { dependsOn: ["b"] }),
    ];
    expect(detectCycles(tools)).toEqual([]);
  });

  it("detects a simple cycle", () => {
    const tools = [makeTool("a", { dependsOn: ["b"] }), makeTool("b", { dependsOn: ["a"] })];
    const cycles = detectCycles(tools);
    expect(cycles.length).toBeGreaterThan(0);
  });
});

/* ── Test Utils ──────────────────────────────────────────────────── */

describe("createMockContext", () => {
  it("creates context with defaults", () => {
    const ctx = createMockContext();
    expect(ctx.userId).toBe("test-user-id");
    expect(ctx.calledTools.size).toBe(0);
  });

  it("accepts overrides", () => {
    const ctx = createMockContext({ userId: "custom-id" });
    expect(ctx.userId).toBe("custom-id");
  });
});

describe("createMockRegistry", () => {
  const tools = [makeTool("tool_a"), makeTool("tool_b")];

  it("lists tool names", () => {
    const reg = createMockRegistry(tools);
    expect(reg.getToolNames()).toEqual(["tool_a", "tool_b"]);
  });

  it("calls tools by name", async () => {
    const reg = createMockRegistry(tools);
    const result = await reg.call("tool_a", {});
    expect((result.content[0] as { text: string }).text).toBe("ok");
  });

  it("returns error for unknown tool", async () => {
    const reg = createMockRegistry(tools);
    const result = await reg.call("unknown", {});
    expect(result.isError).toBe(true);
  });

  it("filters by category", () => {
    const reg = createMockRegistry(tools);
    expect(reg.getToolsByCategory("test")).toHaveLength(2);
    expect(reg.getToolsByCategory("other")).toHaveLength(0);
  });
});
