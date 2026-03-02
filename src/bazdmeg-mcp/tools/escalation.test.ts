/**
 * Tests for escalation tools
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile, unlink } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockServer } from "../__test-utils__/mock-server.js";
import { registerEscalationTools } from "./escalation.js";
import { resetWorkspaceState, enterWorkspace } from "../workspace-state.js";

describe("escalation tools", () => {
  let server: ReturnType<typeof createMockServer>;
  const stuckFiles: string[] = [];

  beforeEach(() => {
    resetWorkspaceState();
    server = createMockServer();
    registerEscalationTools(server as unknown as McpServer);
  });

  afterEach(async () => {
    resetWorkspaceState();
    try { await unlink("/tmp/bazdmeg-workspace.json"); } catch { /* ok */ }
    try { await unlink("/tmp/bazdmeg-telemetry.jsonl"); } catch { /* ok */ }
    // Clean up stuck signal files
    try {
      const tmpFiles = await readdir("/tmp");
      for (const f of tmpFiles) {
        if (f.startsWith("bazdmeg-stuck-")) {
          await unlink(`/tmp/${f}`);
        }
      }
    } catch { /* ok */ }
  });

  it("registers signal_stuck tool", () => {
    expect(server.handlers.has("bazdmeg_signal_stuck")).toBe(true);
  });

  it("signal_stuck creates file and returns suggestions", async () => {
    const result = await server.call("bazdmeg_signal_stuck", {
      reason: "Cannot find ELO formula",
      attemptedAction: "Tried reading chess-engine/src/elo.ts",
      suggestedContext: "Need math utilities",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Stuck Signal Recorded");
    expect(result.content[0].text).toContain("Cannot find ELO formula");
    expect(result.content[0].text).toContain("Need math utilities");

    // Verify stuck file was created
    const tmpFiles = await readdir("/tmp");
    const stuckFile = tmpFiles.find((f) => f.startsWith("bazdmeg-stuck-"));
    expect(stuckFile).toBeDefined();

    const content = await readFile(`/tmp/${stuckFile}`, "utf-8");
    const signal = JSON.parse(content);
    expect(signal.reason).toBe("Cannot find ELO formula");
    expect(signal.attemptedAction).toBe("Tried reading chess-engine/src/elo.ts");
  });

  it("signal_stuck includes workspace context when active", async () => {
    await enterWorkspace({
      packageName: "chess-engine",
      packagePath: "packages/chess-engine/",
      allowedPaths: ["packages/chess-engine/", "packages/shared/"],
      dependencies: ["@spike-land-ai/shared"],
      enteredAt: new Date().toISOString(),
    });

    const result = await server.call("bazdmeg_signal_stuck", {
      reason: "Missing type definition",
      attemptedAction: "Tried to import GameState",
    });

    expect(result.content[0].text).toContain("chess-engine");

    // Check file has workspace info
    const tmpFiles = await readdir("/tmp");
    const stuckFile = tmpFiles.find((f) => f.startsWith("bazdmeg-stuck-"));
    const content = await readFile(`/tmp/${stuckFile}`, "utf-8");
    const signal = JSON.parse(content);
    expect(signal.packageName).toBe("chess-engine");
    expect(signal.allowedPaths).toContain("packages/chess-engine/");
  });
});
