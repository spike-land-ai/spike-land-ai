import type { MachineData, UseStateMachine } from "./use-state-machine";
import { Plus, Trash2, X, Zap } from "lucide-react";
import { useState } from "react";

interface Props {
  stateId: string;
  machine: MachineData;
  machineId: string;
  sm: UseStateMachine;
  onClose: () => void;
}

export function StateEditor(
  { stateId, machine, machineId, sm, onClose }: Props,
) {
  const [newEvent, setNewEvent] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const stateNode = machine.definition.states[stateId];

  if (!stateNode) return null;

  const handleAddTransition = async () => {
    if (newEvent && newTarget) {
      await sm.addTransition(machineId, stateId, newTarget, newEvent);
      setNewEvent("");
      setNewTarget("");
    }
  };

  const handleDelete = async () => {
    const success = await sm.removeState(machineId, stateId);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-300">
      <div className="flex items-center justify-between p-5 border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shadow-inner shadow-indigo-500/10">
            <Zap className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className="font-semibold text-white tracking-tight text-lg">
            {stateId}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-zinc-800 rounded-lg transition text-zinc-500 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 flex-1 space-y-7 overflow-y-auto custom-scrollbar">
        <div>
          <h4 className="text-[11px] uppercase font-bold text-zinc-500 tracking-wider mb-3 px-1">
            Properties
          </h4>
          <div className="bg-zinc-900/40 rounded-xl p-4 border border-zinc-800/80 shadow-inner">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-zinc-400 font-medium">Type</span>
              <span className="text-xs text-zinc-300 font-semibold capitalize bg-zinc-800/50 px-2.5 py-1 rounded-md border border-zinc-700/50">
                {stateNode.type || "atomic"}
              </span>
            </div>

            {machine.definition.initial === stateId && (
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-800">
                <span className="text-sm font-medium bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Initial State
                </span>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75">
                  </span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]">
                  </span>
                </span>
              </div>
            )}

            {machine.currentStates.includes(stateId) && (
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-800">
                <span className="text-sm text-emerald-400 font-medium">
                  Currently Active
                </span>
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]">
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h4 className="text-[11px] uppercase font-bold text-zinc-500 tracking-wider">
              Transitions
            </h4>
          </div>

          <div className="space-y-3">
            {machine.definition.transitions
              .filter(t => t.source === stateId)
              .map((t, idx) => (
                <div
                  key={idx}
                  className="bg-zinc-900/40 rounded-xl p-3.5 border border-zinc-800/80 group hover:border-zinc-700 transition flex items-center justify-between shadow-sm"
                >
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-md self-start border border-indigo-500/20">
                      {t.event}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-zinc-500">Target:</span>
                      <span className="text-sm text-zinc-200 font-medium">
                        {t.target}
                      </span>
                    </div>
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition rounded-lg"
                    onClick={() => {
                      /* Needs ID or full signature to pass to use-state-machine */
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

            {machine.definition.transitions.filter(t => t.source === stateId)
                  .length === 0 && (
              <div className="text-center py-6 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-sm">
                No transitions defined
              </div>
            )}
          </div>

          <div className="mt-5 bg-zinc-900/40 p-4 rounded-xl border border-indigo-500/20 border-dashed backdrop-blur-sm">
            <h5 className="text-xs text-indigo-400 font-medium mb-3">
              Add New Transition
            </h5>
            <div className="space-y-2.5">
              <input
                type="text"
                placeholder="Event name (e.g. TICK)"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600"
                value={newEvent}
                onChange={e => setNewEvent(e.target.value)}
              />
              <input
                type="text"
                placeholder="Target state ID"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600"
                value={newTarget}
                onChange={e => setNewTarget(e.target.value)}
              />
              <button
                onClick={handleAddTransition}
                disabled={!newEvent || !newTarget}
                className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 text-white text-sm font-medium py-2 rounded-lg transition-all duration-200 flex justify-center items-center gap-2 shadow-md hover:shadow-lg disabled:shadow-none"
              >
                <Plus className="w-4 h-4" /> Add Transition
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 border-t border-white/5 bg-zinc-900/30">
        <button
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-500/20 text-red-500 hover:bg-red-500/20 hover:text-red-400 rounded-xl text-sm font-medium transition"
        >
          <Trash2 className="w-4 h-4" />
          Delete State
        </button>
      </div>
    </div>
  );
}
