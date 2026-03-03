import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addState,
  addTransition,
  clearMachines,
  createMachine,
  exportMachine,
  getHistory,
  getState,
  listMachines,
  removeState,
  removeTransition,
  resetMachine,
  sendEvent,
  setContext,
} from "./engine";

const mockPrisma = {
  stateMachine: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

describe("state machine engine - core operations", () => {
  beforeEach(() => {
    clearMachines();
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. createMachine & listMachines
  // -----------------------------------------------------------------------

  describe("createMachine & listMachines", () => {
    it("should create a machine and list it for the owner", () => {
      const instance = createMachine({
        id: "m1",
        name: "Test Machine",
        userId: "user-1",
        initial: "idle",
        states: {
          idle: {
            id: "idle",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
      });

      expect(instance.definition.id).toBe("m1");
      expect(instance.definition.name).toBe("Test Machine");

      const list = listMachines("user-1");
      expect(list).toHaveLength(1);
      expect(list[0]!.id).toBe("m1");
      expect(list[0]!.name).toBe("Test Machine");
      expect(list[0]!.stateCount).toBe(1);
    });

    it("should auto-enter initial state for compound state resolution", () => {
      createMachine({
        id: "m2",
        name: "Compound Init",
        userId: "user-1",
        initial: "parent",
        states: {
          parent: {
            id: "parent",
            type: "compound",
            initial: "childA",
            children: ["childA", "childB"],
            entryActions: [],
            exitActions: [],
          },
          childA: {
            id: "childA",
            type: "atomic",
            parent: "parent",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          childB: {
            id: "childB",
            type: "atomic",
            parent: "parent",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
      });

      const state = getState("m2");
      expect(state.activeStates).toContain("parent");
      expect(state.activeStates).toContain("childA");
      expect(state.activeStates).not.toContain("childB");
    });

    it("should not list machines for a different user", () => {
      createMachine({ id: "m3", name: "Private", userId: "user-a" });
      const list = listMachines("user-b");
      expect(list).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // 2. addState & removeState
  // -----------------------------------------------------------------------

  describe("addState & removeState", () => {
    it("should add an atomic state to the definition", () => {
      createMachine({ id: "m1", name: "M", userId: "u" });
      const state = addState("m1", { id: "idle", type: "atomic" });

      expect(state.id).toBe("idle");
      expect(state.type).toBe("atomic");

      const exported = exportMachine("m1");
      expect(exported.definition.states.idle).toBeDefined();
    });

    it("should add a child state and update parent's children array", () => {
      createMachine({ id: "m1", name: "M", userId: "u" });
      addState("m1", {
        id: "parent",
        type: "compound",
        initial: "child",
      });
      addState("m1", {
        id: "child",
        type: "atomic",
        parent: "parent",
      });

      const exported = exportMachine("m1");
      expect(exported.definition.states.parent!.children).toContain("child");
    });

    it("should remove a state and clean up transitions referencing it", () => {
      createMachine({ id: "m1", name: "M", userId: "u" });
      addState("m1", { id: "a", type: "atomic" });
      addState("m1", { id: "b", type: "atomic" });
      addTransition("m1", {
        id: "t1",
        source: "a",
        target: "b",
        event: "GO",
        actions: [],
        internal: false,
      });

      removeState("m1", "b");

      const exported = exportMachine("m1");
      expect(exported.definition.states.b).toBeUndefined();
      expect(exported.definition.transitions).toHaveLength(0);
    });

    it("should throw when removing a non-existent state", () => {
      createMachine({ id: "m1", name: "M", userId: "u" });
      expect(() => removeState("m1", "nope")).toThrow("State \"nope\" not found");
    });
  });

  // -----------------------------------------------------------------------
  // 3. addTransition & removeTransition
  // -----------------------------------------------------------------------

  describe("addTransition & removeTransition", () => {
    it("should add a transition and include it in the definition", () => {
      createMachine({ id: "m1", name: "M", userId: "u" });
      addState("m1", { id: "a", type: "atomic" });
      addState("m1", { id: "b", type: "atomic" });

      const t = addTransition("m1", {
        id: "t1",
        source: "a",
        target: "b",
        event: "GO",
        actions: [],
        internal: false,
      });

      expect(t.id).toBe("t1");
      const exported = exportMachine("m1");
      expect(exported.definition.transitions).toHaveLength(1);
      expect(exported.definition.transitions[0]!.event).toBe("GO");
    });

    it("should remove a transition by ID", () => {
      createMachine({ id: "m1", name: "M", userId: "u" });
      addState("m1", { id: "a", type: "atomic" });
      addState("m1", { id: "b", type: "atomic" });
      addTransition("m1", {
        id: "t1",
        source: "a",
        target: "b",
        event: "GO",
        actions: [],
        internal: false,
      });

      removeTransition("m1", "t1");

      const exported = exportMachine("m1");
      expect(exported.definition.transitions).toHaveLength(0);
    });

    it("should throw when removing a non-existent transition", () => {
      createMachine({ id: "m1", name: "M", userId: "u" });
      expect(() => removeTransition("m1", "nope")).toThrow(
        "Transition \"nope\" not found",
      );
    });

    it("should preserve delayExpression when adding a transition", () => {
      createMachine({ id: "m1", name: "M", userId: "u" });
      addState("m1", { id: "a", type: "atomic" });
      addState("m1", { id: "b", type: "atomic" });

      const t = addTransition("m1", {
        source: "a",
        target: "b",
        event: "TICK",
        actions: [],
        internal: false,
        delayExpression: "context.delay + 500",
      });

      expect(t.delayExpression).toBe("context.delay + 500");
      const exported = exportMachine("m1");
      expect(exported.definition.transitions[0]!.delayExpression).toBe("context.delay + 500");
    });
  });

  // -----------------------------------------------------------------------
  // setContext
  // -----------------------------------------------------------------------

  describe("setContext", () => {
    it("should merge context values rather than replacing", () => {
      createMachine({
        id: "ctx",
        name: "Context",
        userId: "u",
        context: { a: 1, b: 2 },
      });

      setContext("ctx", { b: 20, c: 30 });

      const state = getState("ctx");
      expect(state.context).toEqual({ a: 1, b: 20, c: 30 });
    });
  });

  // -----------------------------------------------------------------------
  // resetMachine
  // -----------------------------------------------------------------------

  describe("resetMachine", () => {
    it("should reset to initial state, context, and clear history/log", () => {
      createMachine({
        id: "rm",
        name: "Reset",
        userId: "u",
        initial: "a",
        context: { count: 0 },
        states: {
          a: {
            id: "a",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          b: {
            id: "b",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
        transitions: [
          {
            id: "t1",
            source: "a",
            target: "b",
            event: "GO",
            actions: [{ type: "assign", params: { count: 99 } }],
            internal: false,
          },
        ],
      });

      sendEvent("rm", "GO");
      expect(getState("rm").activeStates).toEqual(["b"]);
      expect(getState("rm").context).toEqual({ count: 99 });
      expect(getHistory("rm")).toHaveLength(1);

      resetMachine("rm");

      expect(getState("rm").activeStates).toEqual(["a"]);
      expect(getState("rm").context).toEqual({ count: 0 });
      expect(getHistory("rm")).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // exportMachine
  // -----------------------------------------------------------------------

  describe("exportMachine", () => {
    it("should export full machine state with all fields", () => {
      createMachine({
        id: "em",
        name: "Export",
        userId: "u",
        initial: "a",
        context: { x: 1 },
        states: {
          a: {
            id: "a",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          b: {
            id: "b",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
        transitions: [
          {
            id: "t1",
            source: "a",
            target: "b",
            event: "GO",
            actions: [],
            internal: false,
          },
        ],
      });

      sendEvent("em", "GO");

      const exp = exportMachine("em");
      expect(exp.definition).toBeDefined();
      expect(exp.definition.id).toBe("em");
      expect(exp.currentStates).toEqual(["b"]);
      expect(exp.context).toEqual({ x: 1 });
      expect(exp.history).toBeDefined();
      expect(exp.transitionLog).toHaveLength(1);
      expect(exp.transitionLog[0]!.event).toBe("GO");
    });
  });
});
