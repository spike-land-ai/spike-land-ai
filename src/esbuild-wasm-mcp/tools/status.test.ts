import { describe, expect, it, vi } from "vitest";
import { registerStatusTool } from "./status.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const mockGetState = vi.hoisted(() => vi.fn());

vi.mock("../wasm-api.js", () => ({
  getState: mockGetState,
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
  registerStatusTool(server as unknown as McpServer);
  const handler = server.tools.get("esbuild_wasm_status")!;
  return { server, handler };
}

describe("registerStatusTool", () => {
  it("registers the esbuild_wasm_status tool", () => {
    const { server } = makeServer();
    expect(server.tools.has("esbuild_wasm_status")).toBe(true);
  });

  it("returns uninitialized state as JSON text", async () => {
    const { handler } = makeServer();
    mockGetState.mockReturnValue({
      status: "uninitialized",
      version: null,
      options: null,
      error: null,
      initializedAt: null,
    });

    const result = (await handler({})) as { content: { type: string; text: string }[] };

    expect(result.content[0]!.type).toBe("text");
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.status).toBe("uninitialized");
    expect(parsed.version).toBeNull();
    expect(parsed.error).toBeNull();
  });

  it("returns ready state with version and timestamp", async () => {
    const { handler } = makeServer();
    const now = new Date().toISOString();
    mockGetState.mockReturnValue({
      status: "ready",
      version: "0.27.4",
      options: { worker: false },
      error: null,
      initializedAt: now,
    });

    const result = (await handler({})) as { content: { text: string }[] };
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.status).toBe("ready");
    expect(parsed.version).toBe("0.27.4");
    expect(parsed.initializedAt).toBe(now);
    expect(parsed.options).toEqual({ worker: false });
  });

  it("returns error state with error message", async () => {
    const { handler } = makeServer();
    mockGetState.mockReturnValue({
      status: "error",
      version: null,
      options: { wasmURL: "https://bad.url/esbuild.wasm" },
      error: "Error: Failed to fetch WASM",
      initializedAt: null,
    });

    const result = (await handler({})) as { content: { text: string }[] };
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.status).toBe("error");
    expect(parsed.error).toContain("Failed to fetch WASM");
  });

  it("returns initializing state", async () => {
    const { handler } = makeServer();
    mockGetState.mockReturnValue({
      status: "initializing",
      version: null,
      options: {},
      error: null,
      initializedAt: null,
    });

    const result = (await handler({})) as { content: { text: string }[] };
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.status).toBe("initializing");
  });

  it("returns pretty-printed JSON (contains newlines)", async () => {
    const { handler } = makeServer();
    mockGetState.mockReturnValue({
      status: "ready",
      version: "0.27.4",
      options: null,
      error: null,
      initializedAt: null,
    });

    const result = (await handler({})) as { content: { text: string }[] };
    expect(result.content[0]!.text).toContain("\n");
  });

  it("calls getState on every invocation", async () => {
    const { handler } = makeServer();
    mockGetState.mockReturnValue({
      status: "ready",
      version: "0.27.4",
      options: null,
      error: null,
      initializedAt: null,
    });

    // Track how many times getState is called specifically in this test
    const callsBefore = mockGetState.mock.calls.length;
    await handler({});
    await handler({});
    await handler({});
    const callsAfter = mockGetState.mock.calls.length;

    expect(callsAfter - callsBefore).toBe(3);
  });
});
