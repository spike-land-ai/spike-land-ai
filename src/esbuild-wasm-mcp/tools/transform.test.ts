import { describe, expect, it, vi } from "vitest";
import { registerTransformTool } from "./transform.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const mockEsbuild = vi.hoisted(() => ({
  transform: vi.fn(),
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
  registerTransformTool(server as unknown as McpServer);
  const handler = server.tools.get("esbuild_wasm_transform")!;
  return { server, handler };
}

describe("registerTransformTool", () => {
  it("registers the esbuild_wasm_transform tool", () => {
    const { server } = makeServer();
    expect(server.tools.has("esbuild_wasm_transform")).toBe(true);
  });

  it("transforms TypeScript code and returns code + warnings", async () => {
    const { handler } = makeServer();
    mockEsbuild.transform.mockResolvedValue({
      code: "const x = 1;\n",
      warnings: [],
      map: "",
      mangleCache: undefined,
    });

    const result = (await handler({
      code: "const x: number = 1;",
    })) as { content: { type: string; text: string }[] };

    expect(mockEsbuild.transform).toHaveBeenCalledWith(
      "const x: number = 1;",
      expect.objectContaining({ loader: "ts" }),
    );
    expect(result.content[0]!.type).toBe("text");
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.code).toBe("const x = 1;\n");
    expect(parsed.warnings).toEqual([]);
  });

  it("does not include map in output when map is empty string", async () => {
    const { handler } = makeServer();
    mockEsbuild.transform.mockResolvedValue({
      code: "console.log(1);\n",
      warnings: [],
      map: "",
    });

    const result = (await handler({ code: "console.log(1);" })) as {
      content: { text: string }[];
    };
    const parsed = JSON.parse(result.content[0]!.text);

    // Empty map string is falsy — should not appear in output
    expect("map" in parsed).toBe(false);
  });

  it("includes map in output when source map is present", async () => {
    const { handler } = makeServer();
    mockEsbuild.transform.mockResolvedValue({
      code: "const x = 1;\n",
      warnings: [],
      map: '{"version":3}',
    });

    const result = (await handler({
      code: "const x: number = 1;",
      sourcemap: true,
    })) as { content: { text: string }[] };
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.map).toBe('{"version":3}');
  });

  it("includes mangleCache in output when present", async () => {
    const { handler } = makeServer();
    mockEsbuild.transform.mockResolvedValue({
      code: "const a = 1;\n",
      warnings: [],
      map: "",
      mangleCache: { longName: "a" },
    });

    const result = (await handler({
      code: "const longName = 1;",
      mangleProps: "^long",
    })) as { content: { text: string }[] };
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.mangleCache).toEqual({ longName: "a" });
  });

  it("uses ts loader by default", async () => {
    const { handler } = makeServer();
    mockEsbuild.transform.mockResolvedValue({
      code: "export {};\n",
      warnings: [],
      map: "",
    });

    await handler({ code: "export {};" });

    expect(mockEsbuild.transform).toHaveBeenCalledWith(
      "export {};",
      expect.objectContaining({ loader: "ts" }),
    );
  });

  it("respects an explicit loader override", async () => {
    const { handler } = makeServer();
    mockEsbuild.transform.mockResolvedValue({
      code: "const x = require('x');\n",
      warnings: [],
      map: "",
    });

    await handler({ code: "const x = require('x');", loader: "js" });

    expect(mockEsbuild.transform).toHaveBeenCalledWith(
      "const x = require('x');",
      expect.objectContaining({ loader: "js" }),
    );
  });

  it("converts mangleProps string to RegExp before passing to esbuild", async () => {
    const { handler } = makeServer();
    mockEsbuild.transform.mockResolvedValue({
      code: "const a = {};\n",
      warnings: [],
      map: "",
    });

    await handler({ code: "const _private = {};", mangleProps: "^_" });

    // Use the last call since prior tests in this file also invoke transform
    const lastCall = mockEsbuild.transform.mock.calls.at(-1)!;
    const callArgs = lastCall[1] as Record<string, unknown>;
    expect(callArgs.mangleProps).toBeInstanceOf(RegExp);
    expect((callArgs.mangleProps as RegExp).source).toBe("^_");
  });

  it("returns error response when transform throws", async () => {
    const { handler } = makeServer();
    mockEsbuild.transform.mockRejectedValue(new Error("Transform failed"));

    const result = (await handler({ code: "bad code >>>" })) as {
      isError: boolean;
      content: { text: string }[];
    };

    expect(result.isError).toBe(true);
  });

  it("returns esbuild error structure when transform throws with errors array", async () => {
    const { handler } = makeServer();
    const esbuildErr = {
      message: "Unexpected token",
      errors: [{ text: "Unexpected token", location: null }],
      warnings: [],
    };
    mockEsbuild.transform.mockRejectedValue(esbuildErr);

    const result = (await handler({ code: ">>>" })) as {
      isError: boolean;
      content: { text: string }[];
    };

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.errors).toBeDefined();
  });

  it("passes minify options through to transform", async () => {
    const { handler } = makeServer();
    mockEsbuild.transform.mockResolvedValue({ code: "const x=1;", warnings: [], map: "" });

    await handler({ code: "const x = 1;", minify: true });

    expect(mockEsbuild.transform).toHaveBeenCalledWith(
      "const x = 1;",
      expect.objectContaining({ minify: true }),
    );
  });
});
