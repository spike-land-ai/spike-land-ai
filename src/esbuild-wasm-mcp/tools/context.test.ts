import { describe, expect, it, vi, beforeEach } from "vitest";
import { registerContextTool } from "./context.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const mockContext = vi.hoisted(() => vi.fn());
const mockRebuild = vi.hoisted(() => vi.fn());
const mockDispose = vi.hoisted(() => vi.fn());

vi.mock("@spike-land-ai/esbuild-wasm", () => ({
  context: mockContext,
  version: "0.27.4",
  initialize: vi.fn().mockResolvedValue(undefined),
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
  registerContextTool(server as unknown as McpServer);
  const handler = server.tools.get("esbuild_wasm_context")!;
  return { server, handler };
}

describe("context tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers esbuild_wasm_context tool", () => {
    const { server } = makeServer();
    expect(server.tools.has("esbuild_wasm_context")).toBe(true);
  });

  it("successfully creates context, rebuilds and disposes", async () => {
    const { handler } = makeServer();
    mockRebuild.mockResolvedValue({
      outputFiles: [{ path: "out.js", text: "code" }],
      warnings: [],
      errors: [],
    });
    mockContext.mockResolvedValue({
      rebuild: mockRebuild,
      dispose: mockDispose,
    });

    const result = (await handler({ entryPoints: ["in.js"] })) as any;

    expect(mockContext).toHaveBeenCalled();
    expect(mockRebuild).toHaveBeenCalled();
    expect(mockDispose).toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("out.js");
  });

  it("handles context creation failure", async () => {
    const { handler } = makeServer();
    mockContext.mockRejectedValue(new Error("context fail"));

    const result = (await handler({ entryPoints: ["in.js"] })) as any;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("context fail");
  });

  it("handles rebuild failure", async () => {
    const { handler } = makeServer();
    mockRebuild.mockRejectedValue(new Error("rebuild fail"));
    mockContext.mockResolvedValue({
      rebuild: mockRebuild,
      dispose: mockDispose,
    });

    const result = (await handler({ entryPoints: ["in.js"] })) as any;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("rebuild fail");
    expect(mockDispose).toHaveBeenCalled();
  });

  it("handles missing outputFiles and present mangleCache", async () => {
    const { handler } = makeServer();
    mockRebuild.mockResolvedValue({
      warnings: [],
      errors: [],
      mangleCache: { foo: "bar" },
      // outputFiles missing
    });
    mockContext.mockResolvedValue({
      rebuild: mockRebuild,
      dispose: mockDispose,
    });

    const result = (await handler({ entryPoints: ["in.js"] })) as any;
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.outputFiles).toEqual([]);
    expect(parsed.mangleCache).toEqual({ foo: "bar" });
  });
});
