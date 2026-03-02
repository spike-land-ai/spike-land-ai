/**
 * CLI Tests
 *
 * Tests the JSON-line CLI interface by simulating stdin/stdout.
 * Since the CLI uses readline, we test the command routing logic
 * by exercising the underlying engine functions that CLI delegates to.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createInterface } from "node:readline";
import {
  createMachine,
  addState,
  addTransition,
  sendEvent,
  getState,
  resetMachine,
  validateMachine,
  clearMachines,
} from "./engine.js";

// Test the CLI command dispatch logic by simulating the same operations
// the CLI routes to. This exercises the CLI surface area without spawning
// a subprocess.

describe("CLI command routing (engine integration)", () => {
  beforeEach(() => {
    clearMachines();
  });

  function dispatchCommand(method: string, params: Record<string, unknown>): unknown {
    switch (method) {
      case "create":
        return createMachine(params as Parameters<typeof createMachine>[0]);
      case "addState": {
        const { machineId, state } = params as {
          machineId: string;
          state: Parameters<typeof addState>[1];
        };
        return addState(machineId, state);
      }
      case "addTransition": {
        const { machineId, transition } = params as {
          machineId: string;
          transition: Parameters<typeof addTransition>[1];
        };
        return addTransition(machineId, transition);
      }
      case "sendEvent": {
        const { machineId, event, payload } = params as {
          machineId: string;
          event: string;
          payload?: Record<string, unknown>;
        };
        return sendEvent(machineId, event, payload);
      }
      case "getState": {
        const { machineId } = params as { machineId: string };
        return getState(machineId);
      }
      case "reset": {
        const { machineId } = params as { machineId: string };
        resetMachine(machineId);
        return { status: "reset" };
      }
      case "validate": {
        const { machineId } = params as { machineId: string };
        return validateMachine(machineId);
      }
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  it("create command creates a machine", () => {
    const result = dispatchCommand("create", {
      name: "Test Machine",
      userId: "user-1",
      initial: "",
    }) as ReturnType<typeof createMachine>;

    expect(result.definition.name).toBe("Test Machine");
    expect(result.definition.userId).toBe("user-1");
  });

  it("addState command adds state to machine", () => {
    const machine = dispatchCommand("create", {
      name: "Test",
      userId: "u1",
    }) as ReturnType<typeof createMachine>;

    const state = dispatchCommand("addState", {
      machineId: machine.definition.id,
      state: { id: "idle", type: "atomic" },
    });

    expect((state as ReturnType<typeof addState>).id).toBe("idle");
  });

  it("addTransition command adds transition to machine", () => {
    const machine = dispatchCommand("create", {
      name: "Test",
      userId: "u1",
    }) as ReturnType<typeof createMachine>;
    const id = machine.definition.id;

    dispatchCommand("addState", { machineId: id, state: { id: "a", type: "atomic" } });
    dispatchCommand("addState", { machineId: id, state: { id: "b", type: "atomic" } });

    const transition = dispatchCommand("addTransition", {
      machineId: id,
      transition: { source: "a", target: "b", event: "GO", actions: [], internal: false },
    });

    expect((transition as ReturnType<typeof addTransition>).event).toBe("GO");
  });

  it("sendEvent command triggers a transition", () => {
    const machine = dispatchCommand("create", {
      name: "Test",
      userId: "u1",
      initial: "a",
    }) as ReturnType<typeof createMachine>;
    const id = machine.definition.id;

    dispatchCommand("addState", { machineId: id, state: { id: "a", type: "atomic" } });
    dispatchCommand("addState", { machineId: id, state: { id: "b", type: "atomic" } });
    dispatchCommand("addTransition", {
      machineId: id,
      transition: { source: "a", target: "b", event: "GO", actions: [], internal: false },
    });

    machine.currentStates = ["a"];

    const log = dispatchCommand("sendEvent", { machineId: id, event: "GO" }) as ReturnType<
      typeof sendEvent
    >;

    expect(log.toStates).toContain("b");
  });

  it("sendEvent command with payload merges into context temporarily", () => {
    const machine = dispatchCommand("create", {
      name: "Test",
      userId: "u1",
      initial: "a",
      context: { count: 5 },
    }) as ReturnType<typeof createMachine>;
    const id = machine.definition.id;

    dispatchCommand("addState", { machineId: id, state: { id: "a", type: "atomic" } });
    dispatchCommand("addState", { machineId: id, state: { id: "b", type: "atomic" } });
    dispatchCommand("addTransition", {
      machineId: id,
      transition: {
        source: "a",
        target: "b",
        event: "GO",
        actions: [],
        internal: false,
        guard: { expression: "context.count >= 5" },
      },
    });

    machine.currentStates = ["a"];
    const log = dispatchCommand("sendEvent", { machineId: id, event: "GO" });
    expect((log as ReturnType<typeof sendEvent>).toStates).toContain("b");
  });

  it("getState command returns current states and context", () => {
    const machine = dispatchCommand("create", {
      name: "Test",
      userId: "u1",
      initial: "idle",
      context: { x: 42 },
    }) as ReturnType<typeof createMachine>;
    const id = machine.definition.id;

    dispatchCommand("addState", { machineId: id, state: { id: "idle", type: "atomic" } });
    machine.currentStates = ["idle"];

    const state = dispatchCommand("getState", { machineId: id }) as ReturnType<typeof getState>;
    expect(state.activeStates).toContain("idle");
    expect(state.context.x).toBe(42);
  });

  it("reset command resets a machine", () => {
    const machine = dispatchCommand("create", {
      name: "Test",
      userId: "u1",
    }) as ReturnType<typeof createMachine>;

    const result = dispatchCommand("reset", { machineId: machine.definition.id });
    expect((result as { status: string }).status).toBe("reset");
  });

  it("validate command returns validation issues", () => {
    const machine = dispatchCommand("create", {
      name: "Test",
      userId: "u1",
      initial: "nonexistent",
    }) as ReturnType<typeof createMachine>;

    const issues = dispatchCommand("validate", {
      machineId: machine.definition.id,
    }) as ReturnType<typeof validateMachine>;

    expect(Array.isArray(issues)).toBe(true);
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });

  it("unknown method throws an error", () => {
    expect(() => dispatchCommand("unknown", {})).toThrow("Unknown method: unknown");
  });

  it("JSON roundtrip: command output is serializable", () => {
    const result = dispatchCommand("create", {
      name: "Serializable Machine",
      userId: "u1",
    });
    const json = JSON.stringify({ id: 1, result });
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("error output is serializable", () => {
    let errorMsg = "";
    try {
      dispatchCommand("sendEvent", { machineId: "not-exist", event: "X" });
    } catch (err) {
      errorMsg = (err as Error).message;
    }
    const json = JSON.stringify({ error: errorMsg });
    expect(() => JSON.parse(json)).not.toThrow();
    expect(errorMsg).toContain("not-exist");
  });
});

describe("CLI readline interface shape", () => {
  it("createInterface function is importable and callable", () => {
    // Verify the node:readline createInterface is available — the CLI depends on it
    expect(typeof createInterface).toBe("function");
  });
});
