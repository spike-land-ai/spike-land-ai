"use client";

import { Plus, X } from "lucide-react";
import type { MachineTab } from "./use-state-machine";

interface MachineTabsProps {
  machines: MachineTab[];
  activeMachineId: string | null;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

export function MachineTabs({
  machines,
  activeMachineId,
  onSwitch,
  onClose,
  onNew,
}: MachineTabsProps) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 overflow-x-auto custom-scrollbar">
      {machines.map((machine) => {
        const isActive = machine.id === activeMachineId;
        return (
          <button
            key={machine.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSwitch(machine.id)}
            className={`group relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 whitespace-nowrap ${
              isActive
                ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-inner"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent"
            }`}
            id={`machine-tab-${machine.id}`}
          >
            <span className="truncate max-w-[140px] tracking-wide">{machine.name}</span>
            <span
              className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md text-[10px] font-bold ${
                isActive
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20"
                  : "bg-zinc-800/80 text-zinc-500 border border-zinc-700/50"
              }`}
            >
              {machine.stateCount}
            </span>
            {machine.hasUnsavedChanges && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            )}
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClose(machine.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onClose(machine.id);
                }
              }}
              className="opacity-0 group-hover:opacity-100 ml-0.5 p-1 rounded-md hover:bg-red-500/20 hover:text-red-400 transition-all"
              aria-label={`Close ${machine.name}`}
            >
              <X className="w-3.5 h-3.5" />
            </span>
          </button>
        );
      })}
      <div className="h-6 w-px bg-zinc-800/80 mx-1" />
      <button
        onClick={onNew}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all border border-dashed border-zinc-700 hover:border-indigo-500/30"
        id="new-machine-tab"
        aria-label="Create new machine"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>New</span>
      </button>
    </div>
  );
}
