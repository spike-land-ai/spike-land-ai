"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { ErrorBoundary } from "react-error-boundary";
import {
  AlertCircle,
  Download,
  History,
  LayoutTemplate,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Share2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStateMachine } from "@/components/state-machine/use-state-machine";
import { useStateMachineMcp } from "./hooks/useStateMachineMcp";
import type {
  MachineData,
  UseStateMachine,
} from "@/components/state-machine/use-state-machine";
import { MachineTabs } from "@/components/state-machine/MachineTabs";
import { StateEditor } from "@/components/state-machine/StateEditor";
import { TransitionEditor } from "@/components/state-machine/TransitionEditor";
import { SimulationPanel } from "@/components/state-machine/SimulationPanel";
import { TemplateLibrary } from "@/components/state-machine/TemplateLibrary";
import type { TemplateDefinition } from "@/components/state-machine/TemplateLibrary";
import { AIPanel } from "@/components/state-machine/AIPanel";
import { ImportExportDialog } from "@/components/state-machine/ImportExportDialog";
import type { MachineExport } from "@/lib/state-machine/types";
import { NewMachineDialog } from "@/components/state-machine/NewMachineDialog";
import { AddStateDialog } from "@/components/state-machine/AddStateDialog";
import { EmptyWorkspace } from "@/components/state-machine/EmptyWorkspace";

// App-level components
import { MachineCanvas } from "./components/MachineCanvas";
import { EventPanel } from "./components/EventPanel";
import { HistoryLog } from "./components/HistoryLog";
import { TemplateGallery } from "./components/TemplateGallery";

// ---------------------------------------------------------------------------
// Sidebar mode enum
// ---------------------------------------------------------------------------

type SidebarPanel =
  | "editor"
  | "transitions"
  | "simulation"
  | "events"
  | "history";

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

export function StateMachineApp() {
  const sm: UseStateMachine = useStateMachine();
  const { chatMut } = useStateMachineMcp();

  // UI state
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showAddState, setShowAddState] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showImportExport, setShowImportExport] = useState<
    "export" | "import" | null
  >(null);
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState<
    string | null
  >(null);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("simulation");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [exportData, setExportData] = useState<MachineExport | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // Load machines list on mount
  const { listMachines } = sm;
  useEffect(() => {
    listMachines();
  }, [listMachines]);

  const activeMachine: MachineData | null = sm.activeMachine;
  const machineId = sm.activeMachineId;

  // ── Handlers ─────────────────────────────────────────────────────

  const handleNewMachine = useCallback(
    async (name: string, initialState?: string) => {
      const newId = await sm.createMachine(name, initialState);
      setShowNewDialog(false);
      if (newId) {
        await sm.refreshMachine(newId);
        await sm.switchMachine(newId);
      }
    },
    [sm],
  );

  const handleAddState = useCallback(
    async (
      stateId: string,
      type: "atomic" | "compound" | "parallel" | "final",
      parent?: string,
    ) => {
      if (!machineId) return;
      await sm.addState(
        machineId,
        stateId,
        type,
        parent ? { parent } : undefined,
      );
      setShowAddState(false);
    },
    [machineId, sm],
  );

  const handleSelectState = useCallback((stateId: string) => {
    setSelectedStateId(stateId);
    setSidebarPanel("editor");
    setSidebarOpen(true);
  }, []);

  const handleSelectTransition = useCallback((transitionId: string) => {
    setSelectedTransitionId(transitionId);
    setSidebarPanel("transitions");
    setSidebarOpen(true);
  }, []);

  const handleExport = useCallback(async () => {
    if (!machineId) return;
    const data = await sm.exportMachine(machineId);
    setExportData(data);
    setShowImportExport("export");
  }, [machineId, sm]);

  const handleImport = useCallback(
    async (json: string) => {
      try {
        const parsed = JSON.parse(json) as MachineExport;
        const newId = await sm.createMachine(
          parsed.definition.name,
          parsed.definition.initial,
          parsed.definition.context,
        );
        if (!newId) return;

        // Add all states
        for (
          const [stateId, stateNode] of Object.entries(parsed.definition.states)
        ) {
          if (stateId === parsed.definition.initial) continue; // initial state is auto-created
          await sm.addState(newId, stateId, stateNode.type, {
            ...(stateNode.parent !== undefined ? { parent: stateNode.parent } : {}),
            ...(stateNode.initial !== undefined ? { initial: stateNode.initial } : {}),
          });
        }

        // Reset so engine enters the initial state (which now exists in states map)
        await sm.resetMachine(newId);

        // Add all transitions
        for (const transition of parsed.definition.transitions) {
          const guardExpr = transition.guard?.expression;
          await sm.addTransition(
            newId,
            transition.source,
            transition.target,
            transition.event,
            ...(guardExpr !== undefined ? { guard_expression: guardExpr } : {}),
            ...(transition.actions !== undefined ? { actions: transition.actions } : {}),
            ...(transition.internal !== undefined ? { internal: transition.internal } : {}),
            ...(transition.delayExpression !== undefined ? { delay_expression: transition.delayExpression } : {}),
            },
          );
}

await sm.refreshMachine(newId);
      } catch {
  // Import error handled by dialog
}
    },
[sm],
  );

const handleSelectTemplate = useCallback(
  async (template: TemplateDefinition) => {
    const newId = await sm.createMachine(
      template.name,
      template.initialState,
      template.context,
    );
    if (!newId) return;

    // Add all states (including initial - engine only enters it after reset)
    for (const state of template.states) {
      await sm.addState(newId, state.id, state.type, {
        ...(state.parent !== undefined ? { parent: state.parent } : {}),
        ...(state.initial !== undefined ? { initial: state.initial } : {}),
      });
    }

    // Reset so engine enters the initial state (which now exists in states map)
    await sm.resetMachine(newId);

    // Add transitions
    for (const t of template.transitions) {
      await sm.addTransition(newId, t.source, t.target, t.event, {
        ...(t.guard_expression !== undefined ? { guard_expression: t.guard_expression } : {}),
        ...(t.delay_expression !== undefined ? { delay_expression: t.delay_expression } : {}),
        ...(t.actions !== undefined ? { actions: t.actions } : {}),
      });
    }

    await sm.refreshMachine(newId);
  },
  [sm],
);

const handleGenerateMachine = useCallback(
  async (prompt: string) => {
    const data = await chatMut.mutateAsync({
      message:
        `Generate a state machine definition as JSON for: "${prompt}". Return ONLY valid JSON with this structure: {"name": "...", "initialState": "...", "states": [{"id": "...", "type": "atomic|compound|parallel|final"}], "transitions": [{"source": "...", "target": "...", "event": "..."}], "context": {}}. No markdown, no explanation, just JSON.`,
    });

    const text = data ?? "";
    // Extract JSON from possible markdown wrapping
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON in response");

    const generateSchema = z.object({
      name: z.string(),
      initialState: z.string(),
      states: z.array(
        z.object({
          id: z.string(),
          type: z.enum(["atomic", "compound", "parallel", "final"]),
          parent: z.string().optional(),
          initial: z.string().optional(),
        }),
      ),
      transitions: z.array(
        z.object({
          source: z.string(),
          target: z.string(),
          event: z.string(),
          guard_expression: z.string().optional(),
        }),
      ),
      context: z.record(z.string(), z.unknown()).optional(),
    });

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonMatch[0]);
    } catch (_err) {
      throw new Error("Failed to parse JSON from AI response");
    }

    const generated = generateSchema.parse(parsedJson);

    const newId = await sm.createMachine(
      generated.name,
      generated.initialState,
      generated.context,
    );
    if (!newId) throw new Error("Failed to create machine");

    for (const state of generated.states) {
      await sm.addState(newId, state.id, state.type, {
        ...(state.parent !== undefined ? { parent: state.parent } : {}),
        ...(state.initial !== undefined ? { initial: state.initial } : {}),
      });
    }

    // Reset so engine enters the initial state (which now exists in states map)
    await sm.resetMachine(newId);

    for (const t of generated.transitions) {
      await sm.addTransition(newId, t.source, t.target, t.event, {
        ...(t.guard_expression !== undefined ? { guard_expression: t.guard_expression } : {}),
      });
    }

    await sm.refreshMachine(newId);
  },
  [sm, chatMut],
);

const handleShare = useCallback(async () => {
  if (!machineId) return;
  const result = await sm.shareMachine(machineId);
  if (result) {
    setShareUrl(result.url);
    try {
      await navigator.clipboard.writeText(result.url);
    } catch {
      // clipboard might not be available
    }
  }
}, [machineId, sm]);

const handleHighlightState = useCallback((id: string | null) => {
  if (id) {
    setSelectedStateId(id);
    setSidebarPanel("editor");
    setSidebarOpen(true);
  }
}, []);

// ── Render ───────────────────────────────────────────────────────

const hasNoMachines = sm.machines.length === 0 && !sm.loading;

const sidebarPanels: Array<{ id: SidebarPanel; label: string; }> = [
  { id: "simulation", label: "Simulate" },
  { id: "events", label: "Events" },
  { id: "transitions", label: "Transitions" },
  { id: "editor", label: "Edit Node" },
  { id: "history", label: "History" },
];

return (
  <div className="min-h-[calc(100dvh-3.5rem)] bg-zinc-950 text-white flex flex-col">
    {/* Error banner */}
    {sm.error && (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-red-500/10 border-b border-red-500/20 text-red-300 text-sm">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">{sm.error}</span>
        <button
          onClick={sm.clearError}
          className="p-1 rounded hover:bg-red-500/20 transition-colors"
          aria-label="Dismiss error"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )}

    {/* Share URL toast */}
    {shareUrl && (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-300 text-sm">
        <Share2 className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 truncate">
          Share URL copied: <code className="font-mono text-xs">{shareUrl}</code>
        </span>
        <button
          onClick={() => setShareUrl(null)}
          className="p-1 rounded hover:bg-emerald-500/20 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )}

    {/* Machine tabs */}
    {sm.machines.length > 0 && (
      <MachineTabs
        machines={sm.machines}
        activeMachineId={sm.activeMachineId}
        onSwitch={sm.switchMachine}
        onClose={sm.closeMachine}
        onNew={() => setShowNewDialog(true)}
      />
    )}

    {/* Toolbar */}
    {activeMachine && machineId && (
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl shrink-0 supports-[backdrop-filter]:bg-zinc-950/60 z-20 shadow-sm relative">
        {/* Subtle gradient border bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

        <Button
          size="sm"
          onClick={() => setShowAddState(true)}
          className="h-8 shadow-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0 font-medium"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add State
        </Button>

        <div className="h-5 w-px bg-zinc-800 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTemplates(true)}
          className="h-8 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors"
        >
          <LayoutTemplate className="w-3.5 h-3.5 mr-1.5" />
          Templates
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAI(true)}
          className="h-8 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors group"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5 group-hover:scale-110 transition-transform" />
          AI Assistant
        </Button>

        <div className="h-5 w-px bg-zinc-800 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={handleExport}
          className="h-8 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowImportExport("import")}
          className="h-8 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors"
        >
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          Import
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleShare}
          disabled={sm.loading}
          className="h-8 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors"
        >
          <Share2 className="w-3.5 h-3.5 mr-1.5" />
          Share
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Loading indicator */}
        {sm.loading && (
          <div className="hidden sm:flex items-center justify-center mr-3">
            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            <span className="ml-2 text-xs text-zinc-500">Syncing...</span>
          </div>
        )}

        {/* Sidebar panel selector */}
        <div className="flex items-center gap-1 bg-zinc-900/50 rounded-xl border border-zinc-800/80 p-1 shadow-inner shadow-black/20">
          {sidebarPanels.map(panel => (
            <button
              key={panel.id}
              onClick={() => {
                setSidebarPanel(panel.id);
                setSidebarOpen(true);
              }}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${sidebarPanel === panel.id && sidebarOpen
                ? "text-white shadow-md bg-zinc-800"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                }`}
            >
              {sidebarPanel === panel.id && sidebarOpen && (
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent rounded-lg pointer-events-none" />
              )}
              <span className="relative z-10">{panel.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`ml-1 p-2 rounded-xl text-zinc-400 hover:text-white transition-all duration-200 ${sidebarOpen
            ? "bg-zinc-800/80 shadow-inner"
            : "hover:bg-zinc-800/50"
            }`}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {sidebarOpen
            ? <PanelRightClose className="w-4 h-4" />
            : <PanelRightOpen className="w-4 h-4" />}
        </button>
      </div>
    )}

    {/* Main content */}
    {hasNoMachines
      ? (
        <EmptyWorkspace
          onNew={() => setShowNewDialog(true)}
          onTemplate={() => setShowTemplates(true)}
        />
      )
      : !activeMachine || !machineId
        ? (
          <div className="flex-1 flex items-center justify-center text-zinc-600">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )
        : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Machine Canvas (states + transitions list) */}
            <div className="flex-1 relative p-3 min-w-0">
              {showTemplateGallery
                ? (
                  <TemplateGallery
                    onSelectTemplate={async template => {
                      await handleSelectTemplate(template);
                      setShowTemplateGallery(false);
                    }}
                    onClose={() => setShowTemplateGallery(false)}
                  />
                )
                : (
                  <ErrorBoundary
                    fallback={
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-red-400 bg-red-950/20">
                        <AlertCircle className="w-10 h-10 mb-4 opacity-80" />
                        <h3 className="text-lg font-semibold mb-2">
                          Canvas Error
                        </h3>
                        <p className="text-sm text-center max-w-md opacity-70">
                          The canvas encountered an error. Use the sidebar to manage states and
                          transitions.
                        </p>
                      </div>
                    }
                  >
                    <MachineCanvas
                      machine={activeMachine}
                      selectedStateId={selectedStateId}
                      selectedTransitionId={selectedTransitionId}
                      onSelectState={handleSelectState}
                      onSelectTransition={handleSelectTransition}
                    />
                  </ErrorBoundary>
                )}

              {/* Gallery toggle button */}
              {!showTemplateGallery && (
                <button
                  onClick={() => setShowTemplateGallery(true)}
                  className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/80 border border-zinc-700/60 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all shadow-lg backdrop-blur-sm"
                >
                  <LayoutTemplate className="w-3.5 h-3.5" />
                  Browse Templates
                </button>
              )}
            </div>

            {/* Right sidebar */}
            {sidebarOpen && (
              <div className="w-[380px] flex-shrink-0 border-l border-zinc-800/50 bg-zinc-950/80 overflow-y-auto flex flex-col">
                {/* Editor panel */}
                {sidebarPanel === "editor" && selectedStateId && (
                  <StateEditor
                    stateId={selectedStateId}
                    machine={activeMachine}
                    machineId={machineId}
                    sm={sm}
                    onClose={() => setSelectedStateId(null)}
                  />
                )}

                {sidebarPanel === "editor" && !selectedStateId && (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-sm p-6 text-center">
                    Click a state node in the canvas to edit it
                  </div>
                )}

                {/* Transitions panel */}
                {sidebarPanel === "transitions" && (
                  <div className="p-4">
                    <TransitionEditor
                      states={activeMachine.definition.states}
                      transitions={activeMachine.definition.transitions}
                      selectedTransitionId={selectedTransitionId}
                      onAddTransition={(source, target, event, options) =>
                        sm.addTransition(
                          machineId,
                          source,
                          target,
                          event,
                          options,
                        )}
                      onRemoveTransition={transitionId =>
                        sm.removeTransition(machineId, transitionId)}
                      onSelectTransition={setSelectedTransitionId}
                    />
                  </div>
                )}

                {/* Simulation panel */}
                {sidebarPanel === "simulation" && (
                  <SimulationPanel
                    states={activeMachine.definition.states}
                    transitions={activeMachine.definition.transitions}
                    currentStates={activeMachine.currentStates}
                    context={activeMachine.context}
                    transitionLog={activeMachine.transitionLog}
                    validationIssues={sm.activeValidation}
                    onSendEvent={(event, payload) => sm.sendEvent(machineId, event, payload)}
                    onReset={() => sm.resetMachine(machineId)}
                    onSetContext={ctx => sm.setContext(machineId, ctx)}
                    onValidate={() => sm.validateMachine(machineId)}
                    onHighlightState={handleHighlightState}
                  />
                )}

                {/* Events panel */}
                {sidebarPanel === "events" && (
                  <div className="flex flex-col h-full">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/50 shrink-0">
                      <h3 className="text-sm font-semibold text-zinc-200">
                        Event Panel
                      </h3>
                      <span className="ml-auto text-[10px] text-zinc-600">
                        {activeMachine.currentStates.length} active
                      </span>
                    </div>
                    <EventPanel
                      states={activeMachine.definition.states}
                      transitions={activeMachine.definition.transitions}
                      currentStates={activeMachine.currentStates}
                      isLoading={sm.loading}
                      onSendEvent={(event, payload) => sm.sendEvent(machineId, event, payload)}
                      onReset={() => sm.resetMachine(machineId)}
                    />
                  </div>
                )}

                {/* History panel */}
                {sidebarPanel === "history" && (
                  <div className="flex flex-col h-full">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/50 shrink-0">
                      <History className="w-4 h-4 text-zinc-500" />
                      <h3 className="text-sm font-semibold text-zinc-200">
                        Transition History
                      </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <HistoryLog entries={activeMachine.transitionLog} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

    {/* Modals */}
    <NewMachineDialog
      isOpen={showNewDialog}
      onSubmit={handleNewMachine}
      onClose={() => setShowNewDialog(false)}
    />

    {activeMachine && (
      <AddStateDialog
        isOpen={showAddState}
        existingStates={Object.keys(activeMachine.definition.states)}
        onSubmit={handleAddState}
        onClose={() => setShowAddState(false)}
      />
    )}

    <TemplateLibrary
      isOpen={showTemplates}
      onClose={() => setShowTemplates(false)}
      onSelectTemplate={handleSelectTemplate}
    />

    <AIPanel
      machineExport={activeMachine
        ? {
          definition: activeMachine.definition,
          currentStates: activeMachine.currentStates,
          context: activeMachine.context,
          history: activeMachine.history,
          transitionLog: activeMachine.transitionLog,
        }
        : null}
      machineName={activeMachine?.definition.name ?? ""}
      isOpen={showAI}
      onClose={() => setShowAI(false)}
      onGenerateMachine={handleGenerateMachine}
    />

    <ImportExportDialog
      isOpen={showImportExport !== null}
      mode={showImportExport ?? "export"}
      exportData={exportData}
      onClose={() => {
        setShowImportExport(null);
        setExportData(null);
      }}
      onImport={handleImport}
    />
  </div>
);
}
