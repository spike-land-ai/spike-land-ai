/**
 * Tests for manifest tools (bazdmeg_manifest_query, bazdmeg_manifest_validate)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockServer } from "../__test-utils__/mock-server.js";

vi.mock("../../../src/mcp-tools/bazdmeg/node-sys/manifest.js", () => ({
  readManifest: vi.fn(),
  clearManifestCache: vi.fn(),
}));

import { readManifest } from "../../../src/mcp-tools/bazdmeg/node-sys/manifest.js";
import { registerManifestTools } from "../../../src/mcp-tools/bazdmeg/mcp/manifest.js";

const mockReadManifest = vi.mocked(readManifest);

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
      version: "1.2.0",
      description: "Chess ELO engine",
      entry: "src/index.ts",
      deps: ["shared"],
    },
    shared: {
      kind: "library",
      version: "0.5.0",
      description: "Shared utilities",
      entry: "src/index.ts",
    },
    "spike-edge": {
      kind: "worker",
      version: "1.0.0",
      description: "Edge worker",
      entry: "src/index.ts",
      worker: { name: "spike-edge", compatibility_date: "2024-01-01" },
    },
    "spike-cli": {
      kind: "cli",
      version: "2.0.0",
      description: "CLI tool",
      entry: "src/index.ts",
      bin: "./dist/cli.js",
      mirror: "git@github.com:org/spike-cli.git",
    },
  },
};

describe("manifest tools", () => {
  let server: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    server = createMockServer();
    registerManifestTools(server as unknown as McpServer);
    vi.clearAllMocks();
    mockReadManifest.mockResolvedValue(
      MOCK_MANIFEST as ReturnType<typeof readManifest> extends Promise<infer T> ? T : never,
    );
  });

  describe("bazdmeg_manifest_query", () => {
    it("registers the tool", () => {
      expect(server.handlers.has("bazdmeg_manifest_query")).toBe(true);
    });

    it("returns all packages when no filter", async () => {
      const result = await server.call("bazdmeg_manifest_query", {});
      const text = result.content[0].text;
      expect(text).toContain("chess-engine");
      expect(text).toContain("shared");
      expect(text).toContain("spike-edge");
      expect(text).toContain("spike-cli");
      expect(text).toContain("**Matching packages**: 4");
    });

    it("filters by packageName", async () => {
      const result = await server.call("bazdmeg_manifest_query", {
        packageName: "chess-engine",
      });
      const text = result.content[0].text;
      expect(text).toContain("chess-engine");
      expect(text).toContain("1.2.0");
      expect(text).not.toContain("### shared");
    });

    it("filters by kind", async () => {
      const result = await server.call("bazdmeg_manifest_query", {
        kind: "library",
      });
      const text = result.content[0].text;
      expect(text).toContain("chess-engine");
      expect(text).toContain("shared");
      expect(text).not.toContain("### spike-edge");
    });

    it("extracts specific field", async () => {
      const result = await server.call("bazdmeg_manifest_query", {
        field: "version",
      });
      const text = result.content[0].text;
      expect(text).toContain("field: `version`");
      expect(text).toContain("1.2.0");
      expect(text).toContain("0.5.0");
    });

    it("returns no-match message when nothing found", async () => {
      const result = await server.call("bazdmeg_manifest_query", {
        kind: "nonexistent",
      });
      expect(result.content[0].text).toContain("No packages found");
    });

    it("shows mirror and worker info", async () => {
      const result = await server.call("bazdmeg_manifest_query", {
        packageName: "spike-cli",
      });
      const text = result.content[0].text;
      expect(text).toContain("mirror");
      expect(text).toContain("git@github.com");
    });

    it("handles unexpected errors", async () => {
      mockReadManifest.mockRejectedValue(new Error("parse fail"));

      const result = await server.call("bazdmeg_manifest_query", {});
      expect(result.isError).toBe(true);
    });
  });

  describe("bazdmeg_manifest_validate", () => {
    it("registers the tool", () => {
      expect(server.handlers.has("bazdmeg_manifest_validate")).toBe(true);
    });

    it("validates a correct manifest", async () => {
      const result = await server.call("bazdmeg_manifest_validate", {});
      const text = result.content[0].text;
      expect(text).toContain("Manifest Validation");
      expect(text).toContain("**Packages**: 4");
      // spike-cli is CLI without bin warning... actually it has bin
      // spike-edge is worker with worker section
      // No errors expected for this manifest
    });

    it("detects missing deps", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: {
          scope: "@spike-land-ai",
          registry: "npm.pkg.github.com",
          license: "MIT",
          type: "module",
        },
        packages: {
          "pkg-a": {
            kind: "library",
            version: "1.0.0",
            description: "a",
            entry: "src/index.ts",
            deps: ["nonexistent"],
          },
        },
      } as ReturnType<typeof readManifest> extends Promise<infer T> ? T : never);

      const result = await server.call("bazdmeg_manifest_validate", {});
      const text = result.content[0].text;
      expect(text).toContain("Errors");
      expect(text).toContain("nonexistent");
      expect(text).toContain("not found");
    });

    it("detects worker package without worker section", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: {
          scope: "@spike-land-ai",
          registry: "npm.pkg.github.com",
          license: "MIT",
          type: "module",
        },
        packages: {
          "bad-worker": {
            kind: "worker",
            version: "1.0.0",
            description: "missing worker section",
            entry: "src/index.ts",
          },
        },
      } as ReturnType<typeof readManifest> extends Promise<infer T> ? T : never);

      const result = await server.call("bazdmeg_manifest_validate", {});
      expect(result.content[0].text).toContain("kind=worker but no");
    });

    it("warns on CLI without bin", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: {
          scope: "@spike-land-ai",
          registry: "npm.pkg.github.com",
          license: "MIT",
          type: "module",
        },
        packages: {
          "bad-cli": {
            kind: "cli",
            version: "1.0.0",
            description: "no bin",
            entry: "src/index.ts",
          },
        },
      } as ReturnType<typeof readManifest> extends Promise<infer T> ? T : never);

      const result = await server.call("bazdmeg_manifest_validate", {});
      expect(result.content[0].text).toContain("kind=cli but no");
    });

    it("detects missing required fields", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: {
          scope: "@spike-land-ai",
          registry: "npm.pkg.github.com",
          license: "MIT",
          type: "module",
        },
        packages: {
          "bad-pkg": {
            kind: "",
            version: "",
            description: "",
            entry: "",
          },
        },
      } as ReturnType<typeof readManifest> extends Promise<infer T> ? T : never);

      const result = await server.call("bazdmeg_manifest_validate", {});
      const text = result.content[0].text;
      expect(text).toContain("missing `kind`");
      expect(text).toContain("missing `version`");
    });

    it("detects circular deps", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: {
          scope: "@spike-land-ai",
          registry: "npm.pkg.github.com",
          license: "MIT",
          type: "module",
        },
        packages: {
          "pkg-a": {
            kind: "library",
            version: "1.0.0",
            description: "a",
            entry: "src/index.ts",
            deps: ["pkg-b"],
          },
          "pkg-b": {
            kind: "library",
            version: "1.0.0",
            description: "b",
            entry: "src/index.ts",
            deps: ["pkg-a"],
          },
        },
      } as ReturnType<typeof readManifest> extends Promise<infer T> ? T : never);

      const result = await server.call("bazdmeg_manifest_validate", {});
      expect(result.content[0].text).toContain("Circular");
    });

    it("handles unexpected errors", async () => {
      mockReadManifest.mockRejectedValue(new Error("IO fail"));

      const result = await server.call("bazdmeg_manifest_validate", {});
      expect(result.isError).toBe(true);
    });

    it("shows name filter in no-match message", async () => {
      const result = await server.call("bazdmeg_manifest_query", {
        packageName: "ghost",
      });
      expect(result.content[0].text).toContain("name=ghost");
    });

    it("handles missing fields in query results", async () => {
      const result = await server.call("bazdmeg_manifest_query", {
        field: "mirror",
      });
      const text = result.content[0].text;
      expect(text).toContain("| shared | — |");
    });

    it("warns on non-worker with worker section", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: MOCK_MANIFEST.defaults,
        packages: {
          "lib-oops": {
            kind: "library",
            version: "1.0.0",
            description: "lib",
            entry: "src/index.ts",
            worker: { name: "oops" },
          },
        },
      } as Record<string, unknown>);

      const result = await server.call("bazdmeg_manifest_validate", {});
      expect(result.content[0].text).toContain("has `worker` section but kind=library");
    });

    it("reports errors for missing defaults", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: {},
        packages: {},
      } as Record<string, unknown>);

      const result = await server.call("bazdmeg_manifest_validate", {});
      expect(result.content[0].text).toContain("defaults: missing `scope`平衡".replace("平衡", ""));
      expect(result.content[0].text).toContain(
        "defaults: missing `registry`平衡".replace("平衡", ""),
      );
      expect(result.content[0].text).toContain(
        "defaults: missing `license`平衡".replace("平衡", ""),
      );
    });
  });
});
