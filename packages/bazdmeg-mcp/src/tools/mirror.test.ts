/**
 * Tests for mirror tool (bazdmeg_sync_mirror)
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

import { runCommand } from "../shell.js";
import { getManifestPackage } from "../manifest.js";
import { registerMirrorTools } from "./mirror.js";

const mockRunCommand = vi.mocked(runCommand);
const mockGetManifestPackage = vi.mocked(getManifestPackage);

function ok(stdout = ""): { ok: true; stdout: string; stderr: string; code: 0 } {
  return { ok: true, stdout, stderr: "", code: 0 };
}

function fail(stderr = "error"): { ok: false; stdout: string; stderr: string; code: 1 } {
  return { ok: false, stdout: "", stderr, code: 1 };
}

const MIRROR_PKG = {
  kind: "library",
  version: "1.0.0",
  description: "Chess engine",
  entry: "src/index.ts",
  mirror: "git@github.com:spike-land-ai/chess-engine.git",
};

describe("mirror tools", () => {
  let server: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    server = createMockServer();
    registerMirrorTools(server as unknown as McpServer);
    vi.clearAllMocks();
  });

  it("registers the sync_mirror tool", () => {
    expect(server.handlers.has("bazdmeg_sync_mirror")).toBe(true);
  });

  it("dry run shows plan without syncing", async () => {
    mockGetManifestPackage.mockResolvedValue(MIRROR_PKG as ReturnType<typeof getManifestPackage> extends Promise<infer T> ? T : never);

    const result = await server.call("bazdmeg_sync_mirror", {
      packageName: "chess-engine",
      dryRun: true,
    });
    const text = result.content[0].text;
    expect(text).toContain("Mirror Sync");
    expect(text).toContain("chess-engine");
    expect(text).toContain("dry run");
    expect(text).toContain("git@github.com");
    expect(text).toContain("No changes made");
  });

  it("syncs to mirror when dryRun=false (new remote)", async () => {
    mockGetManifestPackage.mockResolvedValue(MIRROR_PKG as ReturnType<typeof getManifestPackage> extends Promise<infer T> ? T : never);
    mockRunCommand.mockImplementation(async (_cmd, args) => {
      if (args[0] === "remote" && args[1] === "get-url") return fail("not found");
      if (args[0] === "remote" && args[1] === "add") return ok();
      if (args[0] === "subtree") return ok("pushed");
      return ok();
    });

    const result = await server.call("bazdmeg_sync_mirror", {
      packageName: "chess-engine",
      dryRun: false,
    });
    const text = result.content[0].text;
    expect(text).toContain("Adding remote");
    expect(text).toContain("SYNCED");
  });

  it("syncs to mirror when remote already exists", async () => {
    mockGetManifestPackage.mockResolvedValue(MIRROR_PKG as ReturnType<typeof getManifestPackage> extends Promise<infer T> ? T : never);
    mockRunCommand.mockImplementation(async (_cmd, args) => {
      if (args[0] === "remote" && args[1] === "get-url") return ok("git@github.com:org/repo.git");
      if (args[0] === "subtree") return ok("pushed");
      return ok();
    });

    const result = await server.call("bazdmeg_sync_mirror", {
      packageName: "chess-engine",
      dryRun: false,
    });
    const text = result.content[0].text;
    expect(text).toContain("already configured");
    expect(text).toContain("SYNCED");
  });

  it("reports push failure", async () => {
    mockGetManifestPackage.mockResolvedValue(MIRROR_PKG as ReturnType<typeof getManifestPackage> extends Promise<infer T> ? T : never);
    mockRunCommand.mockImplementation(async (_cmd, args) => {
      if (args[0] === "remote") return ok("url");
      if (args[0] === "subtree") return fail("push rejected");
      return ok();
    });

    const result = await server.call("bazdmeg_sync_mirror", {
      packageName: "chess-engine",
      dryRun: false,
    });
    expect(result.content[0].text).toContain("FAILED");
    expect(result.content[0].text).toContain("push rejected");
  });

  it("reports add-remote failure", async () => {
    mockGetManifestPackage.mockResolvedValue(MIRROR_PKG as ReturnType<typeof getManifestPackage> extends Promise<infer T> ? T : never);
    mockRunCommand.mockImplementation(async (_cmd, args) => {
      if (args[0] === "remote" && args[1] === "get-url") return fail("no remote");
      if (args[0] === "remote" && args[1] === "add") return fail("remote add failed");
      return ok();
    });

    const result = await server.call("bazdmeg_sync_mirror", {
      packageName: "chess-engine",
      dryRun: false,
    });
    expect(result.content[0].text).toContain("FAILED");
    expect(result.content[0].text).toContain("remote add failed");
  });

  it("errors when package not found", async () => {
    mockGetManifestPackage.mockResolvedValue(null);

    const result = await server.call("bazdmeg_sync_mirror", {
      packageName: "nope",
    });
    expect(result.content[0].text).toContain("ERROR");
    expect(result.content[0].text).toContain("not found");
  });

  it("errors when package has no mirror field", async () => {
    mockGetManifestPackage.mockResolvedValue({
      kind: "library",
      version: "1.0.0",
      description: "test",
      entry: "src/index.ts",
    });

    const result = await server.call("bazdmeg_sync_mirror", {
      packageName: "shared",
    });
    expect(result.content[0].text).toContain("ERROR");
    expect(result.content[0].text).toContain("mirror");
  });

  it("handles unexpected errors", async () => {
    mockGetManifestPackage.mockRejectedValue(new Error("network error"));

    const result = await server.call("bazdmeg_sync_mirror", {
      packageName: "pkg",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("network error");
  });
});
