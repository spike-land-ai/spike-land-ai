/**
 * Tests for telemetry.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFile, unlink, appendFile, writeFile } from "node:fs/promises";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    appendFile: vi.fn(actual.appendFile),
    writeFile: vi.fn(actual.writeFile),
    unlink: vi.fn(actual.unlink),
    readFile: actual.readFile,
  };
});

import {
  logEvent,
  logToolCall,
  logWorkspaceEnter,
  logWorkspaceExit,
  logContextServed,
  logContextGap,
  logStuckSignal,
  logGateCheck,
  getTelemetryPath,
  getContextLogPath,
} from "./telemetry.js";
import { resetWorkspaceState } from "./workspace-state.js";

describe("telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkspaceState();
  });

  afterEach(async () => {
    // Clean up temp files
    try { await unlink(getTelemetryPath()); } catch { /* ok */ }
    try { await unlink(getContextLogPath()); } catch { /* ok */ }
  });

  it("logEvent writes JSONL", async () => {
    await logEvent({
      eventType: "test_event",
      tool: "test_tool",
      workspace: null,
      metadata: { key: "value" },
      timestamp: "2026-03-02T00:00:00Z",
    });

    const content = await readFile(getTelemetryPath(), "utf-8");
    const event = JSON.parse(content.trim());
    expect(event.eventType).toBe("test_event");
    expect(event.tool).toBe("test_tool");
    expect(event.metadata.key).toBe("value");
  });

  it("logToolCall records tool invocation", async () => {
    await logToolCall("bazdmeg_test", { foo: "bar" }, "success", 42);

    const content = await readFile(getTelemetryPath(), "utf-8");
    const event = JSON.parse(content.trim());
    expect(event.eventType).toBe("tool_call");
    expect(event.tool).toBe("bazdmeg_test");
    expect(event.durationMs).toBe(42);
  });

  it("logWorkspaceEnter records entry", async () => {
    await logWorkspaceEnter("chess-engine", ["packages/chess-engine/"]);

    const content = await readFile(getTelemetryPath(), "utf-8");
    const event = JSON.parse(content.trim());
    expect(event.eventType).toBe("workspace_enter");
    expect(event.workspace).toBe("chess-engine");
  });

  it("logWorkspaceExit records exit", async () => {
    await logWorkspaceExit("chess-engine");

    const content = await readFile(getTelemetryPath(), "utf-8");
    const event = JSON.parse(content.trim());
    expect(event.eventType).toBe("workspace_exit");
  });

  it("logContextServed records served context", async () => {
    await logContextServed("chess-engine", ["CLAUDE.md", "types.ts"]);

    const telemetry = await readFile(getTelemetryPath(), "utf-8");
    const event = JSON.parse(telemetry.trim());
    expect(event.eventType).toBe("context_served");

    const contextLog = await readFile(getContextLogPath(), "utf-8");
    const logEntry = JSON.parse(contextLog.trim());
    expect(logEntry.packageName).toBe("chess-engine");
    expect(logEntry.items).toEqual(["CLAUDE.md", "types.ts"]);
  });

  it("logContextGap records gap", async () => {
    await logContextGap("chess-engine", "ELO formula", "Calculate new rating");

    const content = await readFile(getTelemetryPath(), "utf-8");
    const event = JSON.parse(content.trim());
    expect(event.eventType).toBe("context_gap");
    expect(event.metadata.missingContext).toBe("ELO formula");
  });

  it("logStuckSignal records stuck event", async () => {
    await logStuckSignal("chess-engine", "Can't find file", "Tried reading elo.ts");

    const content = await readFile(getTelemetryPath(), "utf-8");
    const event = JSON.parse(content.trim());
    expect(event.eventType).toBe("agent_stuck");
  });

  it("logGateCheck records gate result", async () => {
    await logGateCheck("Unit Tests Present", "GREEN", "2 test files");

    const content = await readFile(getTelemetryPath(), "utf-8");
    const event = JSON.parse(content.trim());
    expect(event.eventType).toBe("gate_check");
    expect(event.metadata.gateName).toBe("Unit Tests Present");
  });

  it("handles appendFile failure in logEvent", async () => {
    vi.mocked(appendFile).mockRejectedValueOnce(new Error("Disk error"));
    
    await logEvent({
      eventType: "fail_test",
      tool: "none",
      workspace: null,
      timestamp: "2026-03-02T00:00:00Z",
    });

    expect(writeFile).toHaveBeenCalled();
  });

  it("summarizes different input types correctly", async () => {
    // null/undefined
    await logToolCall("test", null, "ok", 0);
    let content = await readFile(getTelemetryPath(), "utf-8");
    expect(content).toContain('"inputSummary":"null"');

    // long string
    const longString = "a".repeat(150);
    await logToolCall("test", longString, "ok", 0);
    content = await readFile(getTelemetryPath(), "utf-8");
    expect(content).toContain('"inputSummary":"' + "a".repeat(100) + '..."');

    // object
    await logToolCall("test", { key1: 1, key2: 2 }, "ok", 0);
    content = await readFile(getTelemetryPath(), "utf-8");
    expect(content).toContain('"inputSummary":"key1, key2"');

    // number
    await logToolCall("test", 123, "ok", 0);
    content = await readFile(getTelemetryPath(), "utf-8");
    expect(content).toContain('"inputSummary":"123"');
  });

  it("handles appendFile failure in logContextServed", async () => {
    vi.mocked(appendFile).mockImplementation(async (path) => {
      if (path === getContextLogPath()) throw new Error("Disk error");
      // For other paths, we can either call actual or just succeed
      return;
    });

    await logContextServed("test-pkg", []);
    expect(writeFile).toHaveBeenCalled();
  });
});
