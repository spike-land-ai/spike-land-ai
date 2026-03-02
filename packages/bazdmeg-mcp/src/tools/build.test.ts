/**
 * Tests for build tools (bazdmeg_build, bazdmeg_typecheck)
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

import { runCommand, hasScript } from "../shell.js";
import { getManifestPackage, readManifest } from "../manifest.js";
import { registerBuildTools } from "./build.js";

const mockRunCommand = vi.mocked(runCommand);
const mockHasScript = vi.mocked(hasScript);
const mockGetManifestPackage = vi.mocked(getManifestPackage);
const mockReadManifest = vi.mocked(readManifest);

function ok(stdout = ""): { ok: true; stdout: string; stderr: string; code: 0 } {
  return { ok: true, stdout, stderr: "", code: 0 };
}

function fail(stderr = "error"): { ok: false; stdout: string; stderr: string; code: 1 } {
  return { ok: false, stdout: "", stderr, code: 1 };
}

describe("build tools", () => {
  let server: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    server = createMockServer();
    registerBuildTools(server as unknown as McpServer);
    vi.clearAllMocks();
  });

  describe("bazdmeg_build", () => {
    it("registers the build tool", () => {
      expect(server.handlers.has("bazdmeg_build")).toBe(true);
    });

    it("builds using package build script when available", async () => {
      mockGetManifestPackage.mockResolvedValue({
        kind: "library",
        version: "1.0.0",
        description: "test",
        entry: "src/index.ts",
      });
      mockHasScript.mockResolvedValue(true);
      mockRunCommand.mockResolvedValue(ok("Build complete"));

      const result = await server.call("bazdmeg_build", { packageName: "chess-engine" });
      const text = result.content[0].text;
      expect(text).toContain("Build Report");
      expect(text).toContain("chess-engine");
      expect(text).toContain("SUCCESS");
    });

    it("uses esbuild config when no build script", async () => {
      mockGetManifestPackage.mockResolvedValue({
        kind: "library",
        version: "1.0.0",
        description: "test",
        entry: "src/index.ts",
      });
      mockHasScript.mockResolvedValue(false);
      mockRunCommand.mockResolvedValue(ok("esbuild done"));

      const result = await server.call("bazdmeg_build", { packageName: "shared" });
      const text = result.content[0].text;
      expect(text).toContain("esbuild config");
      expect(text).toContain("SUCCESS");
    });

    it("reports build failure", async () => {
      mockGetManifestPackage.mockResolvedValue({
        kind: "library",
        version: "1.0.0",
        description: "test",
        entry: "src/index.ts",
      });
      mockHasScript.mockResolvedValue(true);
      mockRunCommand.mockResolvedValue(fail("compilation error"));

      const result = await server.call("bazdmeg_build", { packageName: "broken" });
      const text = result.content[0].text;
      expect(text).toContain("FAILED");
      expect(text).toContain("compilation error");
    });

    it("uses kind override", async () => {
      mockGetManifestPackage.mockResolvedValue({
        kind: "library",
        version: "1.0.0",
        description: "test",
        entry: "src/index.ts",
      });
      mockHasScript.mockResolvedValue(true);
      mockRunCommand.mockResolvedValue(ok());

      const result = await server.call("bazdmeg_build", {
        packageName: "pkg",
        kind: "worker",
      });
      expect(result.content[0].text).toContain("worker");
    });

    it("handles missing manifest entry", async () => {
      mockGetManifestPackage.mockResolvedValue(null);
      mockHasScript.mockResolvedValue(true);
      mockRunCommand.mockResolvedValue(ok());

      const result = await server.call("bazdmeg_build", { packageName: "unknown" });
      // Should still work with default kind
      expect(result.content[0].text).toContain("library");
    });

    it("handles unexpected errors", async () => {
      mockGetManifestPackage.mockRejectedValue(new Error("YAML parse error"));

      const result = await server.call("bazdmeg_build", { packageName: "pkg" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("YAML parse error");
    });
  });

  describe("bazdmeg_typecheck", () => {
    it("registers the typecheck tool", () => {
      expect(server.handlers.has("bazdmeg_typecheck")).toBe(true);
    });

    it("typechecks a single package with script", async () => {
      mockHasScript.mockResolvedValue(true);
      mockRunCommand.mockResolvedValue(ok());

      const result = await server.call("bazdmeg_typecheck", { packageName: "chess-engine" });
      const text = result.content[0].text;
      expect(text).toContain("Typecheck Report");
      expect(text).toContain("chess-engine");
      expect(text).toContain("PASS");
    });

    it("falls back to direct tsc when no typecheck script", async () => {
      mockHasScript.mockResolvedValue(false);
      mockRunCommand.mockResolvedValue(ok());

      const result = await server.call("bazdmeg_typecheck", { packageName: "pkg" });
      expect(result.content[0].text).toContain("direct tsc");
    });

    it("reports typecheck failure", async () => {
      mockHasScript.mockResolvedValue(true);
      mockRunCommand.mockResolvedValue(fail("TS2322: Type error"));

      const result = await server.call("bazdmeg_typecheck", { packageName: "bad" });
      expect(result.content[0].text).toContain("FAIL");
      expect(result.content[0].text).toContain("TS2322");
    });

    it("typechecks all packages when no packageName", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: { scope: "@spike-land-ai", registry: "npm.pkg.github.com", license: "MIT", type: "module" },
        packages: {
          "pkg-a": { kind: "library", version: "1.0.0", description: "a", entry: "src/index.ts" },
          "pkg-b": { kind: "library", version: "1.0.0", description: "b", entry: "src/index.ts" },
        },
      });
      mockHasScript.mockResolvedValue(true);
      mockRunCommand.mockResolvedValue(ok());

      const result = await server.call("bazdmeg_typecheck", {});
      const text = result.content[0].text;
      expect(text).toContain("All Packages");
      expect(text).toContain("pkg-a");
      expect(text).toContain("pkg-b");
      expect(text).toContain("ALL PASSED");
    });

    it("reports partial failure in all-packages mode", async () => {
      mockReadManifest.mockResolvedValue({
        defaults: { scope: "@spike-land-ai", registry: "npm.pkg.github.com", license: "MIT", type: "module" },
        packages: {
          "pkg-a": { kind: "library", version: "1.0.0", description: "a", entry: "src/index.ts" },
          "pkg-b": { kind: "library", version: "1.0.0", description: "b", entry: "src/index.ts" },
        },
      });
      mockHasScript.mockResolvedValue(true);
      let callCount = 0;
      mockRunCommand.mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? ok() : fail("error");
      });

      const result = await server.call("bazdmeg_typecheck", {});
      expect(result.content[0].text).toContain("SOME FAILED");
    });

    it("handles unexpected errors", async () => {
      mockHasScript.mockRejectedValue(new Error("IO error"));

      const result = await server.call("bazdmeg_typecheck", { packageName: "pkg" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("IO error");
    });
  });
});
