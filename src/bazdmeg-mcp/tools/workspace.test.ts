/**
 * Tests for workspace tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockServer } from "../__test-utils__/mock-server.js";
import { registerWorkspaceTools } from "./workspace.js";
import { resetWorkspaceState, getWorkspace, enterWorkspace } from "../workspace-state.js";
import { createFakeMonorepo } from "../__test-utils__/fixtures.js";
import { unlink } from "node:fs/promises";
import * as resolverModule from "../workspace-resolver.js";
import * as telemetryModule from "../telemetry.js";

describe("workspace tools", () => {
  let server: ReturnType<typeof createMockServer>;
  let cleanup: (() => Promise<void>) | undefined;

  beforeEach(() => {
    resetWorkspaceState();
    server = createMockServer();
    registerWorkspaceTools(server as unknown as McpServer);
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    resetWorkspaceState();
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
    try { await unlink("/tmp/bazdmeg-workspace.json"); } catch { /* ok */ }
    try { await unlink("/tmp/bazdmeg-telemetry.jsonl"); } catch { /* ok */ }
    try { await unlink("/tmp/bazdmeg-context-log.jsonl"); } catch { /* ok */ }
  });

  it("registers 3 workspace tools", () => {
    expect(server.handlers.has("bazdmeg_enter_workspace")).toBe(true);
    expect(server.handlers.has("bazdmeg_workspace_status")).toBe(true);
    expect(server.handlers.has("bazdmeg_exit_workspace")).toBe(true);
  });

  it("enter_workspace sets active workspace", async () => {
    const mono = await createFakeMonorepo([
      {
        name: "test-pkg",
        dependencies: { "@spike-land-ai/shared": "1.0.0" },
        claudeMd: "# Test\n",
      },
      { name: "shared" },
    ]);
    cleanup = mono.cleanup;

    const originalCwd = process.cwd;
    process.cwd = () => mono.root;

    try {
      const result = await server.call("bazdmeg_enter_workspace", { packageName: "test-pkg" });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Workspace entered: test-pkg");

      const workspace = getWorkspace();
      expect(workspace).not.toBeNull();
      expect(workspace!.packageName).toBe("test-pkg");
    } finally {
      process.cwd = originalCwd;
    }
  });

  it("workspace_status shows current state", async () => {
    const result = await server.call("bazdmeg_workspace_status", {});
    expect(result.content[0].text).toContain("No workspace active");
  });

  it("exit_workspace clears state", async () => {
    const result = await server.call("bazdmeg_exit_workspace", {});
    expect(result.content[0].text).toContain("No workspace was active");
  });

  it("workspace_status shows details when workspace active", async () => {
    const mono = await createFakeMonorepo([
      {
        name: "status-pkg",
        dependencies: { "@spike-land-ai/shared": "1.0.0" },
      },
      { name: "shared" },
    ]);
    cleanup = mono.cleanup;

    const originalCwd = process.cwd;
    process.cwd = () => mono.root;

    try {
      await server.call("bazdmeg_enter_workspace", { packageName: "status-pkg" });

      const result = await server.call("bazdmeg_workspace_status", {});
      const data = JSON.parse(result.content[0].text);
      expect(data.packageName).toBe("status-pkg");
    } finally {
      process.cwd = originalCwd;
    }
  });

  it("exit_workspace works after entering", async () => {
    const mono = await createFakeMonorepo([{ name: "exit-pkg" }]);
    cleanup = mono.cleanup;

    const originalCwd = process.cwd;
    process.cwd = () => mono.root;

    try {
      await server.call("bazdmeg_enter_workspace", { packageName: "exit-pkg" });
      const result = await server.call("bazdmeg_exit_workspace", {});
      expect(result.content[0].text).toContain("Workspace exited: exit-pkg");
    } finally {
      process.cwd = originalCwd;
    }
  });

  it("enter_workspace handles unexpected errors", async () => {
    vi.spyOn(resolverModule, "resolveWorkspacePaths").mockRejectedValue(new Error("Resolver crash"));
    const result = await server.call("bazdmeg_enter_workspace", { packageName: "p" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Resolver crash");
  });

  it("exit_workspace handles unexpected errors", async () => {
    await enterWorkspace({
      packageName: "p",
      packagePath: "p",
      allowedPaths: [],
      dependencies: [],
      enteredAt: "...",
    });
    vi.spyOn(telemetryModule, "logWorkspaceExit").mockRejectedValue(new Error("Exit crash"));
    const result = await server.call("bazdmeg_exit_workspace", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Exit crash");
  });
});
