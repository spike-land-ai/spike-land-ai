/**
 * Tests for context tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockServer } from "../__test-utils__/mock-server.js";
import { registerContextTools } from "./context.js";
import { resetWorkspaceState, enterWorkspace } from "../workspace-state.js";
import { createFakeMonorepo } from "../__test-utils__/fixtures.js";
import { unlink } from "node:fs/promises";
import * as bundleModule from "../context-bundle.js";
import * as telemetryModule from "../telemetry.js";

describe("context tools", () => {
  let server: ReturnType<typeof createMockServer>;
  let cleanup: (() => Promise<void>) | undefined;

  beforeEach(() => {
    resetWorkspaceState();
    server = createMockServer();
    registerContextTools(server as unknown as McpServer);
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

  it("registers 3 context tools", () => {
    expect(server.handlers.has("bazdmeg_get_context")).toBe(true);
    expect(server.handlers.has("bazdmeg_report_context_gap")).toBe(true);
    expect(server.handlers.has("bazdmeg_review_session")).toBe(true);
  });

  it("get_context requires active workspace", async () => {
    const result = await server.call("bazdmeg_get_context", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No workspace active");
  });

  it("get_context returns bundle when workspace active", async () => {
    const mono = await createFakeMonorepo([
      {
        name: "ctx-pkg",
        claudeMd: "# Context Package\nProvides context.\n",
        srcFiles: { "types.ts": "export interface Widget { id: string; }\n" },
      },
    ]);
    cleanup = mono.cleanup;

    const originalCwd = process.cwd;
    process.cwd = () => mono.root;

    try {
      await enterWorkspace({
        packageName: "ctx-pkg",
        packagePath: "packages/ctx-pkg/",
        allowedPaths: ["packages/ctx-pkg/"],
        dependencies: [],
        enteredAt: new Date().toISOString(),
      });

      const result = await server.call("bazdmeg_get_context", {});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Context Bundle: ctx-pkg");
      expect(result.content[0].text).toContain("Widget");
    } finally {
      process.cwd = originalCwd;
    }
  });

  it("get_context handles unexpected errors", async () => {
    await enterWorkspace({
      packageName: "err-pkg",
      packagePath: "packages/err-pkg/",
      allowedPaths: [],
      dependencies: [],
      enteredAt: new Date().toISOString(),
    });

    vi.spyOn(bundleModule, "buildContextBundle").mockRejectedValue(new Error("Bundle crash"));

    const result = await server.call("bazdmeg_get_context", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Bundle crash");
  });

  it("report_context_gap records gap", async () => {
    const result = await server.call("bazdmeg_report_context_gap", {
      missingContext: "ELO formula",
      whatWasNeeded: "Calculate ratings",
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Context gap recorded");
    expect(result.content[0].text).toContain("ELO formula");
  });

  it("report_context_gap handles unexpected errors", async () => {
    vi.spyOn(telemetryModule, "logContextGap").mockRejectedValue(new Error("Telemetry crash"));

    const result = await server.call("bazdmeg_report_context_gap", {
      missingContext: "m",
      whatWasNeeded: "w",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Telemetry crash");
  });

  it("review_session returns suggestions", async () => {
    const result = await server.call("bazdmeg_review_session", {});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Session Review");
    expect(result.content[0].text).toContain("No workspace was active");
  });

  it("review_session with active workspace", async () => {
    await enterWorkspace({
      packageName: "review-pkg",
      packagePath: "packages/review-pkg/",
      allowedPaths: ["packages/review-pkg/"],
      dependencies: [],
      enteredAt: new Date().toISOString(),
    });

    const result = await server.call("bazdmeg_review_session", {});
    expect(result.content[0].text).toContain("review-pkg");
  });

  it("report_context_gap without workspace", async () => {
    const result = await server.call("bazdmeg_report_context_gap", {
      missingContext: "API docs",
      whatWasNeeded: "Call the API",
    });
    expect(result.content[0].text).toContain("Workspace: none");
  });
});
