/**
 * Additional Engine Tests
 *
 * Covers: getMachine, removeState, removeTransition, setContext,
 * getHistory, exportMachine, listMachines, validateMachine,
 * parallel states, history states, final states, internal transitions,
 * raise actions, and edge cases.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createMachine,
  getMachine,
  addState,
  addTransition,
  removeState,
  removeTransition,
  sendEvent,
  getState,
  getHistory,
  resetMachine,
  validateMachine,
  exportMachine,
  listMachines,
  setContext,
  clearMachines,
} from "./engine.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildToggleMachine(userId = "user-1") {
  const machine = createMachine({ name: "Toggle", userId, initial: "off" });
  const id = machine.definition.id;
  addState(id, { id: "off", type: "atomic" });
  addState(id, { id: "on", type: "atomic" });
  addTransition(id, { source: "off", target: "on", event: "TOGGLE", actions: [], internal: false });
  addTransition(id, { source: "on", target: "off", event: "TOGGLE", actions: [], internal: false });
  machine.currentStates = ["off"];
  return { machine, id };
}

// ---------------------------------------------------------------------------
// getMachine
// ---------------------------------------------------------------------------

describe("getMachine", () => {
  beforeEach(() => clearMachines());

  it("returns the instance for a known ID", () => {
    const machine = createMachine({ name: "M", userId: "u1" });
    const found = getMachine(machine.definition.id);
    expect(found.definition.name).toBe("M");
  });

  it("throws for an unknown machine ID", () => {
    expect(() => getMachine("does-not-exist")).toThrow('Machine "does-not-exist" not found');
  });
});

// ---------------------------------------------------------------------------
// createMachine
// ---------------------------------------------------------------------------

describe("createMachine", () => {
  beforeEach(() => clearMachines());

  it("throws when creating a machine with a duplicate ID", () => {
    createMachine({ name: "M", userId: "u1", id: "fixed-id" });
    expect(() => createMachine({ name: "M2", userId: "u1", id: "fixed-id" })).toThrow(
      'Machine with ID "fixed-id" already exists',
    );
  });

  it("auto-generates an ID when none is provided", () => {
    const m = createMachine({ name: "Auto", userId: "u1" });
    expect(typeof m.definition.id).toBe("string");
    expect(m.definition.id.length).toBeGreaterThan(0);
  });

  it("initialises currentStates when initial state already exists at creation", () => {
    const machine = createMachine({
      name: "Pre-built",
      userId: "u1",
      initial: "start",
      states: {
        start: { id: "start", type: "atomic", children: [], entryActions: [], exitActions: [] },
      },
      transitions: [],
      context: {},
    });
    expect(machine.currentStates).toContain("start");
  });

  it("executes entry actions of initial state on creation", () => {
    const machine = createMachine({
      name: "Entry Action Machine",
      userId: "u1",
      initial: "s1",
      states: {
        s1: {
          id: "s1",
          type: "atomic",
          children: [],
          entryActions: [{ type: "assign", params: { activated: true } }],
          exitActions: [],
        },
      },
      transitions: [],
      context: { activated: false },
    });
    expect(machine.context.activated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// removeState
// ---------------------------------------------------------------------------

describe("removeState", () => {
  beforeEach(() => clearMachines());

  it("removes an existing state", () => {
    const { id } = buildToggleMachine();
    removeState(id, "on");
    const instance = getMachine(id);
    expect(instance.definition.states.on).toBeUndefined();
  });

  it("removes transitions referencing the removed state", () => {
    const { id } = buildToggleMachine();
    removeState(id, "on");
    const instance = getMachine(id);
    const hasRef = instance.definition.transitions.some(
      (t) => t.source === "on" || t.target === "on",
    );
    expect(hasRef).toBe(false);
  });

  it("removes state from parent children array", () => {
    const machine = createMachine({ name: "M", userId: "u1", initial: "parent" });
    const id = machine.definition.id;
    addState(id, { id: "parent", type: "compound", initial: "child" });
    addState(id, { id: "child", type: "atomic", parent: "parent" });
    removeState(id, "child");
    const instance = getMachine(id);
    expect(instance.definition.states.parent?.children).not.toContain("child");
  });

  it("removes state from currentStates when active", () => {
    const { machine, id } = buildToggleMachine();
    machine.currentStates = ["off", "on"];
    removeState(id, "on");
    expect(getMachine(id).currentStates).not.toContain("on");
  });

  it("throws when state does not exist", () => {
    const { id } = buildToggleMachine();
    expect(() => removeState(id, "nonexistent")).toThrow(
      'State "nonexistent" not found in machine',
    );
  });
});

// ---------------------------------------------------------------------------
// removeTransition
// ---------------------------------------------------------------------------

describe("removeTransition", () => {
  beforeEach(() => clearMachines());

  it("removes a transition by ID", () => {
    const { machine, id } = buildToggleMachine();
    const transitionId = machine.definition.transitions[0]!.id;
    removeTransition(id, transitionId);
    expect(
      getMachine(id).definition.transitions.find((t) => t.id === transitionId),
    ).toBeUndefined();
  });

  it("throws when transition ID does not exist", () => {
    const { id } = buildToggleMachine();
    expect(() => removeTransition(id, "no-such-transition")).toThrow(
      'Transition "no-such-transition" not found in machine',
    );
  });
});

// ---------------------------------------------------------------------------
// setContext
// ---------------------------------------------------------------------------

describe("setContext", () => {
  beforeEach(() => clearMachines());

  it("merges new context values into existing context", () => {
    const machine = createMachine({
      name: "M",
      userId: "u1",
      context: { a: 1, b: 2 },
    });
    setContext(machine.definition.id, { b: 20, c: 30 });
    const instance = getMachine(machine.definition.id);
    expect(instance.context.a).toBe(1);
    expect(instance.context.b).toBe(20);
    expect(instance.context.c).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// getHistory (transition log)
// ---------------------------------------------------------------------------

describe("getHistory", () => {
  beforeEach(() => clearMachines());

  it("returns empty array before any transitions", () => {
    const machine = createMachine({ name: "M", userId: "u1" });
    expect(getHistory(machine.definition.id)).toEqual([]);
  });

  it("records each transition in the log", () => {
    const { machine, id } = buildToggleMachine();
    machine.currentStates = ["off"];
    sendEvent(id, "TOGGLE");
    sendEvent(id, "TOGGLE");
    const log = getHistory(id);
    expect(log).toHaveLength(2);
    expect(log[0]!.event).toBe("TOGGLE");
  });

  it("log entry contains before/after context snapshots", () => {
    const machine = createMachine({
      name: "Counter",
      userId: "u1",
      initial: "idle",
      context: { count: 0 },
    });
    const id = machine.definition.id;
    addState(id, { id: "idle", type: "atomic" });
    addTransition(id, {
      source: "idle",
      target: "idle",
      event: "INC",
      actions: [{ type: "assign", params: { count: "context.count + 1" } }],
      internal: true,
    });
    machine.currentStates = ["idle"];
    sendEvent(id, "INC");
    const log = getHistory(id);
    expect(log[0]!.beforeContext.count).toBe(0);
    expect(log[0]!.afterContext.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// exportMachine
// ---------------------------------------------------------------------------

describe("exportMachine", () => {
  beforeEach(() => clearMachines());

  it("returns a complete snapshot of the machine", () => {
    const { machine, id } = buildToggleMachine();
    machine.currentStates = ["off"];
    const exported = exportMachine(id);
    expect(exported.definition.name).toBe("Toggle");
    expect(exported.currentStates).toContain("off");
    expect(exported.context).toBeDefined();
    expect(Array.isArray(exported.transitionLog)).toBe(true);
  });

  it("exported snapshot is decoupled from live instance", () => {
    const { machine, id } = buildToggleMachine();
    machine.currentStates = ["off"];
    const exported = exportMachine(id);
    sendEvent(id, "TOGGLE");
    // The exported snapshot should not be mutated
    expect(exported.currentStates).toContain("off");
  });
});

// ---------------------------------------------------------------------------
// listMachines
// ---------------------------------------------------------------------------

describe("listMachines", () => {
  beforeEach(() => clearMachines());

  it("returns only machines for the specified userId", () => {
    buildToggleMachine("alice");
    buildToggleMachine("bob");
    buildToggleMachine("alice");
    const aliceMachines = listMachines("alice");
    expect(aliceMachines).toHaveLength(2);
    aliceMachines.forEach((m) => expect(m.id).toBeDefined());
  });

  it("returns empty array when user has no machines", () => {
    expect(listMachines("nobody")).toEqual([]);
  });

  it("summary contains id, name, currentStates, stateCount, transitionCount", () => {
    const { id } = buildToggleMachine("user-1");
    const summaries = listMachines("user-1");
    expect(summaries).toHaveLength(1);
    const summary = summaries[0]!;
    expect(summary.id).toBe(id);
    expect(summary.name).toBe("Toggle");
    expect(Array.isArray(summary.currentStates)).toBe(true);
    expect(typeof summary.stateCount).toBe("number");
    expect(typeof summary.transitionCount).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// validateMachine
// ---------------------------------------------------------------------------

describe("validateMachine", () => {
  beforeEach(() => clearMachines());

  it("returns no issues for a valid simple machine", () => {
    const { id } = buildToggleMachine();
    const issues = validateMachine(id);
    // With proper setup both states have transitions so no dead-ends
    const errors = issues.filter((i) => i.level === "error");
    expect(errors).toHaveLength(0);
  });

  it("reports error for missing machine initial state", () => {
    const machine = createMachine({ name: "M", userId: "u1", initial: "ghost" });
    const issues = validateMachine(machine.definition.id);
    expect(issues.some((i) => i.message.includes("initial state") && i.level === "error")).toBe(
      true,
    );
  });

  it("reports error for compound state without initial child", () => {
    const machine = createMachine({ name: "M", userId: "u1", initial: "parent" });
    const id = machine.definition.id;
    addState(id, { id: "parent", type: "compound" }); // no initial
    const issues = validateMachine(id);
    expect(issues.some((i) => i.stateId === "parent" && i.level === "error")).toBe(true);
  });

  it("reports error for compound state with non-existent initial child", () => {
    const machine = createMachine({ name: "M", userId: "u1", initial: "parent" });
    const id = machine.definition.id;
    addState(id, { id: "parent", type: "compound", initial: "missing-child" });
    const issues = validateMachine(id);
    expect(
      issues.some(
        (i) => i.stateId === "parent" && i.message.includes("missing-child") && i.level === "error",
      ),
    ).toBe(true);
  });

  it("reports error for transition referencing non-existent source state", () => {
    const machine = createMachine({ name: "M", userId: "u1" });
    const id = machine.definition.id;
    addState(id, { id: "real", type: "atomic" });
    // Manually inject a bad transition
    getMachine(id).definition.transitions.push({
      id: "bad-t",
      source: "ghost",
      target: "real",
      event: "GO",
      actions: [],
      internal: false,
    });
    const issues = validateMachine(id);
    expect(issues.some((i) => i.transitionId === "bad-t" && i.level === "error")).toBe(true);
  });

  it("reports error for duplicate transition IDs", () => {
    const machine = createMachine({ name: "M", userId: "u1" });
    const id = machine.definition.id;
    addState(id, { id: "a", type: "atomic" });
    addState(id, { id: "b", type: "atomic" });
    getMachine(id).definition.transitions.push(
      { id: "dup", source: "a", target: "b", event: "GO", actions: [], internal: false },
      { id: "dup", source: "a", target: "b", event: "GO2", actions: [], internal: false },
    );
    const issues = validateMachine(id);
    expect(issues.some((i) => i.transitionId === "dup" && i.message.includes("Duplicate"))).toBe(
      true,
    );
  });

  it("warns about unreachable states", () => {
    const machine = createMachine({ name: "M", userId: "u1", initial: "a" });
    const id = machine.definition.id;
    addState(id, { id: "a", type: "atomic" });
    addState(id, { id: "orphan", type: "atomic" }); // no incoming transitions
    const issues = validateMachine(id);
    expect(
      issues.some(
        (i) => i.stateId === "orphan" && i.level === "warning" && i.message.includes("unreachable"),
      ),
    ).toBe(true);
  });

  it("warns about dead-end states (no outgoing, not final)", () => {
    const machine = createMachine({ name: "M", userId: "u1", initial: "a" });
    const id = machine.definition.id;
    addState(id, { id: "a", type: "atomic" });
    addState(id, { id: "b", type: "atomic" }); // no outgoing
    addTransition(id, { source: "a", target: "b", event: "GO", actions: [], internal: false });
    const issues = validateMachine(id);
    expect(
      issues.some(
        (i) => i.stateId === "b" && i.level === "warning" && i.message.includes("dead-end"),
      ),
    ).toBe(true);
  });

  it("does not warn about final states as dead-ends", () => {
    const machine = createMachine({ name: "M", userId: "u1", initial: "a" });
    const id = machine.definition.id;
    addState(id, { id: "a", type: "atomic" });
    addState(id, { id: "done", type: "final" });
    addTransition(id, {
      source: "a",
      target: "done",
      event: "FINISH",
      actions: [],
      internal: false,
    });
    const issues = validateMachine(id);
    expect(issues.some((i) => i.stateId === "done" && i.message.includes("dead-end"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resetMachine
// ---------------------------------------------------------------------------

describe("resetMachine", () => {
  beforeEach(() => clearMachines());

  it("restores initial context", () => {
    const machine = createMachine({
      name: "M",
      userId: "u1",
      initial: "idle",
      context: { count: 0 },
    });
    const id = machine.definition.id;
    addState(id, { id: "idle", type: "atomic" });
    addTransition(id, {
      source: "idle",
      target: "idle",
      event: "INC",
      actions: [{ type: "assign", params: { count: "context.count + 1" } }],
      internal: true,
    });
    machine.currentStates = ["idle"];
    sendEvent(id, "INC");
    sendEvent(id, "INC");
    expect(getState(id).context.count).toBe(2);

    resetMachine(id);
    expect(getState(id).context.count).toBe(0);
  });

  it("clears transition log", () => {
    const { machine, id } = buildToggleMachine();
    machine.currentStates = ["off"];
    sendEvent(id, "TOGGLE");
    expect(getHistory(id)).toHaveLength(1);
    resetMachine(id);
    expect(getHistory(id)).toHaveLength(0);
  });

  it("re-enters initial state after reset", () => {
    const { machine, id } = buildToggleMachine();
    machine.currentStates = ["on"];
    resetMachine(id);
    expect(getState(id).activeStates).toContain("off");
  });

  it("sets currentStates to empty when no initial state is defined", () => {
    const machine = createMachine({ name: "M", userId: "u1" });
    resetMachine(machine.definition.id);
    expect(getState(machine.definition.id).activeStates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// sendEvent – edge cases
// ---------------------------------------------------------------------------

describe("sendEvent edge cases", () => {
  beforeEach(() => clearMachines());

  it("throws when no matching transition exists", () => {
    const { machine, id } = buildToggleMachine();
    machine.currentStates = ["off"];
    expect(() => sendEvent(id, "NONEXISTENT")).toThrow(
      'No matching transition for event "NONEXISTENT"',
    );
  });

  it("throws when machine does not exist", () => {
    expect(() => sendEvent("ghost-id", "EVENT")).toThrow();
  });

  it("skips transition when guard is false", () => {
    const machine = createMachine({
      name: "Guarded",
      userId: "u1",
      context: { level: 0 },
    });
    const id = machine.definition.id;
    addState(id, { id: "idle", type: "atomic" });
    addState(id, { id: "active", type: "atomic" });
    addTransition(id, {
      source: "idle",
      target: "active",
      event: "START",
      guard: { expression: "context.level >= 10" },
      actions: [],
      internal: false,
    });
    machine.currentStates = ["idle"];
    expect(() => sendEvent(id, "START")).toThrow("No matching transition");
  });

  it("takes guarded transition when guard is true", () => {
    const machine = createMachine({
      name: "Guarded",
      userId: "u1",
      context: { level: 10 },
    });
    const id = machine.definition.id;
    addState(id, { id: "idle", type: "atomic" });
    addState(id, { id: "active", type: "atomic" });
    addTransition(id, {
      source: "idle",
      target: "active",
      event: "START",
      guard: { expression: "context.level >= 10" },
      actions: [],
      internal: false,
    });
    machine.currentStates = ["idle"];
    sendEvent(id, "START");
    expect(getState(id).activeStates).toContain("active");
  });

  it("internal transition does not exit/re-enter state", () => {
    const machine = createMachine({
      name: "Internal",
      userId: "u1",
      context: { x: 0 },
    });
    const id = machine.definition.id;
    addState(id, {
      id: "s",
      type: "atomic",
      entryActions: [{ type: "assign", params: { x: "context.x + 1" } }],
      exitActions: [{ type: "assign", params: { x: "context.x + 10" } }],
    });
    addTransition(id, {
      source: "s",
      target: "s",
      event: "NOOP",
      actions: [],
      internal: true,
    });
    machine.currentStates = ["s"];
    sendEvent(id, "NOOP");
    // Neither entry nor exit actions should run for an internal transition
    expect(getState(id).context.x).toBe(0);
  });

  it("raise action triggers a chained transition", () => {
    const machine = createMachine({
      name: "Raise Machine",
      userId: "u1",
      context: {},
    });
    const id = machine.definition.id;
    addState(id, { id: "a", type: "atomic" });
    addState(id, { id: "b", type: "atomic" });
    addState(id, { id: "c", type: "atomic" });
    addTransition(id, {
      source: "a",
      target: "b",
      event: "GO",
      actions: [{ type: "raise", params: { event: "AUTO" } }],
      internal: false,
    });
    addTransition(id, {
      source: "b",
      target: "c",
      event: "AUTO",
      actions: [],
      internal: false,
    });
    machine.currentStates = ["a"];
    sendEvent(id, "GO");
    // After GO, raise AUTO is processed → ends in c
    expect(getState(id).activeStates).toContain("c");
  });

  it("log and custom actions are no-ops that do not throw", () => {
    const machine = createMachine({ name: "M", userId: "u1" });
    const id = machine.definition.id;
    addState(id, { id: "a", type: "atomic" });
    addState(id, { id: "b", type: "atomic" });
    addTransition(id, {
      source: "a",
      target: "b",
      event: "GO",
      actions: [
        { type: "log", params: { message: "hello", level: "info" } },
        { type: "custom", params: { name: "myAction" } },
      ],
      internal: false,
    });
    machine.currentStates = ["a"];
    expect(() => sendEvent(id, "GO")).not.toThrow();
  });

  it("assign action with non-expression value sets raw value", () => {
    const machine = createMachine({
      name: "M",
      userId: "u1",
      context: { label: "initial" },
    });
    const id = machine.definition.id;
    addState(id, { id: "a", type: "atomic" });
    addTransition(id, {
      source: "a",
      target: "a",
      event: "SET",
      actions: [{ type: "assign", params: { label: "updated" } }],
      internal: true,
    });
    machine.currentStates = ["a"];
    sendEvent(id, "SET");
    expect(getState(id).context.label).toBe("updated");
  });

  it("sendEvent returns a log entry with correct event name", () => {
    const { machine, id } = buildToggleMachine();
    machine.currentStates = ["off"];
    const log = sendEvent(id, "TOGGLE");
    expect(log.event).toBe("TOGGLE");
    expect(log.fromStates).toContain("off");
    expect(log.toStates).toContain("on");
  });
});

// ---------------------------------------------------------------------------
// Parallel states
// ---------------------------------------------------------------------------

describe("parallel states", () => {
  beforeEach(() => clearMachines());

  it("enters all child regions when parallel state is activated", () => {
    const machine = createMachine({
      name: "Parallel",
      userId: "u1",
      initial: "parallel",
    });
    const id = machine.definition.id;
    addState(id, { id: "parallel", type: "parallel" });
    addState(id, { id: "regionA", type: "atomic", parent: "parallel" });
    addState(id, { id: "regionB", type: "atomic", parent: "parallel" });
    resetMachine(id);
    const { activeStates } = getState(id);
    expect(activeStates).toContain("regionA");
    expect(activeStates).toContain("regionB");
  });
});

// ---------------------------------------------------------------------------
// Final states
// ---------------------------------------------------------------------------

describe("final states", () => {
  beforeEach(() => clearMachines());

  it("entering a final state raises a done event on the parent", () => {
    const machine = createMachine({
      name: "Final Test",
      userId: "u1",
      initial: "parent",
    });
    const id = machine.definition.id;
    addState(id, { id: "parent", type: "compound", initial: "working" });
    addState(id, { id: "working", type: "atomic", parent: "parent" });
    addState(id, { id: "done", type: "final", parent: "parent" });
    addState(id, { id: "finished", type: "atomic" });
    addTransition(id, {
      source: "working",
      target: "done",
      event: "FINISH",
      actions: [],
      internal: false,
    });
    addTransition(id, {
      source: "parent",
      target: "finished",
      event: "done.state.parent",
      actions: [],
      internal: false,
    });
    resetMachine(id);
    sendEvent(id, "FINISH");
    // After done.state.parent is raised, machine should be in "finished"
    expect(getState(id).activeStates).toContain("finished");
  });
});

// ---------------------------------------------------------------------------
// History states
// ---------------------------------------------------------------------------

describe("history states", () => {
  beforeEach(() => clearMachines());

  it("history state falls back to parent initial when no history is recorded", () => {
    const machine = createMachine({
      name: "History",
      userId: "u1",
      initial: "outer",
    });
    const id = machine.definition.id;
    addState(id, { id: "outer", type: "compound", initial: "inner" });
    addState(id, { id: "inner", type: "compound", initial: "a", parent: "outer" });
    addState(id, { id: "a", type: "atomic", parent: "inner" });
    addState(id, { id: "b", type: "atomic", parent: "inner" });
    addState(id, { id: "h", type: "history", parent: "inner" });
    resetMachine(id);
    // Resolve history state — no history recorded yet, should fall back to initial 'a'
    const { activeStates } = getState(id);
    expect(activeStates).toContain("a");
  });
});

// ---------------------------------------------------------------------------
// Circular reference detection
// ---------------------------------------------------------------------------

describe("circular reference detection", () => {
  beforeEach(() => clearMachines());

  it("throws when compound state initial points back to itself", () => {
    expect(() =>
      createMachine({
        name: "Circular",
        userId: "u1",
        initial: "s",
        states: {
          s: {
            id: "s",
            type: "compound",
            initial: "s", // self-referential initial
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
        transitions: [],
        context: {},
      }),
    ).toThrow("Circular initial reference detected");
  });
});
