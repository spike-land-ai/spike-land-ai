/**
 * Tests for @spike-land-ai/mcp-server-base
 */

import { describe, expect, it, vi } from "vitest";
import {
  type CallToolResult,
  McpError,
  createMockRegistry,
  createMockServer,
  createMcpServer,
  createZodTool,
  errorResult,
  formatError,
  getText,
  isErrorResult,
  jsonResult,
  startMcpServer,
  textResult,
} from "./index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const mockTransportInstance = {};
vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn(function (this: unknown) {
    Object.assign(this as object, mockTransportInstance);
  }),
}));

// Alias to use McpServer type in casts without tsc complaining about unused imports
type McpServerType = McpServer;

// ─── textResult ───────────────────────────────────────────────────────────────

describe("textResult", () => {
  it("returns a content array with a single text item", () => {
    const result = textResult("hello");
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({ type: "text", text: "hello" });
    expect(result.isError).toBeUndefined();
  });

  it("truncates strings longer than 8192 chars", () => {
    const long = "x".repeat(9_000);
    const result = textResult(long);
    expect(result.content[0].text).toHaveLength(8_192 + "\n...(truncated)".length);
    expect(result.content[0].text.endsWith("...(truncated)")).toBe(true);
  });

  it("does not truncate strings of exactly 8192 chars", () => {
    const exact = "a".repeat(8_192);
    const result = textResult(exact);
    expect(result.content[0].text).toHaveLength(8_192);
  });
});

// ─── jsonResult ───────────────────────────────────────────────────────────────

describe("jsonResult", () => {
  it("serialises objects with 2-space indentation", () => {
    const result = jsonResult({ foo: 1 });
    expect(result.content[0].text).toBe(JSON.stringify({ foo: 1 }, null, 2));
  });

  it("handles arrays", () => {
    const result = jsonResult([1, 2, 3]);
    expect(JSON.parse(result.content[0].text)).toEqual([1, 2, 3]);
  });
});

// ─── errorResult ─────────────────────────────────────────────────────────────

describe("errorResult", () => {
  it("sets isError to true", () => {
    const result = errorResult("NOT_FOUND", "item missing");
    expect(result.isError).toBe(true);
  });

  it("includes code and message in the text", () => {
    const result = errorResult("AUTH_FAILED", "bad credentials", true);
    expect(result.content[0].text).toContain("AUTH_FAILED");
    expect(result.content[0].text).toContain("bad credentials");
    expect(result.content[0].text).toContain("true");
  });

  it("defaults retryable to false", () => {
    const result = errorResult("OOPS", "something broke");
    expect(result.content[0].text).toContain("false");
  });
});

// ─── McpError ─────────────────────────────────────────────────────────────────

describe("McpError", () => {
  it("stores code and retryable flag", () => {
    const err = new McpError("RATE_LIMITED", "slow down", true);
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.message).toBe("slow down");
    expect(err.retryable).toBe(true);
    expect(err.name).toBe("McpError");
  });

  it("defaults retryable to false", () => {
    const err = new McpError("INTERNAL_ERROR", "oops");
    expect(err.retryable).toBe(false);
  });

  it("is an instance of Error", () => {
    expect(new McpError("X", "y")).toBeInstanceOf(Error);
  });
});

// ─── formatError ─────────────────────────────────────────────────────────────

describe("formatError", () => {
  it("converts McpError to error result preserving code and retryable", () => {
    const err = new McpError("NOT_FOUND", "missing", true);
    const result = formatError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NOT_FOUND");
    expect(result.content[0].text).toContain("missing");
    expect(result.content[0].text).toContain("true");
  });

  it("converts generic Error to INTERNAL_ERROR", () => {
    const result = formatError(new Error("boom"));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("INTERNAL_ERROR");
    expect(result.content[0].text).toContain("boom");
  });

  it("converts non-Error value to INTERNAL_ERROR", () => {
    const result = formatError("string error");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("INTERNAL_ERROR");
    expect(result.content[0].text).toContain("string error");
  });
});

// ─── getText / isErrorResult ──────────────────────────────────────────────────

describe("getText", () => {
  it("returns the text of the first content item", () => {
    const result: CallToolResult = { content: [{ type: "text", text: "hello" }] };
    expect(getText(result)).toBe("hello");
  });

  it("returns empty string when content is empty", () => {
    const result: CallToolResult = { content: [] };
    expect(getText(result)).toBe("");
  });
});

describe("isErrorResult", () => {
  it("returns true when isError is true", () => {
    expect(isErrorResult({ content: [], isError: true })).toBe(true);
  });

  it("returns false when isError is absent", () => {
    expect(isErrorResult({ content: [] })).toBe(false);
  });

  it("returns false when isError is false", () => {
    expect(isErrorResult({ content: [], isError: false })).toBe(false);
  });
});

// ─── createMcpServer ─────────────────────────────────────────────────────────

describe("createMcpServer", () => {
  it("returns an McpServer instance", async () => {
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const server = createMcpServer({ name: "test-server", version: "1.2.3" });
    expect(server).toBeInstanceOf(McpServer);
  });
});

// ─── startMcpServer ──────────────────────────────────────────────────────────

describe("startMcpServer", () => {
  it("calls server.connect with a StdioServerTransport instance", async () => {
    const connectSpy = vi.fn().mockResolvedValue(undefined);
    const fakeServer = { connect: connectSpy } as unknown as McpServer;

    await startMcpServer(fakeServer);

    expect(connectSpy).toHaveBeenCalledOnce();
  });
});

// ─── createMockServer ─────────────────────────────────────────────────────────

describe("createMockServer", () => {
  it("captures tool handler and invokes it via call()", async () => {
    const server = createMockServer();

    server.tool("ping", "Says pong", {}, async () => textResult("pong"));

    const result = await server.call("ping");
    expect(getText(result)).toBe("pong");
  });

  it("throws when calling a tool that was never registered", async () => {
    const server = createMockServer();
    await expect(server.call("nonexistent")).rejects.toThrow('Tool "nonexistent" not registered');
  });

  it("passes arguments through to the handler", async () => {
    const server = createMockServer();

    server.tool("echo", "Echoes the input", {}, async (args) => textResult(String(args["msg"])));

    const result = await server.call("echo", { msg: "hello world" });
    expect(getText(result)).toBe("hello world");
  });
});

// ─── createMockRegistry ──────────────────────────────────────────────────────

describe("createMockRegistry", () => {
  it("registers and calls a tool handler", async () => {
    const registry = createMockRegistry();

    registry.register({
      name: "greet",
      description: "Greet",
      handler: async ({ name }: { name: string }) => textResult(`Hello, ${name}!`),
    });

    const result = await registry.call("greet", { name: "World" });
    expect(getText(result)).toBe("Hello, World!");
  });

  it("throws when calling an unregistered handler", async () => {
    const registry = createMockRegistry();
    await expect(registry.call("missing")).rejects.toThrow(
      'Mock tool handler not found for "missing"',
    );
  });

  it("exposes the handlers Map", () => {
    const registry = createMockRegistry();
    registry.register({ name: "t", description: "", handler: async () => textResult("ok") });
    expect(registry.handlers.has("t")).toBe(true);
  });
});

// ─── createZodTool ───────────────────────────────────────────────────────────

describe("createZodTool", () => {
  it("registers a tool and calls it with validated args", async () => {
    const server = createMockServer();

    createZodTool(server as unknown as McpServerType, {
      name: "add",
      description: "Add two numbers",
      schema: {
        a: z.number(),
        b: z.number(),
      },
      async handler({ a, b }) {
        return jsonResult({ sum: (a as number) + (b as number) });
      },
    });

    const result = await server.call("add", { a: 3, b: 4 });
    expect(isErrorResult(result)).toBe(false);
    const parsed = JSON.parse(getText(result)) as { sum: number };
    expect(parsed.sum).toBe(7);
  });

  it("catches handler errors and returns an error result", async () => {
    const server = createMockServer();

    createZodTool(server as unknown as McpServerType, {
      name: "boom",
      description: "Always fails",
      schema: {},
      async handler() {
        throw new McpError("EXPLODED", "on purpose", false);
      },
    });

    const result = await server.call("boom");
    expect(isErrorResult(result)).toBe(true);
    expect(getText(result)).toContain("EXPLODED");
  });

  it("catches generic errors from the handler", async () => {
    const server = createMockServer();

    createZodTool(server as unknown as McpServerType, {
      name: "crash",
      description: "Crashes",
      schema: {},
      async handler() {
        throw new Error("unexpected failure");
      },
    });

    const result = await server.call("crash");
    expect(isErrorResult(result)).toBe(true);
    expect(getText(result)).toContain("unexpected failure");
  });
});
