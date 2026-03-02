/**
 * State Machine Standalone Tools — Tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockContext, createMockRegistry } from "../shared/test-utils";
import { stateMachineTools } from "./tools";

// Track machines in a Map
const machineStore = new Map<
  string,
  {
    definition: {
      id: string;
      name: string;
      initial: string;
      states: Record<
        string,
        {
          id: string;
          type: string;
          parent?: string;
          initial?: string;
          entryActions: unknown[];
          exitActions: unknown[];
          historyType?: string;
        }
      >;
      transitions: Array<{
        id: string;
        source: string;
        target: string;
        event: string;
        guard?: { expression: string };
        actions: unknown[];
        internal: boolean;
      }>;
    };
    currentStates: string[];
    context: Record<string, unknown>;
  }
>();

let nextId = 0;

vi.mock("@/lib/state-machine/engine", () => ({
  createMachine: vi
    .fn()
    .mockImplementation(
      (opts: {
        name: string;
        initial: string;
        context: Record<string, unknown>;
        userId: string;
      }) => {
        const id = `machine-${++nextId}`;
        const machine = {
          definition: {
            id,
            name: opts.name,
            initial: opts.initial,
            states: {},
            transitions: [],
          },
          currentStates: opts.initial ? [opts.initial] : [],
          context: opts.context,
        };
        machineStore.set(id, machine);
        return { definition: machine.definition };
      },
    ),
  addState: vi.fn().mockImplementation(
    (
      machineId: string,
      state: {
        id: string;
        type: string;
        parent?: string;
        initial?: string;
        entryActions?: unknown[];
        exitActions?: unknown[];
        historyType?: string;
      },
    ) => {
      const m = machineStore.get(machineId);
      if (!m) throw new Error(`Machine ${machineId} not found`);
      m.definition.states[state.id] = {
        id: state.id,
        type: state.type,
        parent: state.parent,
        initial: state.initial,
        entryActions: state.entryActions ?? [],
        exitActions: state.exitActions ?? [],
        historyType: state.historyType,
      };
      return m.definition.states[state.id];
    },
  ),
  removeState: vi.fn().mockImplementation((machineId: string, stateId: string) => {
    const m = machineStore.get(machineId);
    if (!m) throw new Error(`Machine ${machineId} not found`);
    delete m.definition.states[stateId];
  }),
  addTransition: vi.fn().mockImplementation(
    (
      machineId: string,
      tr: {
        source: string;
        target: string;
        event: string;
        guard?: { expression: string };
        actions?: unknown[];
        internal?: boolean;
      },
    ) => {
      const m = machineStore.get(machineId);
      if (!m) throw new Error(`Machine ${machineId} not found`);
      const t = {
        id: `tr-${++nextId}`,
        ...tr,
        actions: tr.actions ?? [],
        internal: tr.internal ?? false,
      };
      m.definition.transitions.push(t);
      return t;
    },
  ),
  removeTransition: vi.fn(),
  setContext: vi.fn().mockImplementation((machineId: string, ctx: Record<string, unknown>) => {
    const m = machineStore.get(machineId);
    if (!m) throw new Error(`Machine ${machineId} not found`);
    Object.assign(m.context, ctx);
  }),
  getState: vi.fn().mockImplementation((machineId: string) => {
    const m = machineStore.get(machineId);
    if (!m) throw new Error(`Machine ${machineId} not found`);
    return { activeStates: m.currentStates, context: m.context };
  }),
  sendEvent: vi.fn().mockImplementation((machineId: string, event: string) => {
    const m = machineStore.get(machineId);
    if (!m) throw new Error(`Machine ${machineId} not found`);
    const from = [...m.currentStates];
    const matching = m.definition.transitions.find(
      (t) => t.source === m.currentStates[0] && t.event === event,
    );
    if (!matching) throw new Error(`No transition for event ${event}`);
    m.currentStates = [matching.target];
    return {
      fromStates: from,
      toStates: [matching.target],
      guardEvaluated: null,
      actionsExecuted: [],
    };
  }),
  getHistory: vi.fn().mockReturnValue([]),
  resetMachine: vi.fn().mockImplementation((machineId: string) => {
    const m = machineStore.get(machineId);
    if (m && m.definition.initial) {
      m.currentStates = [m.definition.initial];
    }
  }),
  validateMachine: vi.fn().mockReturnValue([]),
  exportMachine: vi.fn().mockImplementation((machineId: string) => {
    const m = machineStore.get(machineId);
    if (!m) throw new Error(`Machine ${machineId} not found`);
    return {
      definition: m.definition,
      currentStates: m.currentStates,
      context: m.context,
      history: [],
      transitionLog: [],
    };
  }),
  listMachines: vi.fn().mockReturnValue([]),
  shareMachine: vi.fn().mockResolvedValue("share-token-123"),
  getSharedMachine: vi.fn().mockResolvedValue({ definition: {}, currentStates: [], context: {} }),
}));

vi.mock("@/lib/state-machine/visualizer-template", () => ({
  generateVisualizerCode: vi.fn().mockReturnValue("// visualizer code"),
}));

describe("state-machine standalone tools", () => {
  const registry = createMockRegistry(stateMachineTools);

  beforeEach(() => {
    machineStore.clear();
    nextId = 0;
  });

  it("exports expected tool count", () => {
    // 16 core + 4 template = 20
    expect(registry.getToolNames().length).toBe(20);
  });

  it("has state-machine category tools", () => {
    const smTools = registry.getToolsByCategory("state-machine");
    expect(smTools.length).toBe(16);
  });

  it("has sm-templates category tools", () => {
    const tplTools = registry.getToolsByCategory("sm-templates");
    expect(tplTools.length).toBe(4);
  });

  describe("sm_create", () => {
    it("creates a new machine", async () => {
      const ctx = createMockContext();
      const result = await registry.call(
        "sm_create",
        { name: "test-machine", initial_state: "idle" },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Machine Created");
      expect(text).toContain("test-machine");
    });
  });

  describe("sm_add_state", () => {
    it("adds a state to a machine", async () => {
      const ctx = createMockContext();
      await registry.call("sm_create", { name: "m1", initial_state: "idle" }, ctx);
      const result = await registry.call(
        "sm_add_state",
        { machine_id: "machine-1", state_id: "idle", type: "atomic" },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("State Added");
    });
  });

  describe("sm_add_transition", () => {
    it("adds a transition", async () => {
      const ctx = createMockContext();
      await registry.call("sm_create", { name: "m1", initial_state: "idle" }, ctx);
      await registry.call(
        "sm_add_state",
        {
          machine_id: "machine-1",
          state_id: "idle",
          type: "atomic",
        },
        ctx,
      );
      await registry.call(
        "sm_add_state",
        {
          machine_id: "machine-1",
          state_id: "active",
          type: "atomic",
        },
        ctx,
      );

      const result = await registry.call(
        "sm_add_transition",
        { machine_id: "machine-1", source: "idle", target: "active", event: "START" },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Transition Added");
    });
  });

  describe("sm_send_event", () => {
    it("processes an event", async () => {
      const ctx = createMockContext();
      await registry.call("sm_create", { name: "m1", initial_state: "idle" }, ctx);
      await registry.call(
        "sm_add_state",
        {
          machine_id: "machine-1",
          state_id: "idle",
          type: "atomic",
        },
        ctx,
      );
      await registry.call(
        "sm_add_state",
        {
          machine_id: "machine-1",
          state_id: "active",
          type: "atomic",
        },
        ctx,
      );
      await registry.call(
        "sm_add_transition",
        {
          machine_id: "machine-1",
          source: "idle",
          target: "active",
          event: "START",
        },
        ctx,
      );

      const result = await registry.call(
        "sm_send_event",
        { machine_id: "machine-1", event: "START" },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Event Processed: START");
    });
  });

  describe("sm_get_state", () => {
    it("returns current state", async () => {
      const ctx = createMockContext();
      await registry.call("sm_create", { name: "m1", initial_state: "idle" }, ctx);
      const result = await registry.call("sm_get_state", { machine_id: "machine-1" }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Current State");
      expect(text).toContain("idle");
    });
  });

  describe("sm_validate", () => {
    it("returns no issues for valid machine", async () => {
      const ctx = createMockContext();
      await registry.call("sm_create", { name: "m1", initial_state: "idle" }, ctx);
      const result = await registry.call("sm_validate", { machine_id: "machine-1" }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("No issues found");
    });
  });

  describe("sm_export", () => {
    it("exports machine as JSON", async () => {
      const ctx = createMockContext();
      await registry.call("sm_create", { name: "m1", initial_state: "idle" }, ctx);
      const result = await registry.call("sm_export", { machine_id: "machine-1" }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Machine Export");
    });
  });

  describe("sm_list_templates", () => {
    it("lists all templates", async () => {
      const result = await registry.call("sm_list_templates", {});
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("State Machine Templates");
      expect(text).toContain("auth-flow");
      expect(text).toContain("shopping-cart");
    });

    it("filters by category", async () => {
      const result = await registry.call("sm_list_templates", { category: "iot" });
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("traffic-light");
      expect(text).toContain("elevator");
    });
  });

  describe("sm_create_from_template", () => {
    it("creates machine from auth-flow template", async () => {
      const ctx = createMockContext();
      const result = await registry.call(
        "sm_create_from_template",
        { template_id: "auth-flow" },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Machine Created from Template");
      expect(text).toContain("Authentication Flow");
    });

    it("returns error for unknown template", async () => {
      const ctx = createMockContext();
      const result = await registry.call(
        "sm_create_from_template",
        { template_id: "nonexistent" },
        ctx,
      );
      expect(result.isError).toBe(true);
    });
  });

  describe("sm_generate_code", () => {
    it("generates TypeScript code", async () => {
      const ctx = createMockContext();
      await registry.call("sm_create", { name: "test", initial_state: "idle" }, ctx);
      await registry.call(
        "sm_add_state",
        {
          machine_id: "machine-1",
          state_id: "idle",
          type: "atomic",
        },
        ctx,
      );

      const result = await registry.call(
        "sm_generate_code",
        { machine_id: "machine-1", framework: "typescript" },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Generated Code (typescript)");
    });

    it("generates Mermaid code", async () => {
      const ctx = createMockContext();
      await registry.call("sm_create", { name: "test", initial_state: "idle" }, ctx);

      const result = await registry.call(
        "sm_generate_code",
        { machine_id: "machine-1", framework: "mermaid" },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("stateDiagram-v2");
    });
  });

  describe("sm_simulate_sequence", () => {
    it("simulates event sequence", async () => {
      const ctx = createMockContext();
      await registry.call("sm_create", { name: "sim", initial_state: "idle" }, ctx);
      await registry.call(
        "sm_add_state",
        {
          machine_id: "machine-1",
          state_id: "idle",
          type: "atomic",
        },
        ctx,
      );
      await registry.call(
        "sm_add_state",
        {
          machine_id: "machine-1",
          state_id: "active",
          type: "atomic",
        },
        ctx,
      );
      await registry.call(
        "sm_add_transition",
        {
          machine_id: "machine-1",
          source: "idle",
          target: "active",
          event: "START",
        },
        ctx,
      );

      const result = await registry.call(
        "sm_simulate_sequence",
        { machine_id: "machine-1", events: ["START"] },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Simulation Complete");
      expect(text).toContain("START");
    });
  });

  describe("sm_share", () => {
    it("generates a share token", async () => {
      const ctx = createMockContext();
      await registry.call("sm_create", { name: "share-test", initial_state: "idle" }, ctx);

      const result = await registry.call("sm_share", { machine_id: "machine-1" }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Machine Shared Successfully");
      expect(text).toContain("share-token-123");
    });
  });

  describe("sm_get_shared", () => {
    it("retrieves shared machine data", async () => {
      const result = await registry.call("sm_get_shared", { token: "share-token-123" });
      expect(result.isError).toBeFalsy();
    });
  });
});
