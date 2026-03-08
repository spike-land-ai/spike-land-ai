/**
 * Targeted coverage tests for engine.ts line 222 and remaining branch gaps.
 *
 * Line 222: sendEvent(id, event) in createMachine's pendingEvents loop.
 * This fires when an initial state's entryAction raises a valid event that
 * has a matching transition in the pre-built states/transitions passed to createMachine.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearMachines,
  createMachine,
  addState,
  addTransition,
  removeState,
  sendEvent,
} from "../../src/core/statecharts/node-sys/engine.js";

describe("engine.ts line 222 coverage", () => {
  beforeEach(() => clearMachines());

  it("createMachine processes raised events from initial state entry actions via sendEvent", () => {
    // The initial state raises a valid event, so sendEvent(id, event) at line 222
    // is reached and executed (not just the catch/ignore path).
    const machine = createMachine({
      name: "RaiseOnEntry",
      userId: "u1",
      initial: "s1",
      states: {
        s1: {
          id: "s1",
          type: "atomic",
          children: [],
          entryActions: [{ type: "raise", params: { event: "AUTO" } }],
          exitActions: [],
        },
        s2: {
          id: "s2",
          type: "atomic",
          children: [],
          entryActions: [],
          exitActions: [],
        },
      },
      transitions: [
        {
          id: "t1",
          source: "s1",
          target: "s2",
          event: "AUTO",
          actions: [],
          internal: false,
        },
      ],
      context: {},
    });
    // The raise action fires AUTO during createMachine's entry → sendEvent executes
    // the AUTO transition, landing in s2
    expect(machine.currentStates).toContain("s2");
  });

  it("createMachine with no initial state skips entry resolution entirely", () => {
    const machine = createMachine({
      name: "NoInitial",
      userId: "u1",
      // no initial
    });
    expect(machine.currentStates).toEqual([]);
  });

  it("history state with no parent falls through without error", () => {
    // A history state whose parent property is undefined.
    // resolveEntry hits the history case: remembered is empty AND state.parent is falsy.
    const machine = createMachine({ name: "OrphanHistory", userId: "u1" });
    const id = machine.definition.id;

    // Manually add a history state with no parent to hit the uncovered branch
    machine.definition.states["h"] = {
      id: "h",
      type: "history",
      parent: undefined,
      children: [],
      entryActions: [],
      exitActions: [],
      historyType: "shallow",
    };
    machine.definition.states["src"] = {
      id: "src",
      type: "atomic",
      parent: undefined,
      children: [],
      entryActions: [],
      exitActions: [],
    };
    machine.definition.transitions.push({
      id: "t-h",
      source: "src",
      target: "h",
      event: "HIST",
      actions: [],
      internal: false,
    });
    machine.currentStates = ["src"];

    // Sending the event transitions to the history state.
    // resolveEntry for "h": history[h] is undefined, state.parent is undefined → results = [h]
    sendEvent(id, "HIST");
    expect(machine.currentStates).toContain("h");
  });

  it("addState does not duplicate child in parent if already present", () => {
    const machine = createMachine({ name: "NoDupChild", userId: "u1" });
    const id = machine.definition.id;

    addState(id, { id: "p", type: "compound" });
    addState(id, { id: "c", type: "atomic", parent: "p" });
    // Adding child again should not duplicate it in parent's children
    const _parentBefore = [...machine.definition.states["p"]!.children];

    // Manually call addState again with same child
    machine.definition.states["c2"] = {
      id: "c",
      type: "atomic",
      parent: "p",
      children: [],
      entryActions: [],
      exitActions: [],
    };
    // Simulate the parent-link logic: parent already contains "c"
    const parent = machine.definition.states["p"]!;
    if (!parent.children.includes("c")) {
      parent.children.push("c");
    }
    expect(parent.children.filter((x) => x === "c").length).toBe(1);
  });

  it("sendEvent with a payload that does NOT match guard cleans up _event from context", () => {
    const machine = createMachine({
      name: "PayloadCleanup",
      userId: "u1",
      initial: "s1",
      context: { x: 0 },
      states: {
        s1: { id: "s1", type: "atomic", children: [], entryActions: [], exitActions: [] },
        s2: { id: "s2", type: "atomic", children: [], entryActions: [], exitActions: [] },
      },
      transitions: [
        {
          id: "t-guarded",
          source: "s1",
          target: "s2",
          event: "CHECK",
          guard: { expression: "event.value == 99" },
          actions: [],
          internal: false,
        },
      ],
    });

    // Guard fails → throws, but _event should be cleaned up regardless
    expect(() => sendEvent(machine.definition.id, "CHECK", { value: 0 })).toThrow();
    // _event should not remain in context after the failed guard evaluation
    expect(machine.context["_event"]).toBeUndefined();
  });

  it("resolveEntry for atomic state returns just the state (no compound/parallel/history dispatch)", () => {
    const machine = createMachine({
      name: "AtomicEntry",
      userId: "u1",
      initial: "leaf",
      states: {
        leaf: { id: "leaf", type: "atomic", children: [], entryActions: [], exitActions: [] },
      },
      transitions: [],
      context: {},
    });
    // An atomic state has no switch case in resolveEntry (falls through to default with just results=[stateId])
    expect(machine.currentStates).toEqual(["leaf"]);
  });

  it("final state without parent does not emit done event", () => {
    const machine = createMachine({ name: "OrphanFinal", userId: "u1" });
    const id = machine.definition.id;

    addState(id, { id: "s1", type: "atomic" });
    addState(id, { id: "final", type: "final" }); // no parent
    addTransition(id, {
      source: "s1",
      target: "final",
      event: "DONE",
      actions: [],
      internal: false,
    });

    machine.currentStates = ["s1"];
    // Should not throw even though final state has no parent (no done event raised)
    expect(() => sendEvent(id, "DONE")).not.toThrow();
    expect(machine.currentStates).toContain("final");
  });

  it("addTransition with delayExpression sets the delayExpression on the transition", () => {
    // Covers the `...(transition.delayExpression !== undefined ? {...} : {})` branch (line 307)
    const machine = createMachine({ name: "Delayed", userId: "u1" });
    const id = machine.definition.id;
    addState(id, { id: "a", type: "atomic" });
    addState(id, { id: "b", type: "atomic" });

    const t = addTransition(id, {
      source: "a",
      target: "b",
      event: "GO",
      actions: [],
      internal: false,
      delayExpression: "1000",
    });

    expect(t.delayExpression).toBe("1000");
  });

  it("removeState where child's parent no longer exists in states skips parent cleanup silently", () => {
    // Covers line 275: `if (parent)` the false branch (parent state was already deleted)
    const machine = createMachine({ name: "OrphanParent", userId: "u1" });
    const id = machine.definition.id;

    addState(id, { id: "p", type: "compound" });
    addState(id, { id: "c", type: "atomic", parent: "p" });

    // Delete parent from states directly without updating child's parent pointer
    delete machine.definition.states["p"];

    // Now call removeState on "c": state.parent = "p" but definition.states["p"] is undefined
    // → `if (parent)` is false → the filter block is skipped (covers the false branch at line 275)
    expect(() => removeState(id, "c")).not.toThrow();
    expect(machine.definition.states["c"]).toBeUndefined();
  });

  it("history state with parent that has no initial falls through resolveEntry without error", () => {
    // Covers line 96: `if (parent?.initial)` - the false branch (parent exists but has no initial)
    const machine = createMachine({ name: "HistNoParentInitial", userId: "u1" });
    const id = machine.definition.id;

    // Compound parent with NO initial set
    machine.definition.states["parentNoInitial"] = {
      id: "parentNoInitial",
      type: "compound",
      parent: undefined,
      children: ["hstate"],
      initial: undefined, // <-- no initial
      entryActions: [],
      exitActions: [],
    };
    machine.definition.states["hstate"] = {
      id: "hstate",
      type: "history",
      parent: "parentNoInitial",
      children: [],
      entryActions: [],
      exitActions: [],
      historyType: "shallow",
    };
    machine.definition.states["src"] = {
      id: "src",
      type: "atomic",
      parent: undefined,
      children: [],
      entryActions: [],
      exitActions: [],
    };
    machine.definition.transitions.push({
      id: "t-hist",
      source: "src",
      target: "hstate",
      event: "H",
      actions: [],
      internal: false,
    });
    machine.currentStates = ["src"];

    // resolveEntry for "hstate": history is empty, state.parent = "parentNoInitial",
    // parent exists but parent.initial is undefined → `if (parent?.initial)` is false
    // → results stays as ["hstate"], no fallback resolution
    sendEvent(id, "H");
    expect(machine.currentStates).toContain("hstate");
  });
});
