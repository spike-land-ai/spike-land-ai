import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  MarkerType,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import type { MachineData } from "./use-state-machine";

interface Props {
  machine: MachineData;
  onNodeFocus: (id: string) => void;
}

export function StateGraph({ machine, onNodeFocus }: Props) {
  const nodes: Node[] = useMemo(() => {
    return Object.entries(machine.definition.states).map(
      ([stateId, _stateNode], index) => {
        const isActive = machine.currentStates.includes(stateId);

        return {
          id: stateId,
          type: "default",
          position: {
            x: 250 + (index * 200),
            y: 250 + (index % 2 === 0 ? 80 : -80),
          }, // Basic auto layout
          data: { label: stateId },
          style: {
            background: isActive
              ? "rgba(79, 70, 229, 0.15)"
              : "rgba(24, 24, 27, 0.8)",
            color: isActive ? "#ffffff" : "#d4d4d8",
            border: isActive
              ? "2px solid rgba(99, 102, 241, 0.5)"
              : "1px solid rgba(63, 63, 70, 0.5)",
            borderRadius: "12px",
            padding: "12px 20px",
            fontSize: "14px",
            fontWeight: isActive ? 600 : 500,
            boxShadow: isActive
              ? "0 0 30px rgba(99, 102, 241, 0.2), inset 0 0 20px rgba(99, 102, 241, 0.1)"
              : "0 4px 6px -1px rgba(0, 0, 0, 0.4)",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            backdropFilter: "blur(8px)",
          },
        };
      },
    );
  }, [machine.definition.states, machine.currentStates]);

  const edges: Edge[] = useMemo(() => {
    return machine.definition.transitions.map((t, idx) => ({
      // ReactFlow requires unique edge IDs
      id: `e-${t.source}-${t.target}-${t.event}-${idx}`,
      source: t.source,
      target: t.target,
      label: t.event,
      animated: machine.currentStates.includes(t.source),
      style: {
        stroke: machine.currentStates.includes(t.source)
          ? "#818cf8"
          : "#52525b",
        strokeWidth: 2,
        transition: "all 0.3s ease",
      },
      labelStyle: {
        fill: "#e4e4e7",
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: "0.05em",
      },
      labelBgStyle: {
        fill: "#18181b",
        color: "#fff",
        fillOpacity: 0.9,
        stroke: "#3f3f46",
        strokeWidth: 1,
        rx: 4,
        ry: 4,
      },
      labelBgPadding: [6, 4],
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15,
        color: machine.currentStates.includes(t.source) ? "#818cf8" : "#52525b",
      },
    }));
  }, [machine.definition.transitions, machine.currentStates]);

  // A basic empty state container style
  const graphStyles = {
    fontFamily: "Inter, sans-serif",
  };

  return (
    <div
      className="react-flow-dark-theme-wrapper relative rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-950/50 shadow-inner"
      style={{ width: "100%", height: "100%", ...graphStyles }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/10 via-zinc-900/5 to-zinc-950/20 pointer-events-none" />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={(_, node) => onNodeFocus(node.id)}
        fitView
        className="bg-transparent"
      >
        <Background color="#3f3f46" gap={24} size={2} />
        <Controls
          showInteractive={false}
          className="opacity-50 hover:opacity-100 transition-opacity [&>button]:bg-zinc-900/80 [&>button]:backdrop-blur-sm [&>button]:border-zinc-800 [&>button]:text-zinc-400 hover:[&>button]:text-zinc-200"
        />
      </ReactFlow>
    </div>
  );
}
