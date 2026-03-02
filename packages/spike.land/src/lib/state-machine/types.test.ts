import { describe, expect, it } from "vitest";
import type {
  Action,
  ActionType,
  Guard,
  HistoryType,
  MachineDefinition,
  MachineExport,
  MachineInstance,
  MachineSummary,
  StateNode,
  StateType,
  Transition,
  TransitionLogEntry,
  ValidationIssue,
} from "./types";

/**
 * Type-level tests for the state-machine data model.
 *
 * These tests verify that the exported types compile correctly and
 * that objects satisfying each interface behave as expected at runtime.
 */

describe("state-machine types", () => {
  describe("literal union types", () => {
    it("should accept all valid StateType values", () => {
      const values: StateType[] = ["atomic", "compound", "parallel", "final", "history"];
      expect(values).toHaveLength(5);
      expect(values).toContain("atomic");
      expect(values).toContain("compound");
      expect(values).toContain("parallel");
      expect(values).toContain("final");
      expect(values).toContain("history");
    });

    it("should accept all valid HistoryType values", () => {
      const values: HistoryType[] = ["shallow", "deep"];
      expect(values).toHaveLength(2);
      expect(values).toContain("shallow");
      expect(values).toContain("deep");
    });

    it("should accept all valid ActionType values", () => {
      const values: ActionType[] = ["assign", "log", "raise", "custom"];
      expect(values).toHaveLength(4);
      expect(values).toContain("assign");
      expect(values).toContain("log");
      expect(values).toContain("raise");
      expect(values).toContain("custom");
    });
  });

  describe("Action interface", () => {
    it("should create a valid assign action", () => {
      const action: Action = {
        type: "assign",
        params: { count: 42, name: "test" },
      };
      expect(action.type).toBe("assign");
      expect(action.params).toEqual({ count: 42, name: "test" });
    });

    it("should create a valid log action", () => {
      const action: Action = {
        type: "log",
        params: { message: "hello" },
      };
      expect(action.type).toBe("log");
      expect(action.params.message).toBe("hello");
    });

    it("should create a valid raise action", () => {
      const action: Action = {
        type: "raise",
        params: { event: "TIMEOUT" },
      };
      expect(action.type).toBe("raise");
      expect(action.params.event).toBe("TIMEOUT");
    });

    it("should create a valid custom action", () => {
      const action: Action = {
        type: "custom",
        params: { name: "sendEmail", to: "user@example.com" },
      };
      expect(action.type).toBe("custom");
      expect(action.params.name).toBe("sendEmail");
    });
  });

  describe("Guard interface", () => {
    it("should create a guard with expression", () => {
      const guard: Guard = {
        expression: "context.count > 0 && context.active == true",
      };
      expect(guard.expression).toContain("context.count");
    });
  });

  describe("Transition interface", () => {
    it("should create a transition without optional fields", () => {
      const transition: Transition = {
        id: "t1",
        source: "idle",
        target: "active",
        event: "START",
        actions: [],
        internal: false,
      };
      expect(transition.id).toBe("t1");
      expect(transition.guard).toBeUndefined();
      expect(transition.delayExpression).toBeUndefined();
      expect(transition.internal).toBe(false);
    });

    it("should create a transition with guard and delay", () => {
      const transition: Transition = {
        id: "t2",
        source: "active",
        target: "timeout",
        event: "TICK",
        guard: { expression: "context.elapsed > 5000" },
        actions: [{ type: "log", params: { message: "timeout" } }],
        internal: false,
        delayExpression: "context.delay",
      };
      expect(transition.guard?.expression).toContain("elapsed");
      expect(transition.delayExpression).toBe("context.delay");
      expect(transition.actions).toHaveLength(1);
    });

    it("should create an internal transition", () => {
      const transition: Transition = {
        id: "t3",
        source: "active",
        target: "active",
        event: "LOG",
        actions: [{ type: "log", params: { message: "internal" } }],
        internal: true,
      };
      expect(transition.internal).toBe(true);
    });
  });

  describe("StateNode interface", () => {
    it("should create an atomic state", () => {
      const state: StateNode = {
        id: "idle",
        type: "atomic",
        children: [],
        entryActions: [],
        exitActions: [],
      };
      expect(state.type).toBe("atomic");
      expect(state.parent).toBeUndefined();
      expect(state.initial).toBeUndefined();
      expect(state.historyType).toBeUndefined();
    });

    it("should create a compound state with children", () => {
      const state: StateNode = {
        id: "main",
        type: "compound",
        children: ["idle", "active", "done"],
        initial: "idle",
        entryActions: [{ type: "log", params: { message: "entering main" } }],
        exitActions: [],
      };
      expect(state.type).toBe("compound");
      expect(state.children).toHaveLength(3);
      expect(state.initial).toBe("idle");
    });

    it("should create a parallel state", () => {
      const state: StateNode = {
        id: "parallel-root",
        type: "parallel",
        children: ["region1", "region2"],
        entryActions: [],
        exitActions: [],
      };
      expect(state.type).toBe("parallel");
      expect(state.children).toHaveLength(2);
    });

    it("should create a history state", () => {
      const state: StateNode = {
        id: "hist",
        type: "history",
        parent: "main",
        children: [],
        entryActions: [],
        exitActions: [],
        historyType: "deep",
      };
      expect(state.historyType).toBe("deep");
    });

    it("should create a final state", () => {
      const state: StateNode = {
        id: "done",
        type: "final",
        parent: "main",
        children: [],
        entryActions: [],
        exitActions: [{ type: "raise", params: { event: "DONE" } }],
      };
      expect(state.type).toBe("final");
      expect(state.exitActions).toHaveLength(1);
    });
  });

  describe("MachineDefinition interface", () => {
    it("should create a complete machine definition", () => {
      const def: MachineDefinition = {
        id: "traffic-light",
        name: "Traffic Light",
        initial: "green",
        states: {
          green: {
            id: "green",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          yellow: {
            id: "yellow",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          red: {
            id: "red",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
        transitions: [
          {
            id: "t1",
            source: "green",
            target: "yellow",
            event: "TIMER",
            actions: [],
            internal: false,
          },
        ],
        context: { count: 0 },
        userId: "user-123",
      };
      expect(def.id).toBe("traffic-light");
      expect(Object.keys(def.states)).toHaveLength(3);
      expect(def.transitions).toHaveLength(1);
      expect(def.context.count).toBe(0);
      expect(def.userId).toBe("user-123");
    });
  });

  describe("TransitionLogEntry interface", () => {
    it("should create a log entry with all fields", () => {
      const entry: TransitionLogEntry = {
        timestamp: Date.now(),
        event: "START",
        fromStates: ["idle"],
        toStates: ["active"],
        beforeContext: { count: 0 },
        afterContext: { count: 1 },
        guardEvaluated: "context.count >= 0",
        actionsExecuted: [{ type: "assign", params: { count: 1 } }],
      };
      expect(entry.fromStates).toEqual(["idle"]);
      expect(entry.toStates).toEqual(["active"]);
      expect(entry.guardEvaluated).toBeDefined();
      expect(entry.actionsExecuted).toHaveLength(1);
    });

    it("should allow optional guardEvaluated", () => {
      const entry: TransitionLogEntry = {
        timestamp: 0,
        event: "NEXT",
        fromStates: ["a"],
        toStates: ["b"],
        beforeContext: {},
        afterContext: {},
        actionsExecuted: [],
      };
      expect(entry.guardEvaluated).toBeUndefined();
    });
  });

  describe("MachineInstance interface", () => {
    it("should create a running machine instance", () => {
      const definition: MachineDefinition = {
        id: "m1",
        name: "Test Machine",
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
        transitions: [],
        context: { x: 0 },
        userId: "u1",
      };

      const instance: MachineInstance = {
        definition,
        currentStates: ["idle"],
        context: { x: 0 },
        history: {},
        transitionLog: [],
        initialContext: { x: 0 },
      };
      expect(instance.currentStates).toEqual(["idle"]);
      expect(instance.history).toEqual({});
      expect(instance.transitionLog).toHaveLength(0);
      expect(instance.initialContext).toEqual({ x: 0 });
    });

    it("should store history for nested states", () => {
      const instance: MachineInstance = {
        definition: {
          id: "m2",
          name: "Nested",
          initial: "main",
          states: {},
          transitions: [],
          context: {},
          userId: "u1",
        },
        currentStates: ["main.active"],
        context: {},
        history: { main: ["active", "sub1"] },
        transitionLog: [],
        initialContext: {},
      };
      expect(instance.history.main).toEqual(["active", "sub1"]);
    });
  });

  describe("ValidationIssue interface", () => {
    it("should create a warning issue", () => {
      const issue: ValidationIssue = {
        level: "warning",
        message: "Unreachable state detected",
        stateId: "orphan-state",
      };
      expect(issue.level).toBe("warning");
      expect(issue.stateId).toBe("orphan-state");
      expect(issue.transitionId).toBeUndefined();
    });

    it("should create an error issue for a transition", () => {
      const issue: ValidationIssue = {
        level: "error",
        message: "Transition target does not exist",
        transitionId: "t-bad",
      };
      expect(issue.level).toBe("error");
      expect(issue.transitionId).toBe("t-bad");
      expect(issue.stateId).toBeUndefined();
    });
  });

  describe("MachineExport interface", () => {
    it("should create a machine export snapshot", () => {
      const exp: MachineExport = {
        definition: {
          id: "m1",
          name: "Export Test",
          initial: "idle",
          states: {},
          transitions: [],
          context: { val: 42 },
          userId: "u1",
        },
        currentStates: ["active"],
        context: { val: 43 },
        history: { parent: ["child1"] },
        transitionLog: [
          {
            timestamp: 1000,
            event: "GO",
            fromStates: ["idle"],
            toStates: ["active"],
            beforeContext: { val: 42 },
            afterContext: { val: 43 },
            actionsExecuted: [],
          },
        ],
      };
      expect(exp.currentStates).toEqual(["active"]);
      expect(exp.transitionLog).toHaveLength(1);
      expect(exp.history.parent).toEqual(["child1"]);
    });
  });

  describe("MachineSummary interface", () => {
    it("should create a machine summary", () => {
      const summary: MachineSummary = {
        id: "m1",
        name: "Traffic Light",
        currentStates: ["green"],
        stateCount: 3,
        transitionCount: 3,
      };
      expect(summary.id).toBe("m1");
      expect(summary.name).toBe("Traffic Light");
      expect(summary.currentStates).toEqual(["green"]);
      expect(summary.stateCount).toBe(3);
      expect(summary.transitionCount).toBe(3);
    });
  });
});
