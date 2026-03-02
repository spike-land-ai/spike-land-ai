/**
 * Tests for deploy tools (bazdmeg_generate_wrangler_toml, bazdmeg_deploy_worker)
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
import { getManifestPackage } from "../manifest.js";
import { writeFile } from "node:fs/promises";
import { registerDeployTools } from "./deploy.js";

const mockRunCommand = vi.mocked(runCommand);
const mockGetManifestPackage = vi.mocked(getManifestPackage);
const mockWriteFile = vi.mocked(writeFile);

function ok(stdout = ""): { ok: true; stdout: string; stderr: string; code: 0 } {
  return { ok: true, stdout, stderr: "", code: 0 };
}

function fail(stderr = "error"): { ok: false; stdout: string; stderr: string; code: 1 } {
  return { ok: false, stdout: "", stderr, code: 1 };
}

const WORKER_PKG = {
  kind: "worker",
  version: "1.0.0",
  description: "Edge worker",
  entry: "src/index.ts",
  worker: {
    name: "spike-edge",
    compatibility_date: "2024-01-01",
    compatibility_flags: ["nodejs_compat"],
    kv_namespaces: [{ binding: "KV", id: "abc123" }],
    d1_databases: [{ binding: "DB", database_name: "mydb", database_id: "db123" }],
    r2_buckets: [{ binding: "BUCKET", bucket_name: "files" }],
    durable_objects: [{ name: "ROOM", class_name: "ChatRoom", sqlite: true }],
    routes: [{ pattern: "api.example.com/*", zone_name: "example.com" }],
  },
};

describe("deploy tools", () => {
  let server: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    server = createMockServer();
    registerDeployTools(server as unknown as McpServer);
    vi.clearAllMocks();
  });

  describe("bazdmeg_generate_wrangler_toml", () => {
    it("registers the tool", () => {
      expect(server.handlers.has("bazdmeg_generate_wrangler_toml")).toBe(true);
    });

    it("generates wrangler.toml (dry run)", async () => {
      mockGetManifestPackage.mockResolvedValue(WORKER_PKG as ReturnType<typeof getManifestPackage> extends Promise<infer T> ? T : never);

      const result = await server.call("bazdmeg_generate_wrangler_toml", {
        packageName: "spike-edge",
      });
      const text = result.content[0].text;
      expect(text).toContain("dry run");
      expect(text).toContain('name = "spike-edge"');
      expect(text).toContain("compatibility_date");
      expect(text).toContain("nodejs_compat");
      expect(text).toContain("kv_namespaces");
      expect(text).toContain("d1_databases");
      expect(text).toContain("r2_buckets");
      expect(text).toContain("durable_objects");
      expect(text).toContain("ChatRoom");
      expect(text).toContain("routes");
    });

    it("writes to disk when dryRun=false", async () => {
      mockGetManifestPackage.mockResolvedValue(WORKER_PKG as ReturnType<typeof getManifestPackage> extends Promise<infer T> ? T : never);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await server.call("bazdmeg_generate_wrangler_toml", {
        packageName: "spike-edge",
        dryRun: false,
      });
      expect(result.content[0].text).toContain("Written to");
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it("errors when package not found", async () => {
      mockGetManifestPackage.mockResolvedValue(null);

      const result = await server.call("bazdmeg_generate_wrangler_toml", {
        packageName: "nope",
      });
      expect(result.content[0].text).toContain("ERROR");
      expect(result.content[0].text).toContain("not found");
    });

    it("errors when package has no worker section", async () => {
      mockGetManifestPackage.mockResolvedValue({
        kind: "library",
        version: "1.0.0",
        description: "test",
        entry: "src/index.ts",
      });

      const result = await server.call("bazdmeg_generate_wrangler_toml", {
        packageName: "shared",
      });
      expect(result.content[0].text).toContain("ERROR");
      expect(result.content[0].text).toContain("worker");
    });

    it("handles unexpected errors", async () => {
      mockGetManifestPackage.mockRejectedValue(new Error("disk fail"));

      const result = await server.call("bazdmeg_generate_wrangler_toml", {
        packageName: "pkg",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("bazdmeg_deploy_worker", () => {
    it("registers the tool", () => {
      expect(server.handlers.has("bazdmeg_deploy_worker")).toBe(true);
    });

    it("dry run shows pipeline without deploying", async () => {
      mockGetManifestPackage.mockResolvedValue(WORKER_PKG as ReturnType<typeof getManifestPackage> extends Promise<infer T> ? T : never);
      mockRunCommand.mockResolvedValue(ok());
      mockWriteFile.mockResolvedValue(undefined);

      const result = await server.call("bazdmeg_deploy_worker", {
        packageName: "spike-edge",
        dryRun: true,
      });
      const text = result.content[0].text;
      expect(text).toContain("Deploy Pipeline");
      expect(text).toContain("Dry Run");
      expect(text).toContain("skipped");
    });

    it("blocks on build failure", async () => {
      mockGetManifestPackage.mockResolvedValue(WORKER_PKG as ReturnType<typeof getManifestPackage> extends Promise<infer T> ? T : never);
      mockRunCommand.mockResolvedValue(fail("build error"));

      const result = await server.call("bazdmeg_deploy_worker", {
        packageName: "spike-edge",
        dryRun: true,
      });
      expect(result.content[0].text).toContain("BLOCKED");
    });

    it("deploys when dryRun=false", async () => {
      mockGetManifestPackage.mockResolvedValue(WORKER_PKG as ReturnType<typeof getManifestPackage> extends Promise<infer T> ? T : never);
      mockRunCommand.mockResolvedValue(ok("deploy success"));
      mockWriteFile.mockResolvedValue(undefined);

      const result = await server.call("bazdmeg_deploy_worker", {
        packageName: "spike-edge",
        dryRun: false,
      });
      expect(result.content[0].text).toContain("DEPLOYED");
    });

    it("reports deploy failure", async () => {
      mockGetManifestPackage.mockResolvedValue(WORKER_PKG as ReturnType<typeof getManifestPackage> extends Promise<infer T> ? T : never);
      let callCount = 0;
      mockRunCommand.mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? ok() : fail("wrangler error");
      });
      mockWriteFile.mockResolvedValue(undefined);

      const result = await server.call("bazdmeg_deploy_worker", {
        packageName: "spike-edge",
        dryRun: false,
      });
      expect(result.content[0].text).toContain("FAILED");
      expect(result.content[0].text).toContain("wrangler error");
    });

    it("passes env flag when specified", async () => {
      mockGetManifestPackage.mockResolvedValue(WORKER_PKG as ReturnType<typeof getManifestPackage> extends Promise<infer T> ? T : never);
      mockRunCommand.mockResolvedValue(ok());
      mockWriteFile.mockResolvedValue(undefined);

      const result = await server.call("bazdmeg_deploy_worker", {
        packageName: "spike-edge",
        env: "staging",
        dryRun: true,
      });
      expect(result.content[0].text).toContain("staging");
    });

    it("errors when package not found", async () => {
      mockGetManifestPackage.mockResolvedValue(null);

      const result = await server.call("bazdmeg_deploy_worker", {
        packageName: "nope",
      });
      expect(result.content[0].text).toContain("ERROR");
    });

    it("errors when package has no worker section", async () => {
      mockGetManifestPackage.mockResolvedValue({
        kind: "library",
        version: "1.0.0",
        description: "test",
        entry: "src/index.ts",
      });

      const result = await server.call("bazdmeg_deploy_worker", {
        packageName: "shared",
      });
      expect(result.content[0].text).toContain("ERROR");
    });

    it("handles unexpected errors", async () => {
      mockGetManifestPackage.mockRejectedValue(new Error("crash"));

      const result = await server.call("bazdmeg_deploy_worker", {
        packageName: "pkg",
      });
      expect(result.isError).toBe(true);
    });
  });
});
