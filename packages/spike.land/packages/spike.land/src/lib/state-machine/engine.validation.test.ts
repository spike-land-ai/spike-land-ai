import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addState,
  addTransition,
  clearMachines,
  createMachine,
  getSharedMachine,
  getState,
  sendEvent,
  shareMachine,
  validateMachine,
} from "./engine";
import type { MachineExport } from "./types";

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

describe("state machine engine - validation, sharing & guards", () => {
  beforeEach(() => {
    clearMachines();
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // validateMachine
  // -----------------------------------------------------------------------

  describe("validateMachine", () => {
    it("should report error for compound state missing initial", () => {
      createMachine({ id: "vm1", name: "V", userId: "u" });
      addState("vm1", {
        id: "parent",
        type: "compound",
        // no initial specified
      });

      const issues = validateMachine("vm1");
      const errors = issues.filter(i => i.level === "error");
      expect(errors.some(e => e.message.includes("missing an initial"))).toBe(
        true,
      );
    });

    it("should warn about unreachable states", () => {
      createMachine({
        id: "vm2",
        name: "V",
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
          orphan: {
            id: "orphan",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
      });

      const issues = validateMachine("vm2");
      const warnings = issues.filter(i => i.level === "warning");
      expect(
        warnings.some(w => w.message.includes("\"orphan\"") && w.message.includes("unreachable")),
      ).toBe(true);
    });

    it("should warn about dead-end states", () => {
      createMachine({
        id: "vm3",
        name: "V",
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
          deadEnd: {
            id: "deadEnd",
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
            target: "deadEnd",
            event: "GO",
            actions: [],
            internal: false,
          },
        ],
      });

      const issues = validateMachine("vm3");
      const warnings = issues.filter(i => i.level === "warning");
      expect(
        warnings.some(
          w => w.message.includes("\"deadEnd\"") && w.message.includes("dead-end"),
        ),
      ).toBe(true);
    });

    it("should report error for transition referencing non-existent state", () => {
      createMachine({ id: "vm4", name: "V", userId: "u" });
      addState("vm4", { id: "a", type: "atomic" });
      addTransition("vm4", {
        id: "bad-t",
        source: "a",
        target: "nonexistent",
        event: "GO",
        actions: [],
        internal: false,
      });

      const issues = validateMachine("vm4");
      const errors = issues.filter(i => i.level === "error");
      expect(
        errors.some(e => e.message.includes("non-existent target")),
      ).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // shareMachine & getSharedMachine
  // -----------------------------------------------------------------------

  describe("shareMachine & getSharedMachine", () => {
    it("should share a machine and return a token", async () => {
      createMachine({ id: "m1", name: "Shared Machine", userId: "user-1" });
      mockPrisma.stateMachine.findFirst.mockResolvedValue(null);
      mockPrisma.stateMachine.upsert.mockResolvedValue({
        shareToken: "token-123",
      });

      const token = await shareMachine("m1", "user-1");
      expect(token).toBeDefined();
      expect(mockPrisma.stateMachine.upsert).toHaveBeenCalled();
    });

    it("should retrieve a shared machine by token", async () => {
      const mockShared = {
        name: "Shared Machine",
        definition: {
          states: {},
          transitions: [],
          name: "Shared Machine",
          initial: "",
          id: "m1",
          userId: "u1",
          context: {},
        },
        currentStates: ["idle"],
        context: {},
        history: {},
        transitionLog: [],
      };
      mockPrisma.stateMachine.findUnique.mockResolvedValue(mockShared);

      const machine = await getSharedMachine("token-123");
      expect(machine.definition.name).toBe("Shared Machine");
      expect(machine.currentStates).toEqual(["idle"]);
    });

    it("should throw error if shared machine not found", async () => {
      mockPrisma.stateMachine.findUnique.mockResolvedValue(null);
      await expect(getSharedMachine("invalid")).rejects.toThrow(
        "Shared state machine not found",
      );
    });
  });

  // -----------------------------------------------------------------------
  // Guard parser edge cases
  // -----------------------------------------------------------------------

  describe("guard parser edge cases", () => {
    function createGuardTestMachine(
      guardExpr: string,
      ctx: Record<string, unknown>,
    ) {
      createMachine({
        id: "gp",
        name: "GuardParser",
        userId: "u",
        initial: "start",
        context: ctx,
        states: {
          start: {
            id: "start",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          end: {
            id: "end",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
        transitions: [
          {
            id: "t1",
            source: "start",
            target: "end",
            event: "CHECK",
            guard: { expression: guardExpr },
            actions: [],
            internal: false,
          },
        ],
      });
    }

    it("should evaluate string comparison: context.name == \"hello\"", () => {
      createGuardTestMachine("context.name == \"hello\"", { name: "hello" });
      sendEvent("gp", "CHECK");
      expect(getState("gp").activeStates).toEqual(["end"]);
    });

    it("should reject string comparison when value does not match", () => {
      createGuardTestMachine("context.name == \"hello\"", { name: "world" });
      expect(() => sendEvent("gp", "CHECK")).toThrow("No matching transition");
    });

    it("should evaluate boolean: context.active == true", () => {
      createGuardTestMachine("context.active == true", { active: true });
      sendEvent("gp", "CHECK");
      expect(getState("gp").activeStates).toEqual(["end"]);
    });

    it("should evaluate negation: !context.disabled", () => {
      createGuardTestMachine("!context.disabled", { disabled: false });
      sendEvent("gp", "CHECK");
      expect(getState("gp").activeStates).toEqual(["end"]);
    });

    it("should block negation when value is truthy", () => {
      createGuardTestMachine("!context.disabled", { disabled: true });
      expect(() => sendEvent("gp", "CHECK")).toThrow("No matching transition");
    });

    it("should evaluate compound: context.x > 0 && context.y < 10", () => {
      createGuardTestMachine("context.x > 0 && context.y < 10", {
        x: 5,
        y: 3,
      });
      sendEvent("gp", "CHECK");
      expect(getState("gp").activeStates).toEqual(["end"]);
    });

    it("should block compound when one condition fails", () => {
      createGuardTestMachine("context.x > 0 && context.y < 10", {
        x: 5,
        y: 20,
      });
      expect(() => sendEvent("gp", "CHECK")).toThrow("No matching transition");
    });

    it("should evaluate parentheses: (context.a || context.b) && context.c", () => {
      createGuardTestMachine(
        "(context.a || context.b) && context.c",
        { a: false, b: true, c: true },
      );
      sendEvent("gp", "CHECK");
      expect(getState("gp").activeStates).toEqual(["end"]);
    });

    it("should block parenthesized expression when outer AND fails", () => {
      createGuardTestMachine(
        "(context.a || context.b) && context.c",
        { a: true, b: false, c: false },
      );
      expect(() => sendEvent("gp", "CHECK")).toThrow("No matching transition");
    });

    it("should throw on invalid guard expression", () => {
      createGuardTestMachine("@@@invalid", {});
      expect(() => sendEvent("gp", "CHECK")).toThrow("Guard parse error");
    });

    it("should evaluate != operator", () => {
      createGuardTestMachine("context.status != 0", { status: 1 });
      sendEvent("gp", "CHECK");
      expect(getState("gp").activeStates).toEqual(["end"]);
    });

    it("should evaluate >= and <= operators", () => {
      createGuardTestMachine("context.val >= 5", { val: 5 });
      sendEvent("gp", "CHECK");
      expect(getState("gp").activeStates).toEqual(["end"]);
    });

    it("should evaluate || (or) operator", () => {
      clearMachines();
      createGuardTestMachine("context.a || context.b", { a: false, b: true });
      sendEvent("gp", "CHECK");
      expect(getState("gp").activeStates).toEqual(["end"]);
    });

    it("should respect operator precedence: comparison RHS allows arithmetic", () => {
      // count > 1 + 2 should parse as count > (1 + 2) = count > 3
      // With count=2, 2 > 3 is false, so guard should block
      createGuardTestMachine("context.count > 1 + 2", { count: 2 });
      expect(() => sendEvent("gp", "CHECK")).toThrow("No matching transition");
    });

    it("should allow transition when arithmetic RHS evaluates correctly", () => {
      // count > 1 + 2 means count > 3; with count=5, 5 > 3 is true
      createGuardTestMachine("context.count > 1 + 2", { count: 5 });
      sendEvent("gp", "CHECK");
      expect(getState("gp").activeStates).toEqual(["end"]);
    });

    it("should evaluate subtraction where right operand is a digit literal", () => {
      // context.count - 1 > 0 with count=2 means 2-1=1 > 0, which is true
      createGuardTestMachine("context.count - 1 > 0", { count: 2 });
      sendEvent("gp", "CHECK");
      expect(getState("gp").activeStates).toEqual(["end"]);
    });

    it("should not transition when subtraction result fails comparison", () => {
      // context.count - 1 > 0 with count=1 means 1-1=0 > 0, which is false
      createGuardTestMachine("context.count - 1 > 0", { count: 1 });
      expect(() => sendEvent("gp", "CHECK")).toThrow("No matching transition");
    });

    it("should throw on division by zero in guard expression", () => {
      createGuardTestMachine("context.x / 0 > 1", { x: 10 });
      expect(() => sendEvent("gp", "CHECK")).toThrow("Division by zero");
    });
  });

  // -----------------------------------------------------------------------
  // validateMachine detailed checks
  // -----------------------------------------------------------------------

  describe("validateMachine detailed checks", () => {
    it("should detect transitions to non-existent states", () => {
      const machineId = "val1";
      createMachine({
        id: machineId,
        name: "M",
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
        },
        transitions: [
          {
            id: "t1",
            source: "a",
            target: "nonexistent",
            event: "GO",
            actions: [],
            internal: false,
          },
        ],
      });

      const issues = validateMachine(machineId);
      expect(
        issues.some(i =>
          i.message.includes(
            "references non-existent target state \"nonexistent\"",
          )
        ),
      ).toBe(true);
    });

    it("should detect transitions from non-existent states", () => {
      const machineId = "val2";
      createMachine({
        id: machineId,
        name: "M",
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
        },
        transitions: [
          {
            id: "t1",
            source: "ghost",
            target: "a",
            event: "GO",
            actions: [],
            internal: false,
          },
        ],
      });

      const issues = validateMachine(machineId);
      expect(
        issues.some(i => i.message.includes("references non-existent source state \"ghost\"")),
      ).toBe(true);
    });

    it("should detect duplicate transition IDs", () => {
      const machineId = "val3";
      createMachine({
        id: machineId,
        name: "M",
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
        },
        transitions: [
          {
            id: "dup",
            source: "a",
            target: "b",
            event: "GO",
            actions: [],
            internal: false,
          },
          {
            id: "dup",
            source: "b",
            target: "a",
            event: "BACK",
            actions: [],
            internal: false,
          },
        ],
      });

      const issues = validateMachine(machineId);
      expect(
        issues.some(i => i.message.includes("Duplicate transition ID \"dup\"")),
      ).toBe(true);
    });

    it("should detect compound state missing initial child", () => {
      const machineId = "val4";
      createMachine({
        id: machineId,
        name: "M",
        userId: "u",
        states: {
          parent: {
            id: "parent",
            type: "compound",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
      });

      // Manually mess with definition to bypass any createMachine checks if any
      const issues = validateMachine(machineId);
      expect(
        issues.some(i =>
          i.message.includes(
            "Compound state \"parent\" is missing an initial child state",
          )
        ),
      ).toBe(true);
    });

    it("should warn about unreachable and dead-end states", () => {
      const machineId = "val5";
      createMachine({
        id: machineId,
        name: "M",
        userId: "u",
        initial: "start",
        states: {
          start: {
            id: "start",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          lonely: {
            id: "lonely",
            type: "atomic",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
      });

      const issues = validateMachine(machineId);
      expect(
        issues.some(i =>
          i.level === "warning"
          && i.message.includes("State \"lonely\" is unreachable")
        ),
      ).toBe(true);
      expect(
        issues.some(i => i.level === "warning" && i.message.includes("is a dead-end")),
      ).toBe(true);
    });

    it("should error when machine initial state does not exist in states", () => {
      const machineId = "val6";
      createMachine({
        id: machineId,
        name: "BadInitial",
        userId: "u",
        initial: "nonexistent",
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

      const issues = validateMachine(machineId);
      expect(
        issues.some(i =>
          i.level === "error"
          && i.message.includes("nonexistent")
          && i.message.includes("does not exist")
        ),
      ).toBe(true);
    });

    it("should error when compound state initial child does not exist in states", () => {
      // Create without initial to avoid resolveEntry throwing on creation
      const machineId = "val7";
      createMachine({
        id: machineId,
        name: "BadCompoundInitial",
        userId: "u",
      });
      // Directly add a compound state with a non-existent initial child via addState
      addState(machineId, {
        id: "parent",
        type: "compound",
        initial: "missingChild",
        children: [],
      });

      const issues = validateMachine(machineId);
      expect(
        issues.some(i =>
          i.level === "error"
          && i.message.includes("missingChild")
          && i.message.includes("does not exist")
        ),
      ).toBe(true);
    });

    it("should not flag parallel state children as unreachable", () => {
      const machineId = "val8";
      createMachine({
        id: machineId,
        name: "ParallelChildren",
        userId: "u",
        initial: "root",
        states: {
          root: {
            id: "root",
            type: "parallel",
            children: ["regionA", "regionB"],
            entryActions: [],
            exitActions: [],
          },
          regionA: {
            id: "regionA",
            type: "atomic",
            parent: "root",
            children: [],
            entryActions: [],
            exitActions: [],
          },
          regionB: {
            id: "regionB",
            type: "atomic",
            parent: "root",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
      });

      const issues = validateMachine(machineId);
      expect(
        issues.some(i => i.message.includes("regionA") && i.message.includes("unreachable")),
      ).toBe(false);
      expect(
        issues.some(i => i.message.includes("regionB") && i.message.includes("unreachable")),
      ).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // shareMachine & getSharedMachine (detailed)
  // -----------------------------------------------------------------------

  describe("shareMachine & getSharedMachine (detailed)", () => {
    it("should share a machine and retrieve it", async () => {
      const machineId = "s1";
      createMachine({ id: machineId, name: "Shared Machine", userId: "u1" });
      mockPrisma.stateMachine.findFirst.mockResolvedValue(null);
      mockPrisma.stateMachine.upsert.mockResolvedValue({
        id: "db1",
        shareToken: "token123",
      });

      const token = await shareMachine(machineId, "u1");
      expect(token).toBeDefined();
      expect(mockPrisma.stateMachine.upsert).toHaveBeenCalled();

      mockPrisma.stateMachine.findUnique.mockResolvedValue({
        id: "db1",
        shareToken: "token123",
        name: "Shared Machine",
        definition: {
          id: machineId,
          name: "Shared Machine",
          states: {},
          transitions: [],
        },
        currentStates: [],
        context: {},
        history: {},
        transitionLog: [],
      });

      const shared = await getSharedMachine("token123");
      expect(shared.definition.name).toBe("Shared Machine");
    });

    it("should update existing shared machine", async () => {
      const machineId = "s2";
      createMachine({ id: machineId, name: "Existing", userId: "u1" });
      mockPrisma.stateMachine.findFirst.mockResolvedValue({
        id: "db2",
        shareToken: "token456",
      });

      await shareMachine(machineId, "u1");

      expect(mockPrisma.stateMachine.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "db2" },
        }),
      );
    });

    it("should share with provided machineData", async () => {
      mockPrisma.stateMachine.findFirst.mockResolvedValue(null);
      const machineExport: MachineExport = {
        definition: {
          id: "m-external",
          name: "External",
          states: {},
          transitions: [],
          userId: "u1",
          initial: "idle",
          context: {},
        },
        currentStates: ["idle"],
        context: { x: 1 },
        history: {},
        transitionLog: [],
      };

      const token = await shareMachine("ignored", "u1", machineExport);
      expect(token).toBeDefined();
      expect(mockPrisma.stateMachine.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            name: "External",
          }),
        }),
      );
    });

    it("should throw for non-existent shared machine", async () => {
      mockPrisma.stateMachine.findUnique.mockResolvedValue(null);
      await expect(getSharedMachine("nope")).rejects.toThrow(
        "Shared state machine not found",
      );
    });
  });
});
