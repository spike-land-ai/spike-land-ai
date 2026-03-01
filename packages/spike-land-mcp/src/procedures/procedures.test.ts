/**
 * Tests for procedures/index.ts
 *
 * Covers: freeTool, workspaceTool, withUserId, withDrizzle, and the re-exports
 * textResult / jsonResult.
 */

import { describe, it, expect, vi } from "vitest";
import { freeTool, workspaceTool, textResult, jsonResult } from "./index";
import { createMockD1, createMockKV } from "../__test-utils__/mock-env";
import { createDb } from "../db/index";
import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolRegistry } from "../mcp/registry";
import { z } from "zod";

// ─── Mock MCP server ──────────────────────────────────────────────────────────

function createMockMcpServer(): McpServer {
  return {
    registerTool: vi.fn((_name: string, _config: unknown, handler: unknown): RegisteredTool => {
      let isEnabled = true;
      return {
        enable: () => { isEnabled = true; },
        disable: () => { isEnabled = false; },
        get enabled() { return isEnabled; },
        update: vi.fn(),
        remove: vi.fn(),
        handler: handler as RegisteredTool["handler"],
      };
    }),
  } as unknown as McpServer;
}

// ─── textResult / jsonResult re-exports ──────────────────────────────────────

describe("re-exported textResult", () => {
  it("returns a text content result", () => {
    const result = textResult("hello from procedures");
    expect(result.content[0]).toEqual({ type: "text", text: "hello from procedures" });
  });
});

describe("re-exported jsonResult", () => {
  it("returns text + JSON content", () => {
    const result = jsonResult("Summary", { count: 5 });
    expect(result.content).toHaveLength(2);
    expect((result.content[0] as { type: string; text: string }).text).toBe("Summary");
    const parsed = JSON.parse((result.content[1] as { type: string; text: string }).text);
    expect(parsed.count).toBe(5);
  });
});

// ─── freeTool ─────────────────────────────────────────────────────────────────

describe("freeTool", () => {
  it("creates a procedure builder without throwing", () => {
    const db = createDb(createMockD1());
    expect(() => freeTool("user-1", db)).not.toThrow();
  });

  it("returned procedure has .tool() and .use() methods", () => {
    const db = createDb(createMockD1());
    const t = freeTool("user-1", db);
    expect(typeof t.tool).toBe("function");
    expect(typeof t.use).toBe("function");
  });

  it("built tool receives userId and db in context", async () => {
    const db = createDb(createMockD1());
    const t = freeTool("user-xyz", db);

    const capturedCtx: Record<string, unknown>[] = [];

    const builtTool = t
      .tool("test_tool", "A test", {
        message: z.string().describe("A message"),
      })
      .meta({ category: "test", tier: "free" })
      .handler(async ({ input, ctx }) => {
        capturedCtx.push({ ...ctx, inputMessage: input.message });
        return { content: [{ type: "text" as const, text: "done" }] };
      });

    // Register the built tool in a registry and call it directly
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-xyz");
    registry.registerBuilt(builtTool);
    registry.enableAll();

    await registry.callToolDirect("test_tool", { message: "hello" });

    expect(capturedCtx).toHaveLength(1);
    expect(capturedCtx[0]!.userId).toBe("user-xyz");
    expect(capturedCtx[0]!.db).toBeDefined();
    expect(capturedCtx[0]!.inputMessage).toBe("hello");
  });
});

// ─── workspaceTool ────────────────────────────────────────────────────────────

describe("workspaceTool", () => {
  it("is functionally identical to freeTool (same middleware chain)", () => {
    const db = createDb(createMockD1());
    const freeProc = freeTool("user-1", db);
    const workspaceProc = workspaceTool("user-1", db);

    // Both should have the same shape
    expect(typeof freeProc.tool).toBe("function");
    expect(typeof workspaceProc.tool).toBe("function");
  });

  it("built tool receives userId and db in context just like freeTool", async () => {
    const db = createDb(createMockD1());
    const t = workspaceTool("ws-user", db);

    const capturedCtx: Record<string, unknown>[] = [];

    const builtTool = t
      .tool("ws_test_tool", "Workspace test tool", {})
      .meta({ category: "workspace", tier: "workspace" })
      .handler(async ({ ctx }) => {
        capturedCtx.push({ ...ctx });
        return { content: [{ type: "text" as const, text: "ok" }] };
      });

    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "ws-user");
    registry.registerBuilt(builtTool);
    registry.enableAll();

    await registry.callToolDirect("ws_test_tool", {});

    expect(capturedCtx[0]!.userId).toBe("ws-user");
    expect(capturedCtx[0]!.db).toBeDefined();
  });
});

// ─── Multiple tools via freeTool ──────────────────────────────────────────────

describe("freeTool — multiple tools from same procedure", () => {
  it("can build multiple independent tools", async () => {
    const db = createDb(createMockD1());
    const t = freeTool("multi-user", db);

    const results: string[] = [];

    const toolA = t
      .tool("multi_a", "Tool A", {})
      .meta({ category: "test", tier: "free" })
      .handler(async () => {
        results.push("a");
        return { content: [{ type: "text" as const, text: "a" }] };
      });

    const toolB = t
      .tool("multi_b", "Tool B", {})
      .meta({ category: "test", tier: "free" })
      .handler(async () => {
        results.push("b");
        return { content: [{ type: "text" as const, text: "b" }] };
      });

    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "multi-user");
    registry.registerBuilt(toolA);
    registry.registerBuilt(toolB);
    registry.enableAll();

    await registry.callToolDirect("multi_a", {});
    await registry.callToolDirect("multi_b", {});

    expect(results).toEqual(["a", "b"]);
  });
});
