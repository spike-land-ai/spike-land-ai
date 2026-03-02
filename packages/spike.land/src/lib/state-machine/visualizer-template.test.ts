import { describe, expect, it } from "vitest";
import { generateVisualizerCode } from "./visualizer-template";
import type { MachineExport } from "./types";

function makeTrafficLightExport(): MachineExport {
  return {
    definition: {
      id: "traffic-light",
      name: "Traffic Light",
      initial: "red",
      userId: "test-user",
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
      context: { count: 0 },
    },
    currentStates: ["red"],
    context: { count: 0 },
    history: {},
    transitionLog: [],
  };
}

function makeNestedExport(): MachineExport {
  return {
    definition: {
      id: "nested",
      name: "Nested Machine",
      initial: "parent",
      userId: "test-user",
      states: {
        parent: {
          id: "parent",
          type: "compound",
          children: ["child1", "child2"],
          initial: "child1",
          entryActions: [],
          exitActions: [],
        },
        child1: {
          id: "child1",
          type: "atomic",
          parent: "parent",
          children: [],
          entryActions: [],
          exitActions: [],
        },
        child2: {
          id: "child2",
          type: "atomic",
          parent: "parent",
          children: [],
          entryActions: [],
          exitActions: [],
        },
      },
      transitions: [
        {
          id: "t1",
          source: "child1",
          target: "child2",
          event: "GO",
          actions: [],
          internal: false,
        },
      ],
      context: {},
    },
    currentStates: ["parent", "child1"],
    context: {},
    history: {},
    transitionLog: [],
  };
}

function makeParallelExport(): MachineExport {
  return {
    definition: {
      id: "parallel",
      name: "Parallel Machine",
      initial: "root",
      userId: "test-user",
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
    },
    currentStates: ["root", "regionA", "regionB"],
    context: {},
    history: {},
    transitionLog: [],
  };
}

describe("generateVisualizerCode", () => {
  it("should return a string containing React imports", () => {
    const code = generateVisualizerCode(makeTrafficLightExport(), false);
    expect(code).toContain('from "https://esm.sh/react@18"');
    expect(code).toContain('from "https://esm.sh/d3@7"');
    expect(code).toContain('from "https://esm.sh/dagre@0.8.5"');
  });

  it("should embed machine data as JSON", () => {
    const code = generateVisualizerCode(makeTrafficLightExport(), false);
    expect(code).toContain("MACHINE_DATA");
    expect(code).toContain("Traffic Light");
    expect(code).toContain("red");
    expect(code).toContain("green");
    expect(code).toContain("yellow");
  });

  it("should include state color definitions", () => {
    const code = generateVisualizerCode(makeTrafficLightExport(), false);
    expect(code).toContain("#4A90D9");
    expect(code).toContain("#7B68EE");
    expect(code).toContain("#FF8C00");
    expect(code).toContain("#DC143C");
    expect(code).toContain("#FFD700");
  });

  it("should include active glow color", () => {
    const code = generateVisualizerCode(makeTrafficLightExport(), false);
    expect(code).toContain("#00FF00");
  });

  it("should export default component", () => {
    const code = generateVisualizerCode(makeTrafficLightExport(), false);
    expect(code).toContain("export default StateMachineVisualizer");
  });

  it("should include dagre layout computation", () => {
    const code = generateVisualizerCode(makeTrafficLightExport(), false);
    expect(code).toContain("computeLayout");
    expect(code).toContain("dagre.layout");
  });

  it("should include ContextInspector component", () => {
    const code = generateVisualizerCode(makeTrafficLightExport(), false);
    expect(code).toContain("ContextInspector");
    expect(code).toContain("Context");
  });

  it("should include EventTimeline component", () => {
    const code = generateVisualizerCode(makeTrafficLightExport(), false);
    expect(code).toContain("EventTimeline");
    expect(code).toContain("Event History");
  });

  describe("interactive mode", () => {
    it("should include event buttons in interactive mode", () => {
      const code = generateVisualizerCode(makeTrafficLightExport(), true);
      expect(code).toContain("handleSendEvent");
      expect(code).toContain("availableEvents");
      expect(code).toContain("Send Event");
    });

    it("should include processEvent runtime in interactive mode", () => {
      const code = generateVisualizerCode(makeTrafficLightExport(), true);
      expect(code).toContain("processEvent");
      expect(code).toContain("evaluateGuard");
      expect(code).toContain("executeActions");
    });

    it("should not include event buttons in non-interactive mode", () => {
      const code = generateVisualizerCode(makeTrafficLightExport(), false);
      expect(code).not.toContain("handleSendEvent");
      expect(code).not.toContain("processEvent");
    });
  });

  describe("nested states", () => {
    it("should render compound state data", () => {
      const code = generateVisualizerCode(makeNestedExport(), false);
      expect(code).toContain("compound");
      expect(code).toContain("parent");
      expect(code).toContain("child1");
      expect(code).toContain("child2");
    });
  });

  describe("parallel regions", () => {
    it("should render parallel state data with dashed borders", () => {
      const code = generateVisualizerCode(makeParallelExport(), false);
      expect(code).toContain("parallel");
      expect(code).toContain("strokeDasharray");
      // JSON strings are quoted, and machineExport is JSON.stringified twice in generateVisualizerCode
      expect(code).toContain("regionA");
      expect(code).toContain("regionB");
    });
  });

  it("should include arrowhead marker for transitions", () => {
    const code = generateVisualizerCode(makeTrafficLightExport(), false);
    expect(code).toContain("arrowhead");
    expect(code).toContain("markerEnd");
  });

  it("should include SVG glow filter for active states", () => {
    const code = generateVisualizerCode(makeTrafficLightExport(), false);
    expect(code).toContain("activeGlow");
    expect(code).toContain("feGaussianBlur");
  });
});
