import { describe, expect, it, vi } from "vitest";
import { registerAnalyzeTool } from "./analyze.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const mockEsbuild = vi.hoisted(() => ({
  analyzeMetafile: vi.fn(),
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
  registerAnalyzeTool(server as unknown as McpServer);
  const handler = server.tools.get("esbuild_wasm_analyze_metafile")!;
  return { server, handler };
}

describe("registerAnalyzeTool", () => {
  it("registers the esbuild_wasm_analyze_metafile tool", () => {
    const { server } = makeServer();
    expect(server.tools.has("esbuild_wasm_analyze_metafile")).toBe(true);
  });

  it("returns analysis text for a valid metafile JSON string", async () => {
    const { handler } = makeServer();
    const metafileObj = { inputs: {}, outputs: {} };
    mockEsbuild.analyzeMetafile.mockResolvedValue("bundle analysis text");

    const result = (await handler({
      metafile: JSON.stringify(metafileObj),
    })) as { content: { type: string; text: string }[] };

    expect(mockEsbuild.analyzeMetafile).toHaveBeenCalledWith(metafileObj, {
      verbose: undefined,
    });
    expect(result.content[0]!.type).toBe("text");
    expect(result.content[0]!.text).toBe("bundle analysis text");
  });

  it("passes verbose flag to analyzeMetafile", async () => {
    const { handler } = makeServer();
    mockEsbuild.analyzeMetafile.mockResolvedValue("verbose analysis");

    await handler({
      metafile: JSON.stringify({ inputs: {}, outputs: {} }),
      verbose: true,
    });

    expect(mockEsbuild.analyzeMetafile).toHaveBeenCalledWith(expect.any(Object), { verbose: true });
  });

  it("returns error response for invalid JSON metafile", async () => {
    const { handler } = makeServer();

    const result = (await handler({ metafile: "NOT VALID JSON" })) as {
      isError: boolean;
      content: { text: string }[];
    };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Invalid JSON in metafile");
  });

  it("returns error response when analyzeMetafile throws", async () => {
    const { handler } = makeServer();
    mockEsbuild.analyzeMetafile.mockRejectedValue(new Error("analysis failed"));

    const result = (await handler({
      metafile: JSON.stringify({ inputs: {}, outputs: {} }),
    })) as { isError: boolean };

    expect(result.isError).toBe(true);
  });
});
