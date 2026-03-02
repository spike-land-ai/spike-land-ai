/**
 * Tests for publish tools (bazdmeg_generate_package_json, bazdmeg_publish_npm)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockServer } from "../__test-utils__/mock-server.js";

vi.mock("../shell.js", () => ({
  runCommand: vi.fn(),
  hasScript: vi.fn(),
}));

vi.mock("../manifest.js", () => ({
  getManifestPackage: vi.fn(),
  readManifest: vi.fn(),
  clearManifestCache: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn(),
}));

import { runCommand } from "../shell.js";
import { readManifest } from "../manifest.js";
import { writeFile } from "node:fs/promises";
import { registerPublishTools } from "./publish.js";

const mockRunCommand = vi.mocked(runCommand);
const mockReadManifest = vi.mocked(readManifest);
const mockWriteFile = vi.mocked(writeFile);

function ok(stdout = ""): { ok: true; stdout: string; stderr: string; code: 0 } {
  return { ok: true, stdout, stderr: "", code: 0 };
}

function fail(stderr = "error"): { ok: false; stdout: string; stderr: string; code: 1 } {
  return { ok: false, stdout: "", stderr, code: 1 };
}

const MOCK_MANIFEST = {
  defaults: { scope: "@spike-land-ai", registry: "npm.pkg.github.com", license: "MIT", type: "module" },
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
    "spike-cli": {
      kind: "cli",
      version: "2.0.0",
      description: "CLI tool",
      entry: "src/index.ts",
      bin: "./dist/cli.js",
      binName: "spike",
    },
    "spike-edge": {
      kind: "worker",
      version: "1.0.0",
      description: "Edge worker",
      entry: "src/index.ts",
      worker: {
        name: "spike-edge",
        compatibility_date: "2024-01-01",
      },
    },
  },
};

describe("publish tools", () => {
  let server: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    server = createMockServer();
    registerPublishTools(server as unknown as McpServer);
    vi.clearAllMocks();
    mockReadManifest.mockResolvedValue(MOCK_MANIFEST as ReturnType<typeof readManifest> extends Promise<infer T> ? T : never);
  });

  describe("bazdmeg_generate_package_json", () => {
    it("registers the tool", () => {
      expect(server.handlers.has("bazdmeg_generate_package_json")).toBe(true);
    });

    it("generates package.json for a library (dry run)", async () => {
      const result = await server.call("bazdmeg_generate_package_json", {
        packageName: "chess-engine",
      });
      const text = result.content[0].text;
      expect(text).toContain("dry run");
      expect(text).toContain("@spike-land-ai/chess-engine");
      expect(text).toContain("1.2.0");
      expect(text).toContain("@spike-land-ai/shared");
    });

    it("generates package.json for a CLI package", async () => {
      const result = await server.call("bazdmeg_generate_package_json", {
        packageName: "spike-cli",
      });
      const text = result.content[0].text;
      expect(text).toContain("spike");
      expect(text).toContain("./dist/cli.js");
    });

    it("writes to disk when dryRun=false", async () => {
      mockWriteFile.mockResolvedValue(undefined);

      const result = await server.call("bazdmeg_generate_package_json", {
        packageName: "shared",
        dryRun: false,
      });
      const text = result.content[0].text;
      expect(text).toContain("Written to");
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it("returns error for unknown package", async () => {
      const result = await server.call("bazdmeg_generate_package_json", {
        packageName: "nonexistent",
      });
      expect(result.content[0].text).toContain("ERROR");
      expect(result.content[0].text).toContain("not found");
    });

    it("handles unexpected errors", async () => {
      mockReadManifest.mockRejectedValue(new Error("YAML broken"));

      const result = await server.call("bazdmeg_generate_package_json", {
        packageName: "pkg",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("YAML broken");
    });
  });

  describe("bazdmeg_publish_npm", () => {
    it("registers the tool", () => {
      expect(server.handlers.has("bazdmeg_publish_npm")).toBe(true);
    });

    it("dry run shows pipeline without publishing", async () => {
      mockRunCommand.mockResolvedValue(ok("build ok"));
      mockWriteFile.mockResolvedValue(undefined);

      const result = await server.call("bazdmeg_publish_npm", {
        packageName: "chess-engine",
        dryRun: true,
      });
      const text = result.content[0].text;
      expect(text).toContain("Publish Pipeline");
      expect(text).toContain("dry run");
      expect(text).toContain("Build");
      expect(text).toContain("PASS");
    });

    it("blocks on build failure", async () => {
      mockRunCommand.mockResolvedValue(fail("build failed"));

      const result = await server.call("bazdmeg_publish_npm", {
        packageName: "chess-engine",
        dryRun: true,
      });
      const text = result.content[0].text;
      expect(text).toContain("BLOCKED");
      expect(text).toContain("build");
    });

    it("returns error for unknown package", async () => {
      const result = await server.call("bazdmeg_publish_npm", {
        packageName: "nonexistent",
      });
      expect(result.content[0].text).toContain("ERROR");
    });

    it("publishes when dryRun=false", async () => {
      mockRunCommand.mockResolvedValue(ok("published"));
      mockWriteFile.mockResolvedValue(undefined);

      const result = await server.call("bazdmeg_publish_npm", {
        packageName: "shared",
        dryRun: false,
      });
      const text = result.content[0].text;
      expect(text).toContain("PUBLISHED");
    });

    it("reports publish failure", async () => {
      let callCount = 0;
      mockRunCommand.mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? ok() : fail("403 Forbidden");
      });
      mockWriteFile.mockResolvedValue(undefined);

      const result = await server.call("bazdmeg_publish_npm", {
        packageName: "shared",
        dryRun: false,
      });
      const text = result.content[0].text;
      expect(text).toContain("FAILED");
      expect(text).toContain("403 Forbidden");
    });

    it("handles unexpected errors", async () => {
      mockReadManifest.mockRejectedValue(new Error("IO error"));

      const result = await server.call("bazdmeg_publish_npm", {
        packageName: "pkg",
      });
      expect(result.isError).toBe(true);
    });
  });
});
