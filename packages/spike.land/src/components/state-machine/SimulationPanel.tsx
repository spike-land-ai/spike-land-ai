"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Braces,
  CheckCircle,
  Clock,
  History,
  ListChecks,
  Pause,
  Play,
  RotateCcw,
  Save,
  Send,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import type {
  StateNode,
  Transition,
  TransitionLogEntry,
  ValidationIssue,
} from "@/lib/state-machine/types";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SavedScenario {
  name: string;
  events: Array<{ event: string; payload?: Record<string, unknown> }>;
}

interface SimulationPanelProps {
  states: Record<string, StateNode>;
  transitions: Transition[];
  currentStates: string[];
  context: Record<string, unknown>;
  transitionLog: TransitionLogEntry[];
  validationIssues: ValidationIssue[];
  onSendEvent: (event: string, payload?: Record<string, unknown>) => Promise<unknown>;
  onReset: () => Promise<boolean>;
  onSetContext: (context: Record<string, unknown>) => Promise<boolean>;
  onValidate: () => Promise<ValidationIssue[]>;
  onHighlightState: (id: string | null) => void;
}

type TabId = "events" | "context" | "history" | "validation" | "replay";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SimulationPanel({
  transitions,
  currentStates,
  context,
  transitionLog,
  validationIssues,
  onSendEvent,
  onReset,
  onSetContext,
  onValidate,
  onHighlightState,
}: SimulationPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("events");
  const [eventName, setEventName] = useState("");
  const [eventPayload, setEventPayload] = useState("");
  const [contextDraft, setContextDraft] = useState(JSON.stringify(context, null, 2));
  const [isSending, setIsSending] = useState(false);
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [recordingEvents, setRecordingEvents] = useState<
    Array<{ event: string; payload?: Record<string, unknown> }>
  >([]);
  const [isRecording, setIsRecording] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [isReplaying, setIsReplaying] = useState(false);

  // Auto-play state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, _setPlaySpeed] = useState(1000);

  // Available events from current active states
  const availableEvents = useMemo(() => {
    const events = new Set<string>();
    for (const t of transitions) {
      if (currentStates.includes(t.source)) {
        events.add(t.event);
      }
    }
    return Array.from(events);
  }, [transitions, currentStates]);

  // Send event
  const handleSend = useCallback(
    async (evt?: string) => {
      const eventToSend = evt ?? eventName.trim();
      if (!eventToSend) return;

      setIsSending(true);
      let payload: Record<string, unknown> | undefined;
      if (eventPayload.trim()) {
        try {
          payload = JSON.parse(eventPayload);
        } catch {
          // ignore invalid JSON
        }
      }

      await onSendEvent(eventToSend, payload);

      if (isRecording) {
        setRecordingEvents((prev) => [
          ...prev,
          { event: eventToSend, ...(payload !== undefined ? { payload } : {}) },
        ]);
      }

      if (!evt) setEventName("");
      setIsSending(false);
    },
    [eventName, eventPayload, onSendEvent, isRecording],
  );

  // Basic expression evaluator for client-side delays
  const evaluateDelay = useCallback((expression: string, context: Record<string, unknown>) => {
    try {
      // Replace context.field with actual values
      let evalStr = expression.replace(/context\.([a-zA-Z0-9_]+)/g, (_, key) => {
        const val = context[key];
        return typeof val === "number" ? val.toString() : "0";
      });
      // Handle ** (exponentiation)
      evalStr = evalStr.replace(/([0-9]+)\s*\*\*\s*([0-9]+)/g, "Math.pow($1, $2)");

      // Use Function constructor for a safe-ish subset of JS (only math/numbers)
      return new Function(`return ${evalStr}`)();
    } catch {
      return 1000; // Default to 1s on error
    }
  }, []);

  // Find if any current transition has a delay
  const delayedTransition = useMemo(() => {
    return transitions.find((t) => currentStates.includes(t.source) && t.delayExpression);
  }, [transitions, currentStates]);

  const delay = useMemo(() => {
    return delayedTransition
      ? evaluateDelay(delayedTransition.delayExpression!, context)
      : playSpeed;
  }, [delayedTransition, evaluateDelay, context, playSpeed]);

  // Auto-play logic
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isPlaying && !isSending) {
      timeoutId = setTimeout(() => {
        if (delayedTransition) {
          handleSend(delayedTransition.event);
        } else if (availableEvents.length > 0) {
          const idx = Math.floor(Math.random() * availableEvents.length);
          const randomEvent = availableEvents[idx];
          if (randomEvent) handleSend(randomEvent);
        } else {
          setIsPlaying(false);
        }
      }, delay);
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isPlaying, delay, isSending, delayedTransition, availableEvents, handleSend]);

  // Save context
  const handleSaveContext = useCallback(async () => {
    try {
      const parsed = JSON.parse(contextDraft);
      await onSetContext(parsed);
    } catch {
      // invalid JSON
    }
  }, [contextDraft, onSetContext]);

  // Replay scenario
  const handleReplay = useCallback(
    async (scenario: SavedScenario) => {
      setIsReplaying(true);
      await onReset();
      for (const step of scenario.events) {
        await onSendEvent(step.event, step.payload);
        await new Promise((r) => setTimeout(r, 400));
      }
      setIsReplaying(false);
    },
    [onReset, onSendEvent],
  );

  // Save recording
  const handleSaveRecording = useCallback(() => {
    if (!scenarioName.trim() || recordingEvents.length === 0) return;
    setScenarios((prev) => [...prev, { name: scenarioName.trim(), events: [...recordingEvents] }]);
    setRecordingEvents([]);
    setIsRecording(false);
    setScenarioName("");
  }, [scenarioName, recordingEvents]);

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: "events", label: "Events", icon: <Zap className="w-3.5 h-3.5" /> },
    {
      id: "context",
      label: "Context",
      icon: <Braces className="w-3.5 h-3.5" />,
    },
    {
      id: "history",
      label: "History",
      icon: <History className="w-3.5 h-3.5" />,
      badge: transitionLog.length,
    },
    {
      id: "validation",
      label: "Validate",
      icon: <ListChecks className="w-3.5 h-3.5" />,
      badge: validationIssues.length,
    },
    { id: "replay", label: "Tests", icon: <Play className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-zinc-950/30 backdrop-blur-md rounded-xl overflow-hidden border border-zinc-800/50 shadow-2xl">
      {/* Simulation Controls Toolbar */}
      <div className="flex items-center gap-3 p-3 border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-xl shrink-0">
        <Button
          onClick={() => setIsPlaying(!isPlaying)}
          variant={isPlaying ? "warning" : "success"}
          size="sm"
          className={`shadow-md transition-all ${
            isPlaying
              ? "bg-amber-600/20 text-amber-500 hover:bg-amber-600/30"
              : "bg-emerald-600/20 text-emerald-500 hover:bg-emerald-600/30"
          } flex-1 sm:flex-none`}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 mr-2" />
          ) : (
            <Play className="w-4 h-4 mr-2 fill-current" />
          )}
          {isPlaying ? "Pause" : "Auto Play"}
        </Button>

        <div className="h-6 w-[1px] bg-zinc-800/80" />

        <Button
          onClick={onReset}
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-lg hover:bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors"
          title="Reset Machine"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>

        <div className="flex-1" />

        {isPlaying && (
          <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-500 font-bold tracking-widest animate-pulse max-w-[120px] justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_currentColor]" />
            RUNNING
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1.5 px-3 py-2.5 border-b border-zinc-800/80 bg-zinc-950/80 shrink-0 overflow-x-auto custom-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap border ${
              activeTab === tab.id
                ? "bg-zinc-800/80 text-white border-zinc-700/50 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60 border-transparent"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                aria-label={`${tab.badge} item${tab.badge !== 1 ? "s" : ""}`}
                className={`min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  tab.id === "validation"
                    ? "bg-red-500/20 text-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]"
                    : "bg-zinc-700 text-zinc-300"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ── Events tab ─────────────────────────────────────────── */}
        {activeTab === "events" && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-zinc-900/40 border border-zinc-800/80 rounded-xl focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all shadow-inner">
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Event name..."
                  aria-label="Event name"
                  className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none h-9 font-medium"
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  id="send-event-input"
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!eventName.trim() || isSending}
                  variant="aurora"
                  size="sm"
                  className="h-8 px-4 text-xs font-semibold shadow-md"
                  id="send-event-btn"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Send
                </Button>
              </div>
            </div>

            <textarea
              value={eventPayload}
              onChange={(e) => setEventPayload(e.target.value)}
              placeholder='Payload (JSON): {"key": "value"}'
              aria-label="Event payload (JSON)"
              className="w-full h-24 px-4 py-3 bg-zinc-900/40 border border-zinc-800/80 shadow-inner rounded-xl text-[11px] text-zinc-300 placeholder-zinc-700 font-mono resize-none focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />

            {availableEvents.length > 0 ? (
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider pl-1">
                  Available Transitions
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {availableEvents.map((evt) => (
                    <button
                      key={evt}
                      onClick={() => handleSend(evt)}
                      disabled={isSending}
                      className="group relative flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-[13px] font-semibold bg-zinc-900/40 text-zinc-300 border border-zinc-800/80 hover:bg-zinc-800/80 hover:border-indigo-500/50 hover:text-white transition-all duration-200 disabled:opacity-40 overflow-hidden shadow-sm hover:shadow-md"
                    >
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/30 group-hover:bg-indigo-500 transition-colors" />
                      <Zap className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-300 transform group-hover:scale-110 transition-transform" />
                      {evt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-zinc-900/30 border border-dashed border-zinc-800 text-center flex flex-col items-center gap-2">
                <div className="p-2 rounded-full bg-zinc-800/50 text-zinc-500">
                  <Zap className="w-5 h-5 opacity-40" />
                </div>
                <p className="text-zinc-500 text-xs font-medium">
                  No transitions available from current state.
                </p>
              </div>
            )}

            {/* Active states display */}
            <div className="space-y-2 pt-4 border-t border-zinc-800/50">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
                Active States
              </p>
              <div className="flex flex-wrap gap-2">
                {currentStates.map((s) => (
                  <span
                    key={s}
                    className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {s}
                  </span>
                ))}
                {currentStates.length === 0 && (
                  <span className="text-xs text-zinc-600 italic pl-1">No active states</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Context tab ────────────────────────────────────────── */}
        {activeTab === "context" && (
          <div className="space-y-3 h-full flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider pl-1">
                Machine Context
              </p>
              <Button
                onClick={handleSaveContext}
                size="sm"
                variant="outline"
                className="h-8 text-xs font-semibold border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200 shadow-sm"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save Changes
              </Button>
            </div>
            <textarea
              value={contextDraft}
              onChange={(e) => setContextDraft(e.target.value)}
              className="flex-1 w-full min-h-[300px] px-4 py-3 bg-zinc-900/40 border border-zinc-800/80 shadow-inner rounded-xl text-[11px] text-zinc-300 font-mono resize-none focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all leading-relaxed"
              spellCheck={false}
            />
          </div>
        )}

        {/* ── History tab ────────────────────────────────────────── */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {transitionLog.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-sm flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-zinc-900/40 border border-zinc-800/80 shadow-inner">
                  <Clock className="w-8 h-8 opacity-40" />
                </div>
                <p className="font-medium">No transitions recorded yet</p>
              </div>
            ) : (
              <div className="space-y-4 pl-3 border-l-2 border-zinc-800/80 ml-2">
                {[...transitionLog].reverse().map((entry, idx) => (
                  <div key={idx} className="group relative pl-4 pb-1">
                    <div className="absolute -left-[5px] top-2 w-2.5 h-2.5 rounded-full bg-zinc-800 border-2 border-zinc-950 group-hover:bg-indigo-500 transition-colors z-10" />

                    <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 group-hover:bg-zinc-900 group-hover:border-zinc-700 transition-all space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-200">{entry.event}</span>
                        </div>
                        <span className="text-[10px] text-zinc-600 font-mono">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-500 border border-zinc-800">
                          {entry.fromStates.join(", ")}
                        </span>
                        <span className="text-zinc-600">→</span>
                        <span className="px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-300 border border-zinc-700 font-medium shadow-sm">
                          {entry.toStates.join(", ")}
                        </span>
                      </div>

                      {(entry.guardEvaluated || entry.actionsExecuted.length > 0) && (
                        <div className="pt-2 border-t border-zinc-800/50 flex gap-3 text-[10px]">
                          {entry.guardEvaluated && (
                            <span className="text-amber-500/70 font-mono">
                              guard: {entry.guardEvaluated}
                            </span>
                          )}
                          {entry.actionsExecuted.length > 0 && (
                            <span className="text-indigo-400/70">
                              actions: {entry.actionsExecuted.map((a) => a.type).join(", ")}
                            </span>
                          )}
                        </div>
                      )}

                      {JSON.stringify(entry.beforeContext) !==
                        JSON.stringify(entry.afterContext) && (
                        <details className="text-[10px] pt-1">
                          <summary className="text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors list-none flex items-center gap-1">
                            <span className="text-[8px]">▶</span> Context updated
                          </summary>
                          <pre className="mt-2 p-2 rounded bg-black/40 text-zinc-400 font-mono whitespace-pre-wrap overflow-x-auto border border-zinc-800">
                            {JSON.stringify(entry.afterContext, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Validation tab ─────────────────────────────────────── */}
        {activeTab === "validation" && (
          <>
            <Button
              onClick={onValidate}
              variant="default"
              className="w-full bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20"
            >
              <ListChecks className="w-4 h-4 mr-2" />
              Run Validation Analysis
            </Button>

            {validationIssues.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-sm flex flex-col items-center gap-3">
                <CheckCircle className="w-10 h-10 text-emerald-500/20" />
                <p>No issues found. Machine is valid.</p>
              </div>
            ) : (
              <div className="space-y-2 mt-4">
                {validationIssues.map((issue, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (issue.stateId) onHighlightState(issue.stateId);
                    }}
                    aria-label={`${
                      issue.level === "error" ? "Error" : "Warning"
                    }: ${issue.message}${
                      issue.stateId ? ` (highlight state ${issue.stateId})` : ""
                    }`}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all hover:scale-[1.01] hover:shadow-md ${
                      issue.level === "error"
                        ? "bg-red-500/5 border-red-500/20 text-red-300 hover:bg-red-500/10"
                        : "bg-amber-500/5 border-amber-500/20 text-amber-300 hover:bg-amber-500/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {issue.level === "error" ? (
                        <div className="p-1 rounded-full bg-red-500/10 text-red-500">
                          <XCircle className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="p-1 rounded-full bg-amber-500/10 text-amber-500">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-xs font-medium leading-relaxed">{issue.message}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {issue.stateId && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/20 text-current border border-white/5 uppercase tracking-wider">
                              State: {issue.stateId}
                            </span>
                          )}
                          {issue.transitionId && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/20 text-current border border-white/5 uppercase tracking-wider">
                              Trans: {issue.transitionId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Replay tab ─────────────────────────────────────────── */}
        {activeTab === "replay" && (
          <>
            {/* Recording controls */}
            <div className="space-y-4">
              {!isRecording ? (
                <Button
                  onClick={() => {
                    setIsRecording(true);
                    setRecordingEvents([]);
                  }}
                  variant="destructive"
                  className="w-full shadow-lg shadow-red-900/20"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse mr-2.5" />
                  Start Recording Scenario
                </Button>
              ) : (
                <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-rose-950/30 to-black border border-rose-500/20 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-rose-300 font-bold uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      Recording...
                    </div>
                    <span className="text-xs font-mono bg-rose-950/50 px-2 py-1 rounded text-rose-300 border border-rose-500/20">
                      {recordingEvents.length} events
                    </span>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      value={scenarioName}
                      onChange={(e) => setScenarioName(e.target.value)}
                      placeholder="Name this scenario..."
                      className="w-full px-3 py-2 bg-black/40 border border-rose-500/30 rounded-lg text-xs text-rose-100 placeholder-rose-500/50 focus:outline-none focus:border-rose-500 transition-colors"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveRecording}
                        disabled={!scenarioName.trim() || recordingEvents.length === 0}
                        variant="default"
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                      >
                        Save
                      </Button>
                      <Button
                        onClick={() => {
                          setIsRecording(false);
                          setRecordingEvents([]);
                        }}
                        variant="secondary"
                        size="sm"
                      >
                        Discard
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Saved scenarios */}
            <div className="space-y-3 mt-6">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
                Saved Scenarios ({scenarios.length})
              </p>
              {scenarios.length === 0 ? (
                <p className="text-xs text-zinc-600 italic pl-1">
                  No saved scenarios. Record event sequences to create automated tests.
                </p>
              ) : (
                scenarios.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 transition-all hover:border-indigo-500/30 hover:bg-zinc-900 group"
                  >
                    <div>
                      <p className="text-xs font-bold text-zinc-200 group-hover:text-white transition-colors">
                        {s.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                          {s.events.length} events
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Button
                        onClick={() => handleReplay(s)}
                        disabled={isReplaying}
                        size="icon"
                        variant="default"
                        className="h-8 w-8 rounded-lg"
                        title="Replay"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </Button>
                      <Button
                        onClick={() => setScenarios((prev) => prev.filter((_, i) => i !== idx))}
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg hover:bg-red-500/20 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
