import { describe, expect, it, vi } from "vitest";
import { registerInitializeTool } from "./initialize.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const mockInitializeWasm = vi.hoisted(() => vi.fn());

vi.mock("../wasm-api.js", () => ({
  initializeWasm: mockInitializeWasm,
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
  registerInitializeTool(server as unknown as McpServer);
  const handler = server.tools.get("esbuild_wasm_initialize")!;
  return { server, handler };
}

const readyState = {
  status: "ready" as const,
  version: "0.27.4",
  options: {},
  error: null,
  initializedAt: new Date().toISOString(),
};

describe("registerInitializeTool", () => {
  it("registers the esbuild_wasm_initialize tool", () => {
    const { server } = makeServer();
    expect(server.tools.has("esbuild_wasm_initialize")).toBe(true);
  });

  it("returns ready state JSON on successful initialization", async () => {
    const { handler } = makeServer();
    mockInitializeWasm.mockResolvedValue(readyState);

    const result = (await handler({})) as { content: { type: string; text: string }[] };

    expect(mockInitializeWasm).toHaveBeenCalledWith({});
    expect(result.content[0]!.type).toBe("text");

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.status).toBe("ready");
    expect(parsed.version).toBe("0.27.4");
  });

  it("passes wasmURL option to initializeWasm", async () => {
    const { handler } = makeServer();
    mockInitializeWasm.mockResolvedValue({
      ...readyState,
      options: { wasmURL: "https://cdn.example.com/esbuild.wasm" },
    });

    await handler({ wasmURL: "https://cdn.example.com/esbuild.wasm" });

    expect(mockInitializeWasm).toHaveBeenCalledWith(
      expect.objectContaining({ wasmURL: "https://cdn.example.com/esbuild.wasm" }),
    );
  });

  it("passes wasmModule file path to initializeWasm", async () => {
    const { handler } = makeServer();
    mockInitializeWasm.mockResolvedValue({
      ...readyState,
      options: { wasmModule: "/usr/local/lib/esbuild.wasm" },
    });

    await handler({ wasmModule: "/usr/local/lib/esbuild.wasm" });

    expect(mockInitializeWasm).toHaveBeenCalledWith(
      expect.objectContaining({ wasmModule: "/usr/local/lib/esbuild.wasm" }),
    );
  });

  it("passes worker flag to initializeWasm", async () => {
    const { handler } = makeServer();
    mockInitializeWasm.mockResolvedValue({ ...readyState, options: { worker: true } });

    await handler({ worker: true });

    expect(mockInitializeWasm).toHaveBeenCalledWith(expect.objectContaining({ worker: true }));
  });

  it("returns error response when initializeWasm throws", async () => {
    const { handler } = makeServer();
    mockInitializeWasm.mockRejectedValue(new Error("WASM init failed"));

    const result = (await handler({})) as { isError: boolean; content: { text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("WASM init failed");
  });

  it("serializes the full state object as pretty-printed JSON", async () => {
    const { handler } = makeServer();
    mockInitializeWasm.mockResolvedValue(readyState);

    const result = (await handler({})) as { content: { text: string }[] };
    const text = result.content[0]!.text;

    // Pretty-printed — should contain newlines
    expect(text).toContain("\n");
    const parsed = JSON.parse(text);
    expect(parsed).toMatchObject({ status: "ready", version: "0.27.4" });
  });
});
