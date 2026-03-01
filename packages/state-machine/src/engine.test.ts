import { describe, it, expect, beforeEach } from "vitest";
import {
  createMachine,
  sendEvent,
  getState,
  addState,
  addTransition,
  clearMachines,
  resetMachine,
} from "./engine.js";

describe("Statechart Engine", () => {
  beforeEach(() => {
    clearMachines();
  });

  it("should initialize a machine and enter the initial state", () => {
    const machine = createMachine({
      name: "Light Machine",
      userId: "user-1",
      initial: "off",
      context: { count: 0 },
    });

    addState(machine.definition.id, {
      id: "off",
      type: "atomic",
    });

    addState(machine.definition.id, {
      id: "on",
      type: "atomic",
    });

    // Reset machine to enter the newly added initial state
    resetMachine(machine.definition.id);
    const { activeStates } = getState(machine.definition.id);
    expect(activeStates).toContain("off");
  });

  it("should handle hierarchical states", () => {
    const machine = createMachine({
      name: "Hierarchy Machine",
      userId: "user-1",
      initial: "parent",
    });

    addState(machine.definition.id, {
      id: "parent",
      type: "compound",
      initial: "child1",
    });

    addState(machine.definition.id, {
      id: "child1",
      type: "atomic",
      parent: "parent",
    });

    addState(machine.definition.id, {
      id: "child2",
      type: "atomic",
      parent: "parent",
    });

    addTransition(machine.definition.id, {
      source: "child1",
      target: "child2",
      event: "NEXT",
      actions: [],
      internal: false,
    });

    resetMachine(machine.definition.id);
    const { activeStates: initialStates } = getState(machine.definition.id);
    expect(initialStates).toContain("parent");
    expect(initialStates).toContain("child1");

    sendEvent(machine.definition.id, "NEXT");
    const { activeStates: nextStates } = getState(machine.definition.id);
    expect(nextStates).toContain("parent");
    expect(nextStates).toContain("child2");
  });

  it("should transition on event", () => {
    const machine = createMachine({
      name: "Toggle Machine",
      userId: "user-1",
      initial: "off",
    });

    addState(machine.definition.id, { id: "off", type: "atomic" });
    addState(machine.definition.id, { id: "on", type: "atomic" });
    addTransition(machine.definition.id, {
      source: "off",
      target: "on",
      event: "TOGGLE",
      actions: [],
      internal: false,
    });

    // Re-initialize to trigger initial state entry logic
    machine.currentStates = ["off"];

    sendEvent(machine.definition.id, "TOGGLE");
    const { activeStates } = getState(machine.definition.id);
    expect(activeStates).toContain("on");
  });

  it("should execute assign actions", () => {
    const machine = createMachine({
      name: "Counter Machine",
      userId: "user-1",
      initial: "idle",
      context: { count: 0 },
    });

    addState(machine.definition.id, { id: "idle", type: "atomic" });
    addTransition(machine.definition.id, {
      source: "idle",
      target: "idle",
      event: "INC",
      actions: [
        {
          type: "assign",
          params: { count: "context.count + 1" },
        },
      ],
      internal: true,
    });

    machine.currentStates = ["idle"];

    sendEvent(machine.definition.id, "INC");
    const { context } = getState(machine.definition.id);
    expect(context.count).toBe(1);
  });

  it("should evaluate guards", () => {
    const machine = createMachine({
      name: "Guard Machine",
      userId: "user-1",
      initial: "idle",
      context: { count: 0 },
    });

    addState(machine.definition.id, { id: "idle", type: "atomic" });
    addState(machine.definition.id, { id: "active", type: "atomic" });

    addTransition(machine.definition.id, {
      source: "idle",
      target: "active",
      event: "START",
      guard: { expression: "context.count >= 10" },
      actions: [],
      internal: false,
    });

    machine.currentStates = ["idle"];

    // Should not transition if guard is false
    expect(() => sendEvent(machine.definition.id, "START")).toThrow();

    // Set context and try again
    machine.context.count = 10;
    sendEvent(machine.definition.id, "START");
    const { activeStates } = getState(machine.definition.id);
    expect(activeStates).toContain("active");
  });
});
