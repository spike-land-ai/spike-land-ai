/**
 * Tests for ship tool (bazdmeg_auto_ship)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockServer } from "../__test-utils__/mock-server.js";
import { resetWorkspaceState, enterWorkspace } from "../workspace-state.js";
import { unlink } from "node:fs/promises";

// Mock the shell module
vi.mock("../shell.js", () => ({
  runCommand: vi.fn(),
  hasScript: vi.fn(),
}));

import { runCommand, hasScript } from "../shell.js";
import { registerShipTools } from "./ship.js";

const mockRunCommand = vi.mocked(runCommand);
const mockHasScript = vi.mocked(hasScript);

function ok(stdout = ""): { ok: true; stdout: string; stderr: string; code: 0 } {
  return { ok: true, stdout, stderr: "", code: 0 };
}

function fail(stderr = "error"): { ok: false; stdout: string; stderr: string; code: 1 } {
  return { ok: false, stdout: "", stderr, code: 1 };
}

describe("ship tool", () => {
  let server: ReturnType<typeof createMockServer>;

  beforeEach(async () => {
    resetWorkspaceState();
    server = createMockServer();
    registerShipTools(server as unknown as McpServer);

    await enterWorkspace({
      packageName: "chess-engine",
      packagePath: "packages/chess-engine/",
      allowedPaths: ["packages/chess-engine/"],
      dependencies: [],
      enteredAt: new Date().toISOString(),
    });

    vi.clearAllMocks();
  });

  afterEach(async () => {
    resetWorkspaceState();
    try { await unlink("/tmp/bazdmeg-workspace.json"); } catch { /* ok */ }
  });

  it("registers the auto_ship tool", () => {
    expect(server.handlers.has("bazdmeg_auto_ship")).toBe(true);
  });

  it("aborts when no workspace and no packageName", async () => {
    resetWorkspaceState();
    const result = await server.call("bazdmeg_auto_ship", {});
    expect(result.content[0].text).toContain("ERROR");
    expect(result.content[0].text).toContain("No active workspace");
  });

  it("happy path: dry run passes all checks", async () => {
    mockHasScript.mockResolvedValue(true);
    mockRunCommand.mockImplementation(async (_cmd, args) => {
      if (args[0] === "diff") {
        return ok("diff --git a/packages/chess-engine/src/index.ts b/packages/chess-engine/src/index.ts\n+++ b/packages/chess-engine/src/index.ts\n+const x: string = 'hello';\ndiff --git a/packages/chess-engine/src/index.test.ts b/packages/chess-engine/src/index.test.ts\n+++ b/packages/chess-engine/src/index.test.ts\n+it('works', () => {});");
      }
      return ok();
    });

    const result = await server.call("bazdmeg_auto_ship", { dryRun: true });
    const text = result.content[0].text;
    expect(text).toContain("Auto-Ship Report");
    expect(text).toContain("DRY RUN");
    expect(text).not.toContain("BLOCKED");
  });

  it("fails fast on lint failure", async () => {
    mockHasScript.mockResolvedValue(true);
    mockRunCommand.mockResolvedValue(fail("ESLint found errors"));

    const result = await server.call("bazdmeg_auto_ship", { dryRun: true });
    const text = result.content[0].text;
    expect(text).toContain("BLOCKED");
    expect(text).toContain("lint");
    // Should not have reached typecheck or test
    expect(text).not.toContain("typecheck");
  });

  it("fails fast on typecheck failure", async () => {
    mockHasScript.mockResolvedValue(true);
    let callCount = 0;
    mockRunCommand.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return ok(); // lint passes
      return fail("TS2322: Type error");
    });

    const result = await server.call("bazdmeg_auto_ship", { dryRun: true });
    const text = result.content[0].text;
    expect(text).toContain("BLOCKED");
    expect(text).toContain("typecheck");
  });

  it("fails fast on test failure", async () => {
    mockHasScript.mockResolvedValue(true);
    let callCount = 0;
    mockRunCommand.mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) return ok(); // lint + typecheck pass
      return fail("FAIL src/index.test.ts");
    });

    const result = await server.call("bazdmeg_auto_ship", { dryRun: true });
    const text = result.content[0].text;
    expect(text).toContain("BLOCKED");
    expect(text).toContain("test");
  });

  it("fails on RED quality gates", async () => {
    mockHasScript.mockResolvedValue(true);
    mockRunCommand.mockImplementation(async (_cmd, args) => {
      if (args[0] === "diff") {
        // Diff with `any` type — will trigger TypeScript Strict gate
        return ok("diff --git a/packages/chess-engine/src/bad.ts b/packages/chess-engine/src/bad.ts\n+++ b/packages/chess-engine/src/bad.ts\n+const x: any = 'bad';");
      }
      return ok();
    });

    const result = await server.call("bazdmeg_auto_ship", { dryRun: true });
    const text = result.content[0].text;
    expect(text).toContain("BLOCKED");
    expect(text).toContain("gates");
  });

  it("skips scripts that don't exist in package.json", async () => {
    mockHasScript.mockImplementation(async (_dir, script) => {
      return script === "lint" || script === "test"; // no typecheck
    });
    mockRunCommand.mockImplementation(async (_cmd, args) => {
      if (args[0] === "diff") {
        return ok("diff --git a/packages/chess-engine/src/index.ts b/packages/chess-engine/src/index.ts\n+++ b/packages/chess-engine/src/index.ts\n+const x: string = 'hello';\ndiff --git a/packages/chess-engine/src/index.test.ts b/packages/chess-engine/src/index.test.ts\n+++ b/packages/chess-engine/src/index.test.ts\n+it('works', () => {});");
      }
      return ok();
    });

    const result = await server.call("bazdmeg_auto_ship", { dryRun: true });
    const text = result.content[0].text;
    expect(text).toContain("typecheck");
    expect(text).toContain("skip");
    expect(text).toContain("DRY RUN");
  });

  it("reports no changes when diff is empty", async () => {
    mockHasScript.mockResolvedValue(true);
    mockRunCommand.mockImplementation(async (_cmd, args) => {
      if (args[0] === "diff") return ok(""); // empty diff
      return ok();
    });

    const result = await server.call("bazdmeg_auto_ship", { dryRun: true });
    const text = result.content[0].text;
    expect(text).toContain("No changes to ship");
  });

  it("uses explicit packageName over workspace", async () => {
    mockHasScript.mockResolvedValue(true);
    mockRunCommand.mockImplementation(async (_cmd, args) => {
      if (args[0] === "diff") {
        return ok("diff --git a/packages/state-machine/src/index.ts b/packages/state-machine/src/index.ts\n+++ b/packages/state-machine/src/index.ts\n+export {};\ndiff --git a/packages/state-machine/src/index.test.ts b/packages/state-machine/src/index.test.ts\n+++ b/packages/state-machine/src/index.test.ts\n+it('ok', () => {});");
      }
      return ok();
    });

    const result = await server.call("bazdmeg_auto_ship", {
      packageName: "state-machine",
      dryRun: true,
    });
    const text = result.content[0].text;
    expect(text).toContain("state-machine");
  });

  it("skips push when push=false", async () => {
    mockHasScript.mockResolvedValue(true);
    mockRunCommand.mockImplementation(async (_cmd, args) => {
      if (args[0] === "diff") {
        return ok("diff --git a/packages/chess-engine/src/index.ts b/packages/chess-engine/src/index.ts\n+++ b/packages/chess-engine/src/index.ts\n+const x: string = 'hello';\ndiff --git a/packages/chess-engine/src/index.test.ts b/packages/chess-engine/src/index.test.ts\n+++ b/packages/chess-engine/src/index.test.ts\n+it('works', () => {});");
      }
      return ok();
    });

    const result = await server.call("bazdmeg_auto_ship", { push: false });
    const text = result.content[0].text;
    expect(text).toContain("push");
    expect(text).toContain("Push disabled");
  });

  it("reports commit failure", async () => {
    mockHasScript.mockResolvedValue(true);
    let diffCalled = false;
    mockRunCommand.mockImplementation(async (_cmd, args) => {
      if (args[0] === "diff") {
        diffCalled = true;
        return ok("diff --git a/packages/chess-engine/src/index.ts b/packages/chess-engine/src/index.ts\n+++ b/packages/chess-engine/src/index.ts\n+const x: string = 'hello';\ndiff --git a/packages/chess-engine/src/index.test.ts b/packages/chess-engine/src/index.test.ts\n+++ b/packages/chess-engine/src/index.test.ts\n+it('works', () => {});");
      }
      if (diffCalled && args[0] === "commit") {
        return fail("nothing to commit");
      }
      return ok();
    });

    const result = await server.call("bazdmeg_auto_ship", {});
    const text = result.content[0].text;
    expect(text).toContain("BLOCKED");
    expect(text).toContain("commit");
  });

  it("uses custom commit message", async () => {
    mockHasScript.mockResolvedValue(true);
    const commitArgs: string[][] = [];
    mockRunCommand.mockImplementation(async (_cmd, args) => {
      if (args[0] === "diff") {
        return ok("diff --git a/packages/chess-engine/src/index.ts b/packages/chess-engine/src/index.ts\n+++ b/packages/chess-engine/src/index.ts\n+const x: string = 'hello';\ndiff --git a/packages/chess-engine/src/index.test.ts b/packages/chess-engine/src/index.test.ts\n+++ b/packages/chess-engine/src/index.test.ts\n+it('works', () => {});");
      }
      if (args[0] === "commit") commitArgs.push([...args]);
      return ok();
    });

    await server.call("bazdmeg_auto_ship", {
      commitMessage: "feat(chess): add castling",
      push: false,
    });
    expect(commitArgs[0]).toContain("feat(chess): add castling");
  });

  it("reports git add failure", async () => {
    mockHasScript.mockResolvedValue(true);
    mockRunCommand.mockImplementation(async (_cmd, args) => {
      if (args[0] === "diff") return ok("diff...");
      if (args[0] === "add") return fail("permission denied");
      return ok();
    });

    const result = await server.call("bazdmeg_auto_ship", { push: false });
    expect(result.content[0].text).toContain("git add failed");
  });

  it("reports git push failure", async () => {
    mockHasScript.mockResolvedValue(true);
    mockRunCommand.mockImplementation(async (_cmd, args) => {
      if (args[0] === "diff") return ok("diff...");
      if (args[0] === "push") return fail("remote rejected");
      return ok();
    });

    const result = await server.call("bazdmeg_auto_ship", { push: true });
    expect(result.content[0].text).toContain("remote rejected");
  });

  it("handles unexpected exceptions", async () => {
    mockHasScript.mockRejectedValue(new Error("Unexpected crash"));
    
    const result = await server.call("bazdmeg_auto_ship", { packageName: "p" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unexpected crash");
  });
});
