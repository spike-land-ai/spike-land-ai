"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StateGraph } from "@/components/state-machine/StateGraph";
import { useStateMachine } from "@/components/state-machine/use-state-machine";
import type {
  MachineExport,
  MachineInstance,
  StateNode,
} from "@/lib/state-machine/types";
import { logger } from "@/lib/logger";

interface StateMachineViewProps {
  initialData: MachineExport;
  machineName: string;
}

export function StateMachineView(
  { initialData, machineName }: StateMachineViewProps,
) {
  const router = useRouter();
  const sm = useStateMachine();
  const [isForking, setIsForking] = useState(false);

  const handleFork = useCallback(async () => {
    setIsForking(true);
    try {
      const newId = await sm.createMachine(
        `${machineName} (Forked)`,
        initialData.definition.initial,
        initialData.definition.context,
      );
      if (!newId) return;

      for (const [id, value] of Object.entries(initialData.definition.states)) {
        const state = value as StateNode;
        await sm.addState(newId, id, state.type, {
          ...(state.parent !== undefined ? { parent: state.parent } : {}),
          ...(state.initial !== undefined ? { initial: state.initial } : {}),
          ...(state.entryActions?.length
            ? { entry_actions: JSON.parse(JSON.stringify(state.entryActions)) }
            : {}),
          ...(state.exitActions?.length
            ? { exit_actions: JSON.parse(JSON.stringify(state.exitActions)) }
            : {}),
          ...(state.historyType !== undefined ? { history_type: state.historyType } : {}),
        });
      }

      for (const t of initialData.definition.transitions) {
        await sm.addTransition(newId, t.source, t.target, t.event, {
          ...(t.guard?.expression !== undefined ? { guard_expression: t.guard.expression } : {}),
          ...(t.actions?.length
            ? { actions: JSON.parse(JSON.stringify(t.actions)) }
            : {}),
          ...(t.internal ? { internal: t.internal } : {}),
        });
      }

      await sm.switchMachine(newId);
      router.push("/apps/state-machine");
    } catch (err) {
      logger.error("Failed to fork machine", err);
    } finally {
      setIsForking(false);
    }
  }, [sm, initialData, machineName, router]);

  const dummyMachineData: MachineInstance = {
    definition: {
      ...initialData.definition,
      id: initialData.definition.id || "shared",
      userId: initialData.definition.userId || "shared",
    },
    currentStates: initialData.currentStates,
    context: initialData.context,
    history: {},
    transitionLog: initialData.transitionLog,
    initialContext: initialData.context,
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0A0A0B]">
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-black/40 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400 shadow-lg shadow-indigo-500/10">
            S
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-tight">
              {machineName}
            </h1>
            <p className="text-[10px] text-zinc-500 font-medium">
              Shared WIP Snapshot
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/apps/state-machine"
            className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Studio
          </Link>
          <button
            onClick={handleFork}
            disabled={isForking}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] flex items-center gap-2"
          >
            {isForking ? "Forking..." : "Fork Machine"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 overflow-hidden relative">
          <StateGraph
            machine={dummyMachineData}
            onNodeFocus={() => {}}
          />

          <div className="absolute top-6 left-6 z-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 backdrop-blur-xl max-w-sm shadow-2xl">
            <h3 className="text-sm text-indigo-300 font-semibold mb-1 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75">
                </span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500">
                </span>
              </span>
              Read-only Preview
            </h3>
            <p className="text-xs text-indigo-300/70 mt-2 leading-relaxed">
              This is a shared snapshot of a state machine. Click "Fork Machine" to edit and
              simulate it in your own local Studio workspace.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
