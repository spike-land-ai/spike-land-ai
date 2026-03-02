/**
 * Tests for gates tools
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockServer } from "../__test-utils__/mock-server.js";
import { registerGatesTools } from "./gates.js";
import { resetWorkspaceState } from "../workspace-state.js";
import { buildDiff } from "../__test-utils__/fixtures.js";
import { unlink } from "node:fs/promises";

describe("gates tools", () => {
  let server: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    resetWorkspaceState();
    server = createMockServer();
    registerGatesTools(server as unknown as McpServer);
  });

  afterEach(async () => {
    resetWorkspaceState();
    try { await unlink("/tmp/bazdmeg-telemetry.jsonl"); } catch { /* ok */ }
  });

  it("registers 3 gates tools", () => {
    expect(server.handlers.has("bazdmeg_run_gates")).toBe(true);
    expect(server.handlers.has("bazdmeg_check_gate")).toBe(true);
    expect(server.handlers.has("bazdmeg_list_gates")).toBe(true);
  });

  it("run_gates returns formatted results", async () => {
    const diff = buildDiff([
      { path: "src/index.ts", added: ["const x: string = 'hello';"] },
      { path: "src/index.test.ts", added: ["it('works', () => {});"] },
    ]);

    const result = await server.call("bazdmeg_run_gates", {
      diff,
      prTitle: "Test PR",
      prBody: "This is a test PR with a detailed description of the changes made and why they were necessary.",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("BAZDMEG Quality Gates");
  });

  it("check_gate runs a single gate", async () => {
    const result = await server.call("bazdmeg_check_gate", {
      gateName: "Change Size",
      diff: "+small change",
    });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.name).toBe("Change Size");
    expect(parsed.status).toBe("GREEN");
  });

  it("check_gate reports unknown gate", async () => {
    const result = await server.call("bazdmeg_check_gate", {
      gateName: "NonExistent Gate",
    });

    expect(result.content[0].text).toContain("not found");
  });

  it("list_gates returns all gates", async () => {
    const result = await server.call("bazdmeg_list_gates", {});
    const list = JSON.parse(result.content[0].text);
    expect(list).toHaveLength(6);
    expect(list[0]).toHaveProperty("name");
    expect(list[0]).toHaveProperty("description");
    expect(list[0]).toHaveProperty("category");
  });

  it("check_gate without diff still works", async () => {
    const result = await server.call("bazdmeg_check_gate", {
      gateName: "Unit Tests Present",
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.name).toBe("Unit Tests Present");
  });

  it("run_gates without prTitle/prBody uses defaults", async () => {
    const diff = buildDiff([
      { path: "src/index.test.ts", added: ["it('works', () => {});"] },
    ]);
    const result = await server.call("bazdmeg_run_gates", { diff });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("BAZDMEG Quality Gates");
  });
});
