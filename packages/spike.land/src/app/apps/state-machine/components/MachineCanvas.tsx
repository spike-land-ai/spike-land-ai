"use client";

import { useCallback, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { AlertCircle, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { MachineData } from "@/components/state-machine/use-state-machine";
import { StateNode } from "./StateNode";
import { TransitionArrow } from "./TransitionArrow";
import { MermaidViewer } from "@/components/state-machine/MermaidViewer";
import { cn } from "@/lib/utils";

interface MachineCanvasProps {
  machine: MachineData;
  selectedStateId: string | null;
  selectedTransitionId: string | null;
  onSelectState: (id: string) => void;
  onSelectTransition: (id: string) => void;
}

type CanvasTab = "states" | "transitions" | "mermaid";

function generateMermaidDiagram(machine: MachineData): string {
  const { definition, currentStates } = machine;
  const lines: string[] = ["stateDiagram-v2"];

  if (definition.initial) {
    lines.push(`    [*] --> ${definition.initial}`);
  }

  for (const [id, state] of Object.entries(definition.states)) {
    if (state.type === "final") {
      lines.push(`    ${id} --> [*]`);
    }
  }

  for (const t of definition.transitions) {
    const label = t.guard
      ? `${t.event} [${t.guard.expression}]`
      : t.event;
    lines.push(`    ${t.source} --> ${t.target} : ${label}`);
  }

  // Mark active states with a note
  if (currentStates.length > 0) {
    for (const active of currentStates) {
      lines.push(`    note right of ${active} : ACTIVE`);
    }
  }

  return lines.join("\n");
}

function CanvasErrorFallback() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-red-400 bg-red-950/20">
      <AlertCircle className="w-10 h-10 mb-4 opacity-80" />
      <h3 className="text-lg font-semibold mb-2">Canvas Render Error</h3>
      <p className="text-sm text-center max-w-md opacity-70">
        The visualization encountered an unexpected error. Use the sidebar panels to edit states and
        transitions to fix structural issues.
      </p>
    </div>
  );
}

function StatesList({
  machine,
  selectedStateId,
  onSelectState,
}: {
  machine: MachineData;
  selectedStateId: string | null;
  onSelectState: (id: string) => void;
}) {
  const stateEntries = useMemo(
    () => Object.entries(machine.definition.states),
    [machine.definition.states],
  );

  // Build child count map
  const childCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [, node] of stateEntries) {
      if (node.parent) {
        counts[node.parent] = (counts[node.parent] ?? 0) + 1;
      }
    }
    return counts;
  }, [stateEntries]);

  if (stateEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-600 text-sm gap-3">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center">
          <span className="text-2xl opacity-40">S</span>
        </div>
        <p className="font-medium">No states yet</p>
        <p className="text-xs text-zinc-700 text-center max-w-[180px]">
          Add states using the toolbar above
        </p>
      </div>
    );
  }

  // Sort: top-level first, then by ID
  const sorted = [...stateEntries].sort(([aId, aNode], [bId, bNode]) => {
    if (!aNode.parent && bNode.parent) return -1;
    if (aNode.parent && !bNode.parent) return 1;
    return aId.localeCompare(bId);
  });

  return (
    <div className="p-3 space-y-1.5">
      {sorted.map(([stateId, stateNode]) => (
        <StateNode
          key={stateId}
          stateId={stateId}
          stateNode={stateNode}
          isActive={machine.currentStates.includes(stateId)}
          isSelected={selectedStateId === stateId}
          isInitial={stateId === machine.definition.initial}
          childCount={childCountMap[stateId] ?? 0}
          onSelect={onSelectState}
        />
      ))}
    </div>
  );
}

function TransitionsList({
  machine,
  selectedTransitionId,
  onSelectTransition,
}: {
  machine: MachineData;
  selectedTransitionId: string | null;
  onSelectTransition: (id: string) => void;
}) {
  const { transitions } = machine.definition;
  const activeSourceSet = new Set(machine.currentStates);

  if (transitions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-600 text-sm gap-3">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center">
          <span className="text-2xl opacity-40">T</span>
        </div>
        <p className="font-medium">No transitions yet</p>
        <p className="text-xs text-zinc-700 text-center max-w-[180px]">
          Add transitions via the Transitions sidebar panel
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-1.5">
      {transitions.map(transition => (
        <TransitionArrow
          key={transition.id}
          transition={transition}
          isActive={activeSourceSet.has(transition.source)}
          isSelected={selectedTransitionId === transition.id}
          onSelect={onSelectTransition}
        />
      ))}
    </div>
  );
}

function MachineStats({ machine }: { machine: MachineData; }) {
  const stateCount = Object.keys(machine.definition.states).length;
  const transitionCount = machine.definition.transitions.length;
  const activeCount = machine.currentStates.length;

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-zinc-800/50 bg-zinc-950/60 shrink-0">
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="text-zinc-600 uppercase tracking-wider font-semibold">
          States
        </span>
        <span className="text-zinc-300 font-bold">{stateCount}</span>
      </div>
      <div className="w-px h-3 bg-zinc-800" />
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="text-zinc-600 uppercase tracking-wider font-semibold">
          Transitions
        </span>
        <span className="text-zinc-300 font-bold">{transitionCount}</span>
      </div>
      <div className="w-px h-3 bg-zinc-800" />
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="text-emerald-600 uppercase tracking-wider font-semibold">
          Active
        </span>
        <span className="text-emerald-400 font-bold">{activeCount}</span>
      </div>
      <div className="flex-1" />
      <div className="text-[10px] text-zinc-600 font-mono truncate max-w-[120px]">
        {machine.definition.name}
      </div>
    </div>
  );
}

export function MachineCanvas({
  machine,
  selectedStateId,
  selectedTransitionId,
  onSelectState,
  onSelectTransition,
}: MachineCanvasProps) {
  const [activeTab, setActiveTab] = useState<CanvasTab>("mermaid");
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = useCallback(
    () => setZoom(z => Math.min(z + 10, 150)),
    [],
  );
  const handleZoomOut = useCallback(
    () => setZoom(z => Math.max(z - 10, 60)),
    [],
  );
  const handleZoomReset = useCallback(() => setZoom(100), []);

  return (
    <ErrorBoundary FallbackComponent={CanvasErrorFallback}>
      <div className="flex flex-col h-full bg-zinc-950/50 rounded-xl overflow-hidden border border-zinc-800/80">
        {/* Machine stats bar */}
        <MachineStats machine={machine} />

        {/* Tab bar + zoom controls */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/50 bg-zinc-900/20 shrink-0">
          <div className="flex items-center gap-1 bg-zinc-900/50 rounded-lg border border-zinc-800/70 p-0.5">
            {(["mermaid", "states", "transitions"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150",
                  activeTab === tab
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {tab === "states"
                  ? `States (${Object.keys(machine.definition.states).length})`
                  : tab === "transitions"
                    ? `Transitions (${machine.definition.transitions.length})`
                    : "Diagram"}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 60}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors disabled:opacity-30"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              onClick={handleZoomReset}
              className="px-2 py-1 rounded text-[10px] font-mono text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors min-w-[36px] text-center"
              aria-label="Reset zoom"
            >
              {zoom}%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 150}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors disabled:opacity-30"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              onClick={handleZoomReset}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
              aria-label="Fit to view"
              title="Fit to view"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Canvas content */}
        <div
          className="flex-1 overflow-y-auto custom-scrollbar"
          style={{ fontSize: `${zoom}%` }}
        >
          {activeTab === "mermaid"
            ? (
              <div className="w-full h-full relative p-4">
                <MermaidViewer chart={generateMermaidDiagram(machine)} />
              </div>
            )
            : activeTab === "states"
              ? (
                <StatesList
                  machine={machine}
                  selectedStateId={selectedStateId}
                  onSelectState={onSelectState}
                />
              )
              : (
                <TransitionsList
                  machine={machine}
                  selectedTransitionId={selectedTransitionId}
                  onSelectTransition={onSelectTransition}
                />
              )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
