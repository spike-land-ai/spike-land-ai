import { describe, expect, it, vi } from "vitest";
import { registerFormatMessagesTool } from "./format-messages.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const mockEsbuild = vi.hoisted(() => ({
  formatMessages: vi.fn(),
}));

vi.mock("../wasm-api.js", () => ({
  getEsbuildWasm: vi.fn().mockResolvedValue(mockEsbuild),
}));

class MockMcpServer {
  tools = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();

  tool(
    name: string,
    _description: string,
    _schema: Record<string, unknown>,
    handler: (args: Record<string, unknown>) => Promise<unknown>,
  ) {
    this.tools.set(name, handler);
  }
}

function makeServer() {
  const server = new MockMcpServer();
  registerFormatMessagesTool(server as unknown as McpServer);
  const handler = server.tools.get("esbuild_wasm_format_messages")!;
  return { server, handler };
}

const sampleMessages = [
  {
    id: "err001",
    text: "Cannot find module 'foo'",
    location: {
      file: "src/index.ts",
      line: 5,
      column: 10,
      lineText: "import foo from 'foo';",
    },
  },
];

describe("registerFormatMessagesTool", () => {
  it("registers the esbuild_wasm_format_messages tool", () => {
    const { server } = makeServer();
    expect(server.tools.has("esbuild_wasm_format_messages")).toBe(true);
  });

  it("formats error messages and returns JSON text", async () => {
    const { handler } = makeServer();
    mockEsbuild.formatMessages.mockResolvedValue([
      "ERROR: Cannot find module 'foo'\n  src/index.ts:5:10\n",
    ]);

    const result = (await handler({
      messages: sampleMessages,
      kind: "error",
    })) as { content: { type: string; text: string }[] };

    expect(mockEsbuild.formatMessages).toHaveBeenCalledWith(sampleMessages, {
      kind: "error",
      color: false,
    });
    expect(result.content[0]!.type).toBe("text");
    const parsed = JSON.parse(result.content[0]!.text);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toContain("Cannot find module");
  });

  it("formats warning messages", async () => {
    const { handler } = makeServer();
    mockEsbuild.formatMessages.mockResolvedValue(["WARNING: unused variable\n"]);

    await handler({
      messages: [{ text: "unused variable", location: null }],
      kind: "warning",
    });

    expect(mockEsbuild.formatMessages).toHaveBeenCalledWith(expect.any(Array), {
      kind: "warning",
      color: false,
    });
  });

  it("handles messages with notes and no location", async () => {
    const { handler } = makeServer();
    mockEsbuild.formatMessages.mockResolvedValue(["NOTE: consider refactoring\n"]);

    const result = (await handler({
      messages: [
        {
          text: "consider refactoring",
          location: null,
          notes: [{ text: "see docs", location: null }],
        },
      ],
      kind: "warning",
    })) as { content: { text: string }[] };

    expect(result.content[0]!.text).toBeTruthy();
  });

  it("returns error response when formatMessages throws", async () => {
    const { handler } = makeServer();
    mockEsbuild.formatMessages.mockRejectedValue(new Error("format failed"));

    const result = (await handler({
      messages: sampleMessages,
      kind: "error",
    })) as { isError: boolean };

    expect(result.isError).toBe(true);
  });

  it("always passes color: false to formatMessages", async () => {
    const { handler } = makeServer();
    mockEsbuild.formatMessages.mockResolvedValue([]);

    await handler({ messages: [], kind: "error" });

    expect(mockEsbuild.formatMessages).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ color: false }),
    );
  });
});
