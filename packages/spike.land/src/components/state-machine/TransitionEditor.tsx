"use client";

import { useState } from "react";
import { ChevronDown, Trash2, Zap } from "lucide-react";
import type { ActionType, StateNode, Transition } from "@/lib/state-machine/types";

interface TransitionEditorProps {
  states: Record<string, StateNode>;
  transitions: Transition[];
  selectedTransitionId: string | null;
  onAddTransition: (
    source: string,
    target: string,
    event: string,
    options?: {
      guard_expression?: string;
      actions?: Array<{ type: ActionType; params: Record<string, unknown> }>;
      internal?: boolean;
    },
  ) => Promise<boolean>;
  onRemoveTransition: (transitionId: string) => Promise<boolean>;
  onSelectTransition: (id: string | null) => void;
}

export function TransitionEditor({
  states,
  transitions,
  selectedTransitionId,
  onAddTransition,
  onRemoveTransition,
  onSelectTransition,
}: TransitionEditorProps) {
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [event, setEvent] = useState("");
  const [guard, setGuard] = useState("");
  const [internal, setInternal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const stateIds = Object.keys(states);
  const selectedTransition = selectedTransitionId
    ? transitions.find((t) => t.id === selectedTransitionId)
    : null;

  const handleAdd = async () => {
    if (!source || !target || !event.trim()) return;
    setIsAdding(true);

    const options: Record<string, unknown> = {};
    if (guard.trim()) options.guard_expression = guard.trim();
    if (internal) options.internal = true;

    const success = await onAddTransition(source, target, event.trim(), options);
    if (success) {
      setEvent("");
      setGuard("");
      setInternal(false);
    }
    setIsAdding(false);
  };

  return (
    <div className="space-y-4">
      {/* Add new transition form */}
      <div className="space-y-3 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 shadow-inner backdrop-blur-sm">
        <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
          Add Transition
        </h4>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 appearance-none cursor-pointer focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-sm"
                id="transition-source-select"
              >
                <option value="">Source...</option>
                {stateIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-zinc-500 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 appearance-none cursor-pointer focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-sm"
                id="transition-target-select"
              >
                <option value="">Target...</option>
                {stateIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          <input
            type="text"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            placeholder='Event name (e.g. "SUBMIT")'
            className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-sm"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            id="transition-event-input"
          />

          <input
            type="text"
            value={guard}
            onChange={(e) => setGuard(e.target.value)}
            placeholder='Guard condition (e.g. "context.count > 0")'
            className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono text-xs shadow-sm"
            id="transition-guard-input"
          />

          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer hover:text-zinc-300 transition-colors py-1">
            <input
              type="checkbox"
              checked={internal}
              onChange={(e) => setInternal(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-950 text-indigo-500 focus:ring-indigo-500/30 w-4 h-4"
            />
            Internal transition (no exit/re-enter)
          </label>

          <button
            onClick={handleAdd}
            disabled={!source || !target || !event.trim() || isAdding}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg disabled:shadow-none mt-1"
            id="add-transition-btn"
          >
            <Zap className="w-4 h-4" />
            {isAdding ? "Adding..." : "Add Transition"}
          </button>
        </div>
      </div>

      {/* Selected transition inspector */}
      {selectedTransition && (
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-3 shadow-inner">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
              Selected Transition
            </h4>
            <button
              onClick={() => {
                if (selectedTransitionId) {
                  onRemoveTransition(selectedTransitionId);
                  onSelectTransition(null);
                }
              }}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
              aria-label="Remove transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-zinc-500 font-medium tracking-wide text-[10px] uppercase">
                Source
              </span>
              <span className="text-zinc-300 bg-zinc-950/50 px-2 py-1.5 rounded-md border border-zinc-800/80">
                {selectedTransition.source}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-zinc-500 font-medium tracking-wide text-[10px] uppercase">
                Target
              </span>
              <span className="text-zinc-300 bg-zinc-950/50 px-2 py-1.5 rounded-md border border-zinc-800/80">
                {selectedTransition.target}
              </span>
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <span className="text-zinc-500 font-medium tracking-wide text-[10px] uppercase">
                Event Trigger
              </span>
              <span className="text-indigo-300 font-semibold bg-indigo-500/20 px-2 py-1.5 rounded-md border border-indigo-500/30 inline-block w-max">
                {selectedTransition.event}
              </span>
            </div>
            {selectedTransition.guard && (
              <div className="col-span-2 mt-1">
                <span className="text-zinc-500 font-medium tracking-wide text-[10px] uppercase mb-1 block">
                  Guard Condition
                </span>
                <code className="text-amber-300 text-[11px] bg-amber-500/10 px-2 py-1.5 rounded-md border border-amber-500/20 block font-mono">
                  {selectedTransition.guard.expression}
                </code>
              </div>
            )}
            {selectedTransition.internal && (
              <div className="col-span-2 mt-1">
                <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                  Internal
                </span>
              </div>
            )}
          </div>

          {selectedTransition.actions.length > 0 && (
            <div className="text-xs mt-3 pt-3 border-t border-indigo-500/10">
              <span className="text-zinc-500 font-medium tracking-wide text-[10px] uppercase mb-1.5 block">
                Actions
              </span>
              <div className="space-y-1.5">
                {selectedTransition.actions.map((a, i) => (
                  <div
                    key={i}
                    className="px-2.5 py-1.5 rounded-md bg-zinc-950/50 border border-zinc-800/80 text-zinc-400 font-mono text-[10px] break-all shadow-sm"
                  >
                    <span className="text-purple-400 font-semibold mr-1">{a.type}:</span>
                    {JSON.stringify(a.params)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transition list */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider px-1">
          All Transitions ({transitions.length})
        </h4>
        <div className="space-y-1 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
          {transitions.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelectTransition(t.id === selectedTransitionId ? null : t.id)}
              className={`w-full flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-left transition-all ${
                t.id === selectedTransitionId
                  ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-inner"
                  : "text-zinc-400 hover:text-zinc-200 bg-zinc-900/40 hover:bg-zinc-800/60 border border-transparent"
              }`}
            >
              <span className="truncate font-medium">{t.source}</span>
              <span className="text-zinc-600">→</span>
              <span className="truncate font-medium">{t.target}</span>
              <span
                className={`ml-auto px-2 py-1 rounded-md text-[10px] font-semibold border ${
                  t.id === selectedTransitionId
                    ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-300"
                    : "bg-zinc-800 border-zinc-700/50 text-zinc-400"
                }`}
              >
                {t.event}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
