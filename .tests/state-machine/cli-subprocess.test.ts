/**
 * CLI Module Tests
 *
 * Tests the actual cli.ts module by importing and exercising
 * the readline-based command dispatch via EventEmitter simulation.
 * The CLI processes JSON lines from stdin and writes to stdout.
 */

import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// We mock createInterface to control the readline interface
const mockRlEmitter = new EventEmitter();
const mockCreateInterface = vi.fn(() => mockRlEmitter);

vi.mock("node:readline", () => ({
  createInterface: mockCreateInterface,
}));

// Mock process.stdout.write and console.error
const stdoutWrites: string[] = [];
const mockStdoutWrite = vi.fn((data: string) => {
  stdoutWrites.push(data);
  return true;
});

// Mock console.error to suppress output - set up before module import
const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  stdoutWrites.length = 0;
  mockStdoutWrite.mockClear();
  vi.spyOn(process.stdout, "write").mockImplementation(mockStdoutWrite);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("state-machine CLI module", () => {
  it("cli.ts can be imported without errors", async () => {
    // Just importing the module exercises the module-level code
    // (createInterface call, console.error, rl.on registration)
    const mod = await import("../../src/core/statecharts/cli.js");
    expect(mod).toBeDefined();
  });

  it("createInterface was called with stdin/stdout", () => {
    expect(mockCreateInterface).toHaveBeenCalledWith({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });
  });

  it("console.error was called with startup message", () => {
    expect(mockConsoleError).toHaveBeenCalledWith(
      "State Machine MCP-like CLI started. Send JSON commands.",
    );
  });

  it("readline interface has a 'line' event listener registered", () => {
    // The CLI registers rl.on("line", ...) which means the emitter should have listeners
    expect(mockRlEmitter.listenerCount("line")).toBeGreaterThan(0);
  });

  it("dispatches 'create' command and writes JSON result", () => {
    const command = JSON.stringify({
      id: 1,
      method: "create",
      params: { name: "CLI Test Machine", userId: "cli-user" },
    });
    mockRlEmitter.emit("line", command);

    expect(stdoutWrites.length).toBeGreaterThan(0);
    const output = JSON.parse(stdoutWrites[stdoutWrites.length - 1]!.trim());
    expect(output.id).toBe(1);
    expect(output.result).toBeDefined();
    expect(output.result.definition.name).toBe("CLI Test Machine");
  });

  it("dispatches 'addState' command", () => {
    // First create a machine
    const createCmd = JSON.stringify({
      id: 10,
      method: "create",
      params: { name: "AddState Machine", userId: "u1" },
    });
    mockRlEmitter.emit("line", createCmd);
    const createOutput = JSON.parse(stdoutWrites[stdoutWrites.length - 1]!.trim());
    const machineId = createOutput.result.definition.id;

    // Now addState
    const addStateCmd = JSON.stringify({
      id: 11,
      method: "addState",
      params: { machineId, state: { id: "idle", type: "atomic" } },
    });
    mockRlEmitter.emit("line", addStateCmd);
    const output = JSON.parse(stdoutWrites[stdoutWrites.length - 1]!.trim());
    expect(output.id).toBe(11);
    expect(output.result.id).toBe("idle");
  });

  it("dispatches 'addTransition' command", () => {
    const createCmd = JSON.stringify({
      id: 20,
      method: "create",
      params: { name: "Trans Machine", userId: "u1" },
    });
    mockRlEmitter.emit("line", createCmd);
    const machineId = JSON.parse(stdoutWrites[stdoutWrites.length - 1]!.trim()).result.definition
      .id;

    mockRlEmitter.emit(
      "line",
      JSON.stringify({
        id: 21,
        method: "addState",
        params: { machineId, state: { id: "s1", type: "atomic" } },
      }),
    );
    mockRlEmitter.emit(
      "line",
      JSON.stringify({
        id: 22,
        method: "addState",
        params: { machineId, state: { id: "s2", type: "atomic" } },
      }),
    );

    mockRlEmitter.emit(
      "line",
      JSON.stringify({
        id: 23,
        method: "addTransition",
        params: {
          machineId,
          transition: { source: "s1", target: "s2", event: "GO", actions: [], internal: false },
        },
      }),
    );
    const output = JSON.parse(stdoutWrites[stdoutWrites.length - 1]!.trim());
    expect(output.id).toBe(23);
    expect(output.result.event).toBe("GO");
  });

  it("dispatches 'getState' command", () => {
    const createCmd = JSON.stringify({
      id: 30,
      method: "create",
      params: { name: "GetState Machine", userId: "u1", context: { x: 99 } },
    });
    mockRlEmitter.emit("line", createCmd);
    const machineId = JSON.parse(stdoutWrites[stdoutWrites.length - 1]!.trim()).result.definition
      .id;

    mockRlEmitter.emit(
      "line",
      JSON.stringify({ id: 31, method: "getState", params: { machineId } }),
    );
    const output = JSON.parse(stdoutWrites[stdoutWrites.length - 1]!.trim());
    expect(output.id).toBe(31);
    expect(output.result.context.x).toBe(99);
  });

  it("dispatches 'reset' command", () => {
    const createCmd = JSON.stringify({
      id: 40,
      method: "create",
      params: { name: "Reset Machine", userId: "u1" },
    });
    mockRlEmitter.emit("line", createCmd);
    const machineId = JSON.parse(stdoutWrites[stdoutWrites.length - 1]!.trim()).result.definition
      .id;

    mockRlEmitter.emit("line", JSON.stringify({ id: 41, method: "reset", params: { machineId } }));
    const output = JSON.parse(stdoutWrites[stdoutWrites.length - 1]!.trim());
    expect(output.id).toBe(41);
    expect(output.result.status).toBe("reset");
  });

  it("dispatches 'validate' command", () => {
    const createCmd = JSON.stringify({
      id: 50,
      method: "create",
      params: { name: "Validate Machine", userId: "u1" },
    });
    mockRlEmitter.emit("line", createCmd);
    const machineId = JSON.parse(stdoutWrites[stdoutWrites.length - 1]!.trim()).result.definition
      .id;

    mockRlEmitter.emit(
      "line",
      JSON.stringify({ id: 51, method: "validate", params: { machineId } }),
    );
    const output = JSON.parse(stdoutWrites[stdoutWrites.length - 1]!.trim());
    expect(output.id).toBe(51);
    expect(Array.isArray(output.result)).toBe(true);
  });

  it("dispatches 'sendEvent' command", async () => {
    // Create machine with states
    const createCmd = JSON.stringify({
      id: 60,
      method: "create",
      params: { name: "SendEvent Machine", userId: "u1", initial: "a" },
    });
    mockRlEmitter.emit("line", createCmd);
    const machineId = JSON.parse(stdoutWrites[stdoutWrites.length - 1]!.trim()).result.definition
      .id;

    mockRlEmitter.emit(
      "line",
      JSON.stringify({
        id: 61,
        method: "addState",
        params: { machineId, state: { id: "a", type: "atomic" } },
      }),
    );
    mockRlEmitter.emit(
      "line",
      JSON.stringify({
        id: 62,
        method: "addState",
        params: { machineId, state: { id: "b", type: "atomic" } },
      }),
    );
    mockRlEmitter.emit(
      "line",
      JSON.stringify({
        id: 63,
        method: "addTransition",
        params: {
          machineId,
          transition: { source: "a", target: "b", event: "NEXT", actions: [], internal: false },
        },
      }),
    );

    // Force current state to a
    const { clearMachines, getMachine } = await import("../../src/core/statecharts/engine.js");
    const instance = getMachine(machineId);
    instance.currentStates = ["a"];

    mockRlEmitter.emit(
      "line",
      JSON.stringify({
        id: 64,
        method: "sendEvent",
        params: { machineId, event: "NEXT", payload: { extra: true } },
      }),
    );
    const output = JSON.parse(stdoutWrites[stdoutWrites.length - 1]!.trim());
    expect(output.id).toBe(64);
    expect(output.result.toStates).toContain("b");

    clearMachines();
  });

  it("writes error JSON for unknown method", () => {
    mockRlEmitter.emit("line", JSON.stringify({ id: 99, method: "unknownCommand", params: {} }));
    const output = JSON.parse(stdoutWrites[stdoutWrites.length - 1]!.trim());
    expect(output.error).toContain("Unknown method");
  });

  it("writes error JSON for invalid JSON input", () => {
    mockRlEmitter.emit("line", "{ this is not valid json }");
    const output = JSON.parse(stdoutWrites[stdoutWrites.length - 1]!.trim());
    expect(output.error).toBeDefined();
  });

  it("writes error JSON for missing machine", () => {
    mockRlEmitter.emit(
      "line",
      JSON.stringify({ id: 100, method: "getState", params: { machineId: "nonexistent-uuid" } }),
    );
    const output = JSON.parse(stdoutWrites[stdoutWrites.length - 1]!.trim());
    expect(output.error).toContain("nonexistent-uuid");
  });
});
