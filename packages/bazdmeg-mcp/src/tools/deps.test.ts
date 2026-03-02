/**
 * Tests for dep graph tool (bazdmeg_dep_graph)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockServer } from "../__test-utils__/mock-server.js";

vi.mock("../manifest.js", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    readManifest: vi.fn(),
    clearManifestCache: vi.fn(),
  };
});

import { readManifest } from "../manifest.js";
import { registerDepGraphTools } from "./deps.js";

const mockReadManifest = vi.mocked(readManifest);

const MOCK_MANIFEST = {
  defaults: { scope: "@spike-land-ai", registry: "npm.pkg.github.com", license: "MIT", type: "module" },
  packages: {
    "chess-engine": {
      kind: "library",
      version: "1.0.0",
      description: "Chess",
      entry: "src/index.ts",
      deps: ["shared"],
    },
    shared: {
      kind: "library",
      version: "1.0.0",
      description: "Shared",
      entry: "src/index.ts",
    },
    "spike-cli": {
      kind: "cli",
      version: "1.0.0",
      description: "CLI",
      entry: "src/index.ts",
      deps: ["shared", "chess-engine"],
    },
    "spike-edge": {
      kind: "worker",
      version: "1.0.0",
      description: "Edge",
      entry: "src/index.ts",
    },
  },
};

describe("dep graph tools", () => {
  let server: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    server = createMockServer();
    registerDepGraphTools(server as unknown as McpServer);
    vi.clearAllMocks();
    mockReadManifest.mockResolvedValue(MOCK_MANIFEST as ReturnType<typeof readManifest> extends Promise<infer T> ? T : never);
  });

  it("registers the dep_graph tool", () => {
    expect(server.handlers.has("bazdmeg_dep_graph")).toBe(true);
  });

  describe("tree format", () => {
    it("shows tree for a specific package", async () => {
      const result = await server.call("bazdmeg_dep_graph", {
        packageName: "chess-engine",
        format: "tree",
      });
      const text = result.content[0].text;
      expect(text).toContain("Dependency Tree");
      expect(text).toContain("chess-engine");
      expect(text).toContain("shared");
    });

    it("shows tree for all packages", async () => {
      const result = await server.call("bazdmeg_dep_graph", {
        format: "tree",
      });
      const text = result.content[0].text;
      expect(text).toContain("All Packages");
      expect(text).toContain("Roots");
    });

    it("defaults to tree format", async () => {
      const result = await server.call("bazdmeg_dep_graph", {
        packageName: "chess-engine",
      });
      expect(result.content[0].text).toContain("Dependency Tree");
    });
  });

  describe("list format", () => {
    it("shows topological order for all packages", async () => {
      const result = await server.call("bazdmeg_dep_graph", {
        format: "list",
      });
      const text = result.content[0].text;
      expect(text).toContain("Topological Order");
      expect(text).toContain("shared");
      expect(text).toContain("chess-engine");
      expect(text).toContain("spike-cli");
      // shared should come before chess-engine in topo order
      const sharedIdx = text.indexOf("shared");
      const chessIdx = text.indexOf("chess-engine");
      expect(sharedIdx).toBeLessThan(chessIdx);
    });

    it("shows topological order for specific package subgraph", async () => {
      const result = await server.call("bazdmeg_dep_graph", {
        packageName: "spike-cli",
        format: "list",
      });
      const text = result.content[0].text;
      expect(text).toContain("spike-cli");
    });
  });

  describe("mermaid format", () => {
    it("generates mermaid diagram for all packages", async () => {
      const result = await server.call("bazdmeg_dep_graph", {
        format: "mermaid",
      });
      const text = result.content[0].text;
      expect(text).toContain("```mermaid");
      expect(text).toContain("graph TD");
      expect(text).toContain("chess-engine --> shared");
      expect(text).toContain("spike-cli --> shared");
      expect(text).toContain("spike-cli --> chess-engine");
    });

    it("generates mermaid diagram for specific package", async () => {
      const result = await server.call("bazdmeg_dep_graph", {
        packageName: "chess-engine",
        format: "mermaid",
      });
      const text = result.content[0].text;
      expect(text).toContain("chess-engine --> shared");
      // Should not include spike-cli since it's not a dep of chess-engine
    });
  });

  describe("error handling", () => {
    it("errors when package not found", async () => {
      const result = await server.call("bazdmeg_dep_graph", {
        packageName: "nonexistent",
      });
      expect(result.content[0].text).toContain("ERROR");
      expect(result.content[0].text).toContain("not found");
    });

    it("handles unexpected errors", async () => {
      mockReadManifest.mockRejectedValue(new Error("manifest read fail"));

      const result = await server.call("bazdmeg_dep_graph", {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("manifest read fail");
    });
  });
});
