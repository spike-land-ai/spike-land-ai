/**
 * Visualizer Template Tests
 *
 * Tests the generateVisualizerCode function which produces a self-contained
 * React+D3 component string for state machine visualization.
 */

import { describe, it, expect } from "vitest";
import { generateVisualizerCode } from "./visualizer-template.js";
import type { MachineExport } from "./types.js";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeMachineExport(overrides: Partial<MachineExport> = {}): MachineExport {
  return {
    definition: {
      id: "machine-1",
      name: "Traffic Light",
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
      },
      transitions: [
        {
          id: "t1",
          source: "red",
          target: "green",
          event: "GO",
          actions: [],
          internal: false,
        },
      ],
      context: { phase: 0 },
      userId: "user-1",
    },
    currentStates: ["red"],
    context: { phase: 0 },
    history: {},
    transitionLog: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateVisualizerCode", () => {
  it("returns a non-empty string", () => {
    const code = generateVisualizerCode(makeMachineExport(), false);
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThan(100);
  });

  it("embeds the machine JSON inside the output", () => {
    const machineExport = makeMachineExport();
    const code = generateVisualizerCode(machineExport, false);
    expect(code).toContain("Traffic Light");
    expect(code).toContain("MACHINE_DATA");
  });

  it("includes React and D3 imports", () => {
    const code = generateVisualizerCode(makeMachineExport(), false);
    expect(code).toContain("react");
    expect(code).toContain("d3");
    expect(code).toContain("dagre");
  });

  it("includes StateMachineVisualizer component export", () => {
    const code = generateVisualizerCode(makeMachineExport(), false);
    expect(code).toContain("StateMachineVisualizer");
    expect(code).toContain("export default");
  });

  it("non-interactive mode does not include Send Event controls", () => {
    const code = generateVisualizerCode(makeMachineExport(), false);
    // interactive controls reference handleSendEvent
    expect(code).not.toContain("handleSendEvent");
  });

  it("interactive mode includes Send Event controls", () => {
    const code = generateVisualizerCode(makeMachineExport(), true);
    expect(code).toContain("handleSendEvent");
    expect(code).toContain("Send Event");
  });

  it("interactive mode includes processEvent runtime helper", () => {
    const code = generateVisualizerCode(makeMachineExport(), true);
    expect(code).toContain("function processEvent");
  });

  it("non-interactive mode does not include processEvent runtime helper", () => {
    const code = generateVisualizerCode(makeMachineExport(), false);
    expect(code).not.toContain("function processEvent");
  });

  it("interactive mode includes auto-play controls", () => {
    const code = generateVisualizerCode(makeMachineExport(), true);
    expect(code).toContain("isAutoPlaying");
    expect(code).toContain("Auto-Play");
  });

  it("autoplay defaults to false when not specified", () => {
    const code = generateVisualizerCode(makeMachineExport(), true);
    expect(code).toContain("useState(false)");
  });

  it("autoplay true is embedded in the output", () => {
    const code = generateVisualizerCode(makeMachineExport(), true, true);
    expect(code).toContain("useState(true)");
  });

  it("autoplay speed is embedded in the output", () => {
    const code = generateVisualizerCode(makeMachineExport(), true, false, 2000);
    expect(code).toContain("2000");
  });

  it("default autoplay speed of 1000ms is used", () => {
    const code = generateVisualizerCode(makeMachineExport(), true, false);
    expect(code).toContain("1000");
  });

  it("embeds all state IDs from the machine", () => {
    const code = generateVisualizerCode(makeMachineExport(), false);
    // State IDs are JSON-encoded inside a JSON string literal, so they appear without extra quotes
    expect(code).toContain("red");
    expect(code).toContain("green");
  });

  it("embeds transition events", () => {
    const code = generateVisualizerCode(makeMachineExport(), false);
    expect(code).toContain("GO");
  });

  it("handles machine with no transitions", () => {
    const machineExport = makeMachineExport({
      definition: {
        id: "m1",
        name: "Static",
        initial: "s1",
        states: {
          s1: { id: "s1", type: "atomic", children: [], entryActions: [], exitActions: [] },
        },
        transitions: [],
        context: {},
        userId: "u1",
      },
    });
    const code = generateVisualizerCode(machineExport, false);
    expect(code).toContain("Static");
    expect(typeof code).toBe("string");
  });

  it("handles machine with compound state", () => {
    const machineExport = makeMachineExport({
      definition: {
        id: "m1",
        name: "Compound",
        initial: "parent",
        states: {
          parent: {
            id: "parent",
            type: "compound",
            initial: "child",
            children: ["child"],
            entryActions: [],
            exitActions: [],
          },
          child: {
            id: "child",
            type: "atomic",
            parent: "parent",
            children: [],
            entryActions: [],
            exitActions: [],
          },
        },
        transitions: [],
        context: {},
        userId: "u1",
      },
    });
    const code = generateVisualizerCode(machineExport, false);
    expect(code).toContain("Compound");
    expect(code).toContain("parent");
    expect(code).toContain("child");
  });

  it("handles machine with parallel state", () => {
    const machineExport = makeMachineExport({
      definition: {
        id: "m1",
        name: "Parallel Machine",
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
        transitions: [],
        context: {},
        userId: "u1",
      },
    });
    const code = generateVisualizerCode(machineExport, false);
    expect(code).toContain("regionA");
    expect(code).toContain("regionB");
  });

  it("embeds currentStates in MACHINE_DATA", () => {
    const machineExport = makeMachineExport({ currentStates: ["green"] });
    const code = generateVisualizerCode(machineExport, false);
    // The JSON-encoded machine export is embedded as a string literal
    expect(code).toContain("green");
  });

  it("embeds transition log entries when provided", () => {
    const machineExport = makeMachineExport({
      transitionLog: [
        {
          timestamp: 1000,
          event: "GO",
          fromStates: ["red"],
          toStates: ["green"],
          beforeContext: { phase: 0 },
          afterContext: { phase: 1 },
          actionsExecuted: [],
        },
      ],
    });
    const code = generateVisualizerCode(machineExport, false);
    expect(code).toContain("GO");
  });

  it("includes ContextInspector and EventTimeline components", () => {
    const code = generateVisualizerCode(makeMachineExport(), false);
    expect(code).toContain("ContextInspector");
    expect(code).toContain("EventTimeline");
  });

  it("includes computeLayout function", () => {
    const code = generateVisualizerCode(makeMachineExport(), false);
    expect(code).toContain("computeLayout");
  });

  it("includes StateRect component definition", () => {
    const code = generateVisualizerCode(makeMachineExport(), false);
    expect(code).toContain("StateRect");
  });

  it("includes TransitionArrow component definition", () => {
    const code = generateVisualizerCode(makeMachineExport(), false);
    expect(code).toContain("TransitionArrow");
  });

  it("includes STATE_COLORS constant", () => {
    const code = generateVisualizerCode(makeMachineExport(), false);
    expect(code).toContain("STATE_COLORS");
    expect(code).toContain("atomic");
    expect(code).toContain("compound");
    expect(code).toContain("parallel");
    expect(code).toContain("final");
    expect(code).toContain("history");
  });

  it("produces valid JS — no syntax error when passed through JSON.parse for data portion", () => {
    const machineExport = makeMachineExport();
    const code = generateVisualizerCode(machineExport, false);

    // Extract the embedded JSON from MACHINE_DATA = JSON.parse(...)
    const match = /const MACHINE_DATA = JSON\.parse\((.+?)\);/.exec(code);
    expect(match).not.toBeNull();
    if (match) {
      // The value inside JSON.parse() is itself a JSON-stringified string literal
      const jsonStr = JSON.parse(match[1]!) as string;
      const data = JSON.parse(jsonStr) as MachineExport;
      expect(data.definition.name).toBe("Traffic Light");
    }
  });
});
