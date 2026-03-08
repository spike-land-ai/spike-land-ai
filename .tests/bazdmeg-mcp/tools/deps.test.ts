/**
 * Tests for dep graph tool (bazdmeg_dep_graph)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockServer } from "../__test-utils__/mock-server.js";

vi.mock("../../../src/mcp-tools/bazdmeg/node-sys/manifest.js", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    readManifest: vi.fn(actual.readManifest as (...args: unknown[]) => unknown),
    clearManifestCache: vi.fn(actual.clearManifestCache as (...args: unknown[]) => unknown),
    topologicalSort: vi.fn(actual.topologicalSort as (...args: unknown[]) => unknown),
  };
});

import { readManifest, topologicalSort } from "../../../src/mcp-tools/bazdmeg/node-sys/manifest.js";
import { registerDepGraphTools } from "../../../src/mcp-tools/bazdmeg/mcp/deps.js";

const mockReadManifest = vi.mocked(readManifest);
const mockTopologicalSort = vi.mocked(topologicalSort);

const MOCK_MANIFEST = {
  defaults: {
    scope: "@spike-land-ai",
    registry: "npm.pkg.github.com",
    license: "MIT",
    type: "module",
  },
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
    mockReadManifest.mockResolvedValue(
      MOCK_MANIFEST as ReturnType<typeof readManifest> extends Promise<infer T> ? T : never,
    );
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

  describe("tree format — edge cases", () => {
    it("shows (external) for deps not in manifest", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: MOCK_MANIFEST.defaults,
        packages: {
          "my-pkg": {
            kind: "library",
            version: "1.0.0",
            description: "My pkg",
            entry: "src/index.ts",
            deps: ["external-lib"],
          },
        },
      } as ReturnType<typeof readManifest> extends Promise<infer T> ? T : never);

      const result = await server.call("bazdmeg_dep_graph", {
        packageName: "my-pkg",
        format: "tree",
      });
      expect(result.content[0].text).toContain("(external)");
    });

    it("shows (circular) for circular deps in tree", async () => {
      // Pre-populate visited to simulate circular
      mockReadManifest.mockResolvedValue({
        defaults: MOCK_MANIFEST.defaults,
        packages: {
          "pkg-a": {
            kind: "library",
            version: "1.0.0",
            description: "A",
            entry: "src/index.ts",
            deps: ["pkg-b"],
          },
          "pkg-b": {
            kind: "library",
            version: "1.0.0",
            description: "B",
            entry: "src/index.ts",
            deps: ["pkg-a"],
          },
        },
      } as ReturnType<typeof readManifest> extends Promise<infer T> ? T : never);

      // With circular deps, the tree should show one of them as circular
      const result = await server.call("bazdmeg_dep_graph", {
        packageName: "pkg-a",
        format: "tree",
      });
      // pkg-b is a dep of pkg-a; pkg-a is already visited, so pkg-b's dep on pkg-a shows as circular
      expect(result.content[0].text).toContain("pkg-b");
    });

    it("shows child deps in tree with multiple levels", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: MOCK_MANIFEST.defaults,
        packages: {
          "spike-cli": {
            kind: "cli",
            version: "1.0.0",
            description: "CLI",
            entry: "src/index.ts",
            deps: ["chess-engine"],
          },
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
        },
      } as ReturnType<typeof readManifest> extends Promise<infer T> ? T : never);

      const result = await server.call("bazdmeg_dep_graph", {
        packageName: "spike-cli",
        format: "tree",
      });
      const text = result.content[0].text;
      expect(text).toContain("chess-engine");
      expect(text).toContain("shared");
    });
  });

  describe("mermaid format — transitive deps for rootPackage", () => {
    it("includes transitive deps when filtering by root package", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: MOCK_MANIFEST.defaults,
        packages: {
          "spike-cli": {
            kind: "cli",
            version: "1.0.0",
            description: "CLI",
            entry: "src/index.ts",
            deps: ["chess-engine"],
          },
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
        },
      } as ReturnType<typeof readManifest> extends Promise<infer T> ? T : never);

      const result = await server.call("bazdmeg_dep_graph", {
        packageName: "spike-cli",
        format: "mermaid",
      });
      const text = result.content[0].text;
      // Should include direct dep
      expect(text).toContain("spike-cli --> chess-engine");
      // Should include transitive dep
      expect(text).toContain("chess-engine --> shared");
    });

    it("shows isolated nodes in mermaid (packages with no deps and not a dep)", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: MOCK_MANIFEST.defaults,
        packages: {
          isolated: {
            kind: "library",
            version: "1.0.0",
            description: "Isolated",
            entry: "src/index.ts",
          },
        },
      } as ReturnType<typeof readManifest> extends Promise<infer T> ? T : never);

      const result = await server.call("bazdmeg_dep_graph", {
        format: "mermaid",
      });
      const text = result.content[0].text;
      expect(text).toContain("isolated");
    });
  });

  describe("list format — error handling", () => {
    it("handles circular dependency error in buildList", async () => {
      // The topologicalSort function throws on circular deps, which buildList catches
      mockReadManifest.mockResolvedValue({
        defaults: MOCK_MANIFEST.defaults,
        packages: {
          "pkg-a": {
            kind: "library",
            version: "1.0.0",
            description: "A",
            entry: "src/index.ts",
            deps: ["pkg-b"],
          },
          "pkg-b": {
            kind: "library",
            version: "1.0.0",
            description: "B",
            entry: "src/index.ts",
            deps: ["pkg-a"],
          },
        },
      } as ReturnType<typeof readManifest> extends Promise<infer T> ? T : never);

      const result = await server.call("bazdmeg_dep_graph", {
        format: "list",
      });
      const text = result.content[0].text;
      // Should show error for circular deps
      expect(text).toContain("ERROR");
      expect(text).toContain("Circular");
    });

    it("handles non-Error objects in catch block of buildList", async () => {
      // Mock topologicalSort to throw a string instead of an Error
      mockTopologicalSort.mockImplementationOnce(() => {
        throw "something went wrong as string";
      });

      const result = await server.call("bazdmeg_dep_graph", {
        format: "list",
      });
      expect(result.content[0].text).toContain("something went wrong as string");
    });

    it("covers diamond dependency in buildList filter", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: MOCK_MANIFEST.defaults,
        packages: {
          A: { kind: "library", version: "1.0.0", deps: ["B", "C"] },
          B: { kind: "library", version: "1.0.0", deps: ["E"] },
          C: { kind: "library", version: "1.0.0", deps: ["E"] },
          E: { kind: "library", version: "1.0.0", deps: [] },
          D: { kind: "library", version: "1.0.0", deps: [] },
        },
      } as Record<string, unknown>);

      const result = await server.call("bazdmeg_dep_graph", {
        packageName: "A",
        format: "list",
      });
      const text = result.content[0].text;
      expect(text).toContain("E");
      expect(text).not.toContain("D");
    });

    it("covers package without kind in buildList", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: MOCK_MANIFEST.defaults,
        packages: {
          "no-kind": { version: "1.0.0", deps: [] },
        },
      } as Record<string, unknown>);

      const result = await server.call("bazdmeg_dep_graph", {
        format: "list",
      });
      expect(result.content[0].text).toContain("?");
    });
  });

  describe("misc edge cases", () => {
    it("covers buildTree childIsLast branch and complex tree", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: MOCK_MANIFEST.defaults,
        packages: {
          root: { kind: "library", version: "1.0.0", deps: ["child"] },
          child: { kind: "library", version: "1.0.0", deps: ["dep1", "dep2"] },
          dep1: { kind: "library", version: "1.0.0" },
          dep2: { kind: "library", version: "1.0.0" },
        },
      } as Record<string, unknown>);

      const result = await server.call("bazdmeg_dep_graph", {
        packageName: "root",
        format: "tree",
      });
      expect(result.content[0].text).toContain("dep1");
      expect(result.content[0].text).toContain("dep2");
    });

    it("covers buildMermaid edge cases including duplicate and missing deps", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: MOCK_MANIFEST.defaults,
        packages: {
          pkg: { kind: "library", version: "1.0.0", deps: ["dep", "dep", "transitive"] },
          dep: { kind: "library", version: "1.0.0", deps: ["transitive", "transitive"] },
          transitive: { kind: "library", version: "1.0.0" },
        },
      } as Record<string, unknown>);

      // This should hit !seen.has(edge) being false for both direct and transitive loops
      const result = await server.call("bazdmeg_dep_graph", {
        packageName: "pkg",
        format: "mermaid",
      });
      const text = result.content[0].text;
      // Should only appear once even though it's twice in manifest
      const lines = text.split("\n").filter((l) => l.includes("pkg --> dep"));
      expect(lines.length).toBe(1);
    });

    it("covers default switch case for invalid format", async () => {
      const result = await server.call("bazdmeg_dep_graph", {
        packageName: "chess-engine",
        format: "invalid",
      });
      expect(result.content[0].text).toContain("Dependency Tree");
    });
  });
});
