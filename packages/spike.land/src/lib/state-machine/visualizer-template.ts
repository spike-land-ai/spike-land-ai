/**
 * Visualizer Template Generator
 *
 * Generates a self-contained React+D3 component string for visualizing
 * state machines deployed to testing.spike.land codespaces.
 */

import type { MachineExport } from "./types";

export function generateVisualizerCode(
  machineExport: MachineExport,
  interactive: boolean,
  autoplay = false,
  autoplaySpeedMs = 1000,
): string {
  const machineJson = JSON.stringify(machineExport);

  return `
import React, { useState, useEffect, useRef, useCallback, useMemo } from "https://esm.sh/react@18";
import * as d3 from "https://esm.sh/d3@7";
import dagre from "https://esm.sh/dagre@0.8.5";

const MACHINE_DATA = JSON.parse(${JSON.stringify(machineJson)});

const STATE_COLORS = {
  atomic: "#4A90D9",
  compound: "#7B68EE",
  parallel: "#FF8C00",
  final: "#DC143C",
  history: "#FFD700",
};

const ACTIVE_GLOW = "#00FF00";

function computeLayout(definition, currentStates) {
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({ rankdir: "TB", ranksep: 60, nodesep: 40, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  const stateEntries = Object.entries(definition.states);

  for (const [id, state] of stateEntries) {
    const isContainer = state.type === "compound" || state.type === "parallel";
    const width = isContainer ? 200 : 140;
    const height = isContainer ? 120 : 50;
    g.setNode(id, { label: id, width, height, stateType: state.type });
  }

  for (const [id, state] of stateEntries) {
    if (state.parent && definition.states[state.parent]) {
      g.setParent(id, state.parent);
    }
  }

  for (const transition of definition.transitions) {
    if (definition.states[transition.source] && definition.states[transition.target]) {
      g.setEdge(transition.source, transition.target, {
        label: transition.event,
        transitionId: transition.id,
      });
    }
  }

  dagre.layout(g);
  return g;
}

function StateRect({ node, state, isActive, x, y, width, height }) {
  const color = STATE_COLORS[state.type] || STATE_COLORS.atomic;
  const isContainer = state.type === "compound" || state.type === "parallel";
  const isParallel = state.type === "parallel";

  return React.createElement("g", { transform: \`translate(\${x - width / 2}, \${y - height / 2})\` },
    React.createElement("rect", {
      width,
      height,
      rx: state.type === "final" ? 4 : 10,
      ry: state.type === "final" ? 4 : 10,
      fill: isContainer ? "rgba(0,0,0,0.05)" : color,
      stroke: isActive ? ACTIVE_GLOW : color,
      strokeWidth: isActive ? 3 : 1.5,
      strokeDasharray: isParallel ? "6,3" : "none",
      filter: isActive ? "url(#activeGlow)" : "none",
      style: { cursor: "default" },
    }),
    state.type === "final"
      ? React.createElement("rect", {
          x: 4, y: 4, width: width - 8, height: height - 8,
          rx: 2, ry: 2, fill: color, stroke: "none",
        })
      : null,
    React.createElement("text", {
      x: width / 2,
      y: isContainer ? 18 : height / 2,
      textAnchor: "middle",
      dominantBaseline: isContainer ? "auto" : "central",
      fill: isContainer ? color : "#fff",
      fontSize: 12,
      fontFamily: "system-ui, sans-serif",
      fontWeight: isActive ? "bold" : "normal",
    }, node.id),
    state.type === "history"
      ? React.createElement("text", {
          x: width / 2, y: height / 2 + 10,
          textAnchor: "middle", dominantBaseline: "central",
          fill: "#333", fontSize: 10, fontFamily: "system-ui, sans-serif",
        }, state.historyType === "deep" ? "H*" : "H")
      : null
  );
}

function TransitionArrow({ edge, g, transitions }) {
  const edgeData = g.edge(edge);
  if (!edgeData || !edgeData.points || edgeData.points.length < 2) return null;

  const points = edgeData.points;
  const lineGen = d3.line().x(d => d.x).y(d => d.y).curve(d3.curveBasis);
  const pathD = lineGen(points);

  const matchingTransition = transitions.find(t =>
    t.source === edge.v && t.target === edge.w
  );
  const label = matchingTransition
    ? matchingTransition.event + (matchingTransition.guard ? \` [\${matchingTransition.guard.expression}]\` : "")
    : edgeData.label || "";

  const midIdx = Math.floor(points.length / 2);
  const midPoint = points[midIdx];

  return React.createElement("g", null,
    React.createElement("path", {
      d: pathD,
      fill: "none",
      stroke: "#666",
      strokeWidth: 1.5,
      markerEnd: "url(#arrowhead)",
    }),
    label
      ? React.createElement("g", null,
          React.createElement("rect", {
            x: midPoint.x - label.length * 3.2,
            y: midPoint.y - 10,
            width: label.length * 6.4,
            height: 16,
            rx: 3, fill: "#fff", stroke: "#ddd", strokeWidth: 0.5,
          }),
          React.createElement("text", {
            x: midPoint.x,
            y: midPoint.y,
            textAnchor: "middle",
            dominantBaseline: "central",
            fill: "#333",
            fontSize: 10,
            fontFamily: "system-ui, sans-serif",
          }, label)
        )
      : null
  );
}

function ContextInspector({ context }) {
  return React.createElement("div", {
    style: {
      background: "#1e1e2e", color: "#cdd6f4", padding: 12,
      borderRadius: 8, fontSize: 12, fontFamily: "monospace",
      overflowX: "auto", maxHeight: 200, overflowY: "auto",
    },
  },
    React.createElement("div", {
      style: { fontWeight: "bold", marginBottom: 8, color: "#89b4fa", fontSize: 13 },
    }, "Context"),
    React.createElement("pre", {
      style: { margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" },
    }, JSON.stringify(context, null, 2))
  );
}

function EventTimeline({ log }) {
  if (!log || log.length === 0) {
    return React.createElement("div", {
      style: { color: "#888", fontSize: 12, fontStyle: "italic", padding: 8 },
    }, "No transitions yet");
  }

  return React.createElement("div", {
    style: { maxHeight: 300, overflowY: "auto" },
  },
    log.slice().reverse().map((entry, idx) =>
      React.createElement("div", {
        key: idx,
        style: {
          padding: "8px 10px", borderBottom: "1px solid #eee",
          fontSize: 12, fontFamily: "system-ui, sans-serif",
        },
      },
        React.createElement("div", {
          style: { fontWeight: "bold", color: "#4A90D9", marginBottom: 2 },
        }, entry.event),
        React.createElement("div", { style: { color: "#666" } },
          entry.fromStates.join(", "), " → ", entry.toStates.join(", ")
        ),
        entry.guardEvaluated
          ? React.createElement("div", { style: { color: "#999", fontSize: 11 } },
              "guard: ", entry.guardEvaluated)
          : null,
        entry.actionsExecuted && entry.actionsExecuted.length > 0
          ? React.createElement("div", { style: { color: "#999", fontSize: 11 } },
              "actions: ", entry.actionsExecuted.map(a => a.type).join(", "))
          : null
      )
    )
  );
}
${interactive ? generateInteractiveRuntime() : ""}
function StateMachineVisualizer() {
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
${
  interactive
    ? `
  const [machineState, setMachineState] = useState({
    currentStates: MACHINE_DATA.currentStates,
    context: MACHINE_DATA.context,
    history: MACHINE_DATA.history,
    transitionLog: MACHINE_DATA.transitionLog || [],
  });

  const currentStates = machineState.currentStates;
  const context = machineState.context;
  const transitionLog = machineState.transitionLog;

  const availableEvents = useMemo(() => {
    const events = new Set();
    for (const t of MACHINE_DATA.definition.transitions) {
      if (currentStates.includes(t.source)) {
        events.add(t.event);
      }
    }
    return Array.from(events);
  }, [currentStates]);

  const handleSendEvent = useCallback((eventName) => {
    setMachineState(prev => processEvent(MACHINE_DATA.definition, prev, eventName));
  }, []);

  const [isAutoPlaying, setIsAutoPlaying] = useState(${autoplay});
  const autoPlaySpeed = ${autoplaySpeedMs};
  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setTimeout(() => {
      if (availableEvents.length > 0) {
        const idx = Math.floor(Math.random() * availableEvents.length);
        const evt = availableEvents[idx];
        if (evt !== undefined) handleSendEvent(evt);
      } else {
        setIsAutoPlaying(false);
      }
    }, autoPlaySpeed);
    return () => clearTimeout(timer);
  }, [isAutoPlaying, availableEvents, handleSendEvent, autoPlaySpeed]);
`
    : `
  const currentStates = MACHINE_DATA.currentStates;
  const context = MACHINE_DATA.context;
  const transitionLog = MACHINE_DATA.transitionLog || [];
`
}
  const layoutGraph = useMemo(
    () => computeLayout(MACHINE_DATA.definition, currentStates),
    [currentStates]
  );

  useEffect(() => {
    if (!layoutGraph) return;
    const graphData = layoutGraph.graph();
    if (graphData.width && graphData.height) {
      setDimensions({
        width: Math.max(graphData.width + 40, 400),
        height: Math.max(graphData.height + 40, 300),
      });
    }
  }, [layoutGraph]);

  const stateNodes = layoutGraph.nodes().map(nodeId => {
    const node = layoutGraph.node(nodeId);
    const state = MACHINE_DATA.definition.states[nodeId];
    if (!node || !state) return null;
    const isActive = currentStates.includes(nodeId);
    return React.createElement(StateRect, {
      key: nodeId, node, state, isActive,
      x: node.x, y: node.y, width: node.width, height: node.height,
    });
  }).filter(Boolean);

  const edgeElements = layoutGraph.edges().map((edge, idx) =>
    React.createElement(TransitionArrow, {
      key: \`\${edge.v}-\${edge.w}-\${idx}\`,
      edge, g: layoutGraph,
      transitions: MACHINE_DATA.definition.transitions,
    })
  );

  return React.createElement("div", {
    style: {
      display: "flex", fontFamily: "system-ui, sans-serif",
      height: "100vh", background: "#f8f9fa",
    },
  },
    React.createElement("div", {
      style: { flex: 1, overflow: "auto", padding: 16 },
    },
      React.createElement("div", {
        style: {
          background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          padding: 16, marginBottom: 16,
        },
      },
        React.createElement("h2", {
          style: { margin: "0 0 4px 0", fontSize: 18, color: "#333" },
        }, MACHINE_DATA.definition.name || MACHINE_DATA.definition.id),
        React.createElement("div", { style: { fontSize: 12, color: "#888" } },
          "Active: ", currentStates.join(", ")
        )
      ),
      React.createElement("div", {
        style: {
          background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          padding: 8, overflow: "auto",
        },
      },
        React.createElement("svg", {
          ref: svgRef,
          width: dimensions.width,
          height: dimensions.height,
          viewBox: \`0 0 \${dimensions.width} \${dimensions.height}\`,
          style: { display: "block", margin: "0 auto" },
        },
          React.createElement("defs", null,
            React.createElement("marker", {
              id: "arrowhead", viewBox: "0 0 10 7", refX: 10, refY: 3.5,
              markerWidth: 8, markerHeight: 6, orient: "auto-start-reverse",
            },
              React.createElement("polygon", { points: "0 0, 10 3.5, 0 7", fill: "#666" })
            ),
            React.createElement("filter", { id: "activeGlow", x: "-20%", y: "-20%", width: "140%", height: "140%" },
              React.createElement("feGaussianBlur", { stdDeviation: 3, result: "blur" }),
              React.createElement("feFlood", { floodColor: ACTIVE_GLOW, floodOpacity: 0.6, result: "color" }),
              React.createElement("feComposite", { in: "color", in2: "blur", operator: "in", result: "glow" }),
              React.createElement("feMerge", null,
                React.createElement("feMergeNode", { in: "glow" }),
                React.createElement("feMergeNode", { in: "SourceGraphic" })
              )
            )
          ),
          React.createElement("g", { transform: "translate(20, 20)" },
            ...edgeElements,
            ...stateNodes
          )
        )
      )
    ),
    React.createElement("div", {
      style: {
        width: 300, background: "#fff", borderLeft: "1px solid #e0e0e0",
        padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16,
      },
    },
      React.createElement("div", {
        style: { fontWeight: "bold", fontSize: 15, color: "#333", borderBottom: "1px solid #eee", paddingBottom: 8 },
      }, "Inspector"),
${
  interactive
    ? `
      React.createElement("div", null,
        React.createElement("div", {
          style: { fontWeight: "bold", fontSize: 13, color: "#333", marginBottom: 8 },
        }, "Send Event"),
        availableEvents.length > 0
          ? React.createElement("div", {
              style: { display: "flex", flexWrap: "wrap", gap: 6 },
            },
              ...availableEvents.map(evt =>
                React.createElement("button", {
                  key: evt,
                  onClick: () => handleSendEvent(evt),
                  style: {
                    padding: "6px 12px", borderRadius: 6,
                    border: "1px solid #4A90D9", background: "#4A90D9",
                    color: "#fff", fontSize: 12, cursor: "pointer",
                    fontFamily: "system-ui, sans-serif",
                  },
                }, evt)
              )
            )
          : React.createElement("div", {
              style: { color: "#888", fontSize: 12, fontStyle: "italic" },
            }, "No events available")
      ),
      React.createElement("div", null,
        React.createElement("div", {
          style: { fontWeight: "bold", fontSize: 13, color: "#333", marginBottom: 8 },
        }, "Auto-Play"),
        React.createElement("button", {
          onClick: () => setIsAutoPlaying(p => !p),
          style: {
            padding: "8px 16px", borderRadius: 6, cursor: "pointer",
            border: isAutoPlaying ? "1px solid #FF8C00" : "1px solid #28a745",
            background: isAutoPlaying ? "#FF8C00" : "#28a745",
            color: "#fff", fontSize: 13, fontFamily: "system-ui, sans-serif",
            fontWeight: "bold", width: "100%",
          },
        }, isAutoPlaying ? "Pause" : "Play")
      ),
`
    : ""
}
      React.createElement(ContextInspector, { context }),
      React.createElement("div", null,
        React.createElement("div", {
          style: { fontWeight: "bold", fontSize: 13, color: "#333", marginBottom: 8 },
        }, "Event History"),
        React.createElement(EventTimeline, { log: transitionLog })
      )
    )
  );
}

export default StateMachineVisualizer;
`;
}

function generateInteractiveRuntime(): string {
  return `
function evaluateGuard(expression, context) {
  const tokens = expression.split(/\\s+/);
  let i = 0;

  function parseValue() {
    const token = tokens[i];
    if (!token) return undefined;
    if (token === "true") { i++; return true; }
    if (token === "false") { i++; return false; }
    if (token === "null") { i++; return null; }
    if (!isNaN(Number(token))) { i++; return Number(token); }
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
      i++;
      return token.slice(1, -1);
    }
    if (token.startsWith("context.")) {
      i++;
      const path = token.slice(8).split(".");
      let val = context;
      for (const p of path) {
        if (val == null) return undefined;
        val = val[p];
      }
      return val;
    }
    i++;
    return token;
  }

  function parseComparison() {
    const left = parseValue();
    if (i >= tokens.length) return left;
    const op = tokens[i];
    if (["==", "!=", ">", "<", ">=", "<=", "===", "!=="].includes(op)) {
      i++;
      const right = parseValue();
      switch (op) {
        case "==": case "===": return left == right;
        case "!=": case "!==": return left != right;
        case ">": return left > right;
        case "<": return left < right;
        case ">=": return left >= right;
        case "<=": return left <= right;
        default: return false;
      }
    }
    return left;
  }

  function parseExpression() {
    let result = parseComparison();
    while (i < tokens.length) {
      const op = tokens[i];
      if (op === "&&") { i++; result = result && parseComparison(); }
      else if (op === "||") { i++; result = result || parseComparison(); }
      else break;
    }
    return result;
  }

  try {
    return Boolean(parseExpression());
  } catch {
    return true;
  }
}

function executeActions(actions, context) {
  const newContext = { ...context };
  for (const action of actions) {
    if (action.type === "assign" && action.params) {
      for (const [key, value] of Object.entries(action.params)) {
        if (typeof value === "string" && value.startsWith("context.")) {
          const path = value.slice(8);
          newContext[key] = newContext[path];
        } else {
          newContext[key] = value;
        }
      }
    }
  }
  return newContext;
}

function processEvent(definition, state, eventName) {
  const { currentStates, context, history, transitionLog } = state;

  const candidateTransitions = definition.transitions.filter(t =>
    t.event === eventName && currentStates.includes(t.source)
  );

  const matchingTransition = candidateTransitions.find(t => {
    if (!t.guard) return true;
    return evaluateGuard(t.guard.expression, context);
  });

  if (!matchingTransition) return state;

  const sourceState = definition.states[matchingTransition.source];
  const targetState = definition.states[matchingTransition.target];
  if (!sourceState || !targetState) return state;

  let newContext = { ...context };

  if (sourceState.exitActions) {
    newContext = executeActions(sourceState.exitActions, newContext);
  }

  newContext = executeActions(matchingTransition.actions, newContext);

  if (targetState.entryActions) {
    newContext = executeActions(targetState.entryActions, newContext);
  }

  const source = matchingTransition.source;
  const newCurrentStates = currentStates
    .filter(s => s !== source && !s.startsWith(source + "."))
    .concat([matchingTransition.target]);

  if (targetState.type === "compound" && targetState.initial) {
    if (!newCurrentStates.includes(targetState.initial)) {
      newCurrentStates.push(targetState.initial);
    }
  }

  if (targetState.type === "parallel") {
    for (const childId of targetState.children) {
      if (!newCurrentStates.includes(childId)) {
        const childState = definition.states[childId];
        if (childState && childState.type === "compound" && childState.initial) {
          newCurrentStates.push(childId);
          newCurrentStates.push(childState.initial);
        } else {
          newCurrentStates.push(childId);
        }
      }
    }
  }

  const newHistory = { ...history };
  if (sourceState.parent) {
    newHistory[sourceState.parent] = currentStates.filter(s => {
      const st = definition.states[s];
      return st && st.parent === sourceState.parent;
    });
  }

  const logEntry = {
    timestamp: Date.now(),
    event: eventName,
    fromStates: [matchingTransition.source],
    toStates: [matchingTransition.target],
    beforeContext: context,
    afterContext: newContext,
    guardEvaluated: matchingTransition.guard ? matchingTransition.guard.expression : undefined,
    actionsExecuted: matchingTransition.actions,
  };

  return {
    currentStates: newCurrentStates,
    context: newContext,
    history: newHistory,
    transitionLog: [...transitionLog, logEntry],
  };
}
`;
}
