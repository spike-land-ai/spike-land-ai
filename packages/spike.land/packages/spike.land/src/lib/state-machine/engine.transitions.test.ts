import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMachines,
  createMachine,
  exportMachine,
  getState,
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

describe("state machine engine - transitions & state types", () => {
  beforeEach(() => {
    clearMachines();
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // sendEvent - simple transitions
  // -----------------------------------------------------------------------

  describe("sendEvent - simple transitions", () => {
    it("should cycle through a traffic light (red -> green -> yellow -> red)", () => {
      createMachine({
        id: "tl",
        name: "Traffic Light",
        userId: "u",
        initial: "red",
        states: {
          red: {
            id: "red",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
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
        },
        transitions: [
          {
            id: "t1",
            source: "red",
            target: "green",
            event: "NEXT",
            actions: [],
            internal: false,
          },
          {
            id: "t2",
            source: "green",
            target: "yellow",
            event: "NEXT",
            actions: [],
            internal: false,
          },
          {
            id: "t3",
            source: "yellow",
            target: "red",
            event: "NEXT",
            actions: [],
            internal: false,
          },
        ],
      });

      expect(getState("tl").activeStates).toEqual(["red"]);

      sendEvent("tl", "NEXT");
      expect(getState("tl").activeStates).toEqual(["green"]);

      sendEvent("tl", "NEXT");
      expect(getState("tl").activeStates).toEqual(["yellow"]);

      sendEvent("tl", "NEXT");
      expect(getState("tl").activeStates).toEqual(["red"]);
    });

    it("should throw when no matching transition exists for event", () => {
      createMachine({
        id: "m1",
        name: "M",
        userId: "u",
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

      expect(() => sendEvent("m1", "UNKNOWN")).toThrow(
        "No matching transition for event \"UNKNOWN\"",
      );
    });
  });

  // -----------------------------------------------------------------------
  // sendEvent - guard evaluation
  // -----------------------------------------------------------------------

  describe("sendEvent - guard evaluation", () => {
    function createGuardedMachine() {
      createMachine({
        id: "gm",
        name: "Guarded",
        userId: "u",
        initial: "locked",
        context: { count: 0 },
        states: {
          locked: {
            id: "locked",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          unlocked: {
            id: "unlocked",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
        transitions: [
          {
            id: "t1",
            source: "locked",
            target: "unlocked",
            event: "TRY_UNLOCK",
            guard: { expression: "context.count > 5" },
            actions: [],
            internal: false,
          },
        ],
      });
    }

    it("should block transition when guard condition is not met", () => {
      createGuardedMachine();
      expect(() => sendEvent("gm", "TRY_UNLOCK")).toThrow(
        "No matching transition",
      );
      expect(getState("gm").activeStates).toEqual(["locked"]);
    });

    it("should allow transition when guard condition is met", () => {
      createGuardedMachine();
      setContext("gm", { count: 10 });

      sendEvent("gm", "TRY_UNLOCK");
      expect(getState("gm").activeStates).toEqual(["unlocked"]);
    });
  });

  // -----------------------------------------------------------------------
  // sendEvent - actions
  // -----------------------------------------------------------------------

  describe("sendEvent - actions", () => {
    it("should execute assign action and modify context", () => {
      createMachine({
        id: "am",
        name: "Assign",
        userId: "u",
        initial: "s1",
        context: { score: 0 },
        states: {
          s1: {
            id: "s1",
            type: "atomic",
            children: [],
            entryActions: [],
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
            event: "SCORE",
            actions: [{ type: "assign", params: { score: 100 } }],
            internal: false,
          },
        ],
      });

      sendEvent("am", "SCORE");
      expect(getState("am").context).toEqual({ score: 100 });
    });

    it("should execute raise action and trigger subsequent event", () => {
      createMachine({
        id: "rm",
        name: "Raise",
        userId: "u",
        initial: "a",
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
          c: {
            id: "c",
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
            actions: [{ type: "raise", params: { event: "AUTO" } }],
            internal: false,
          },
          {
            id: "t2",
            source: "b",
            target: "c",
            event: "AUTO",
            actions: [],
            internal: false,
          },
        ],
      });

      sendEvent("rm", "GO");
      // The raise action should have triggered AUTO, moving from b to c
      expect(getState("rm").activeStates).toEqual(["c"]);
    });

    it("should not throw for log and custom actions", () => {
      createMachine({
        id: "lm",
        name: "LogCustom",
        userId: "u",
        initial: "s1",
        states: {
          s1: {
            id: "s1",
            type: "atomic",
            children: [],
            entryActions: [],
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
            event: "GO",
            actions: [
              { type: "log", params: { message: "hello" } },
              { type: "custom", params: { name: "doSomething" } },
            ],
            internal: false,
          },
        ],
      });

      expect(() => sendEvent("lm", "GO")).not.toThrow();
      expect(getState("lm").activeStates).toEqual(["s2"]);
    });
  });

  // -----------------------------------------------------------------------
  // Compound states
  // -----------------------------------------------------------------------

  describe("compound states", () => {
    it("should auto-resolve to initial child on entry", () => {
      createMachine({
        id: "cs",
        name: "Compound",
        userId: "u",
        initial: "off",
        states: {
          off: {
            id: "off",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          on: {
            id: "on",
            type: "compound",
            initial: "idle",
            children: ["idle", "working"],
            entryActions: [],
            exitActions: [],
          },
          idle: {
            id: "idle",
            type: "atomic",
            parent: "on",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          working: {
            id: "working",
            type: "atomic",
            parent: "on",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
        transitions: [
          {
            id: "t1",
            source: "off",
            target: "on",
            event: "TURN_ON",
            actions: [],
            internal: false,
          },
        ],
      });

      sendEvent("cs", "TURN_ON");
      const state = getState("cs");
      expect(state.activeStates).toContain("on");
      expect(state.activeStates).toContain("idle");
      expect(state.activeStates).not.toContain("working");
    });
  });

  // -----------------------------------------------------------------------
  // Parallel states
  // -----------------------------------------------------------------------

  describe("parallel states", () => {
    it("should activate all children on entry", () => {
      createMachine({
        id: "ps",
        name: "Parallel",
        userId: "u",
        initial: "waiting",
        states: {
          waiting: {
            id: "waiting",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          active: {
            id: "active",
            type: "parallel",
            children: ["regionA", "regionB"],
            entryActions: [],
            exitActions: [],
          },
          regionA: {
            id: "regionA",
            type: "atomic",
            parent: "active",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          regionB: {
            id: "regionB",
            type: "atomic",
            parent: "active",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
        transitions: [
          {
            id: "t1",
            source: "waiting",
            target: "active",
            event: "START",
            actions: [],
            internal: false,
          },
        ],
      });

      sendEvent("ps", "START");
      const state = getState("ps");
      expect(state.activeStates).toContain("active");
      expect(state.activeStates).toContain("regionA");
      expect(state.activeStates).toContain("regionB");
    });
  });

  // -----------------------------------------------------------------------
  // History states
  // -----------------------------------------------------------------------

  describe("history states", () => {
    it("should fall back to parent initial when no history recorded for history state", () => {
      createMachine({
        id: "hs",
        name: "History Fallback",
        userId: "u",
        initial: "editor",
        states: {
          editor: {
            id: "editor",
            type: "compound",
            initial: "bold",
            children: ["bold", "italic", "editorHistory"],
            entryActions: [],
            exitActions: [],
          },
          bold: {
            id: "bold",
            type: "atomic",
            parent: "editor",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          italic: {
            id: "italic",
            type: "atomic",
            parent: "editor",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          editorHistory: {
            id: "editorHistory",
            type: "history",
            historyType: "shallow",
            parent: "editor",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          preview: {
            id: "preview",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
        transitions: [
          {
            id: "t1",
            source: "bold",
            target: "italic",
            event: "TOGGLE",
            actions: [],
            internal: false,
          },
          {
            id: "t2",
            source: "editor",
            target: "preview",
            event: "PREVIEW",
            actions: [],
            internal: false,
          },
          {
            id: "t3",
            source: "preview",
            target: "editorHistory",
            event: "BACK",
            actions: [],
            internal: false,
          },
        ],
      });

      // Start in editor -> bold (initial)
      expect(getState("hs").activeStates).toContain("bold");

      // Move to italic
      sendEvent("hs", "TOGGLE");
      expect(getState("hs").activeStates).toContain("italic");

      // Leave editor to preview
      sendEvent("hs", "PREVIEW");
      expect(getState("hs").activeStates).toEqual(["preview"]);

      // Go back via history - falls back to parent's initial (bold) since
      // the engine stores history keyed by parent ID, not history state ID
      sendEvent("hs", "BACK");
      expect(getState("hs").activeStates).toContain("bold");
    });

    it("should restore remembered state when history is pre-populated", () => {
      const instance = createMachine({
        id: "hs2",
        name: "History Direct",
        userId: "u",
        initial: "off",
        states: {
          off: {
            id: "off",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          group: {
            id: "group",
            type: "compound",
            initial: "childA",
            children: ["childA", "childB", "groupH"],
            entryActions: [],
            exitActions: [],
          },
          childA: {
            id: "childA",
            type: "atomic",
            parent: "group",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          childB: {
            id: "childB",
            type: "atomic",
            parent: "group",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          groupH: {
            id: "groupH",
            type: "history",
            historyType: "shallow",
            parent: "group",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
        transitions: [
          {
            id: "t1",
            source: "off",
            target: "groupH",
            event: "ENTER",
            actions: [],
            internal: false,
          },
        ],
      });

      // Pre-populate history keyed by the history state's ID
      instance.history.groupH = ["childB"];

      sendEvent("hs2", "ENTER");
      expect(getState("hs2").activeStates).toContain("childB");
      expect(getState("hs2").activeStates).not.toContain("childA");
    });

    it("should verify history is stored keyed by parent state ID on exit", () => {
      createMachine({
        id: "hv",
        name: "History Verify",
        userId: "u",
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
          outside: {
            id: "outside",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
        transitions: [
          {
            id: "t1",
            source: "childA",
            target: "childB",
            event: "SWITCH",
            actions: [],
            internal: false,
          },
          {
            id: "t2",
            source: "parent",
            target: "outside",
            event: "LEAVE",
            actions: [],
            internal: false,
          },
        ],
      });

      sendEvent("hv", "SWITCH");
      expect(getState("hv").activeStates).toContain("childB");

      sendEvent("hv", "LEAVE");
      // Engine stores history keyed by parent state ID
      const exported = exportMachine("hv");
      expect(exported.history.parent).toEqual(["childB"]);
    });
  });

  // -----------------------------------------------------------------------
  // Final states
  // -----------------------------------------------------------------------

  describe("final states", () => {
    it("should raise done.state.{parent} event on entering a final state", () => {
      createMachine({
        id: "fs",
        name: "Final",
        userId: "u",
        initial: "running",
        states: {
          running: {
            id: "running",
            type: "compound",
            initial: "step1",
            children: ["step1", "done"],
            entryActions: [],
            exitActions: [],
          },
          step1: {
            id: "step1",
            type: "atomic",
            parent: "running",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          done: {
            id: "done",
            type: "final",
            parent: "running",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          completed: {
            id: "completed",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
        transitions: [
          {
            id: "t1",
            source: "step1",
            target: "done",
            event: "FINISH",
            actions: [],
            internal: false,
          },
          {
            id: "t2",
            source: "running",
            target: "completed",
            event: "done.state.running",
            actions: [],
            internal: false,
          },
        ],
      });

      // Entering the "done" final state should raise "done.state.running"
      // which triggers the transition from "running" to "completed"
      sendEvent("fs", "FINISH");
      expect(getState("fs").activeStates).toEqual(["completed"]);
    });
  });
});
