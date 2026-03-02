"use client";

import { useState } from "react";
import { FileText, Lightbulb, Loader2, Send, Sparkles } from "lucide-react";
import type { MachineExport } from "@/lib/state-machine/types";
import { mcpCall } from "@/components/state-machine/use-state-machine";

interface AIPanelProps {
  machineExport: MachineExport | null;
  machineName: string;
  isOpen: boolean;
  onClose: () => void;
  onGenerateMachine: (prompt: string) => Promise<void>;
}

type AIMode = "describe" | "generate" | "suggest";

export function AIPanel({
  machineExport,
  machineName,
  isOpen,
  onClose,
  onGenerateMachine,
}: AIPanelProps) {
  const [mode, setMode] = useState<AIMode>("generate");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDescribe = async () => {
    if (!machineExport) return;
    setIsProcessing(true);
    setError(null);
    setResult("");

    try {
      const data = await mcpCall("chat_send_message", {
        message: `Describe this state machine in plain English. Explain its purpose, states, transitions, and edge cases:\n\n${JSON.stringify(
          machineExport,
          null,
          2,
        )}`,
      });

      const text = data ?? "No description generated.";
      setResult(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to describe machine");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsProcessing(true);
    setError(null);
    setResult("");

    try {
      await onGenerateMachine(prompt);
      setResult(
        "✅ Machine generated successfully! Check the graph to see your new state machine.",
      );
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate machine");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuggest = async () => {
    if (!machineExport) return;
    setIsProcessing(true);
    setError(null);
    setResult("");

    try {
      const data = await mcpCall("chat_send_message", {
        message: `Analyze this state machine and suggest improvements. Look for: missing error states, unreachable paths, missing guards, dead-end recovery transitions, and optimization opportunities. Be specific with actionable suggestions.\n\nMachine: ${JSON.stringify(
          machineExport,
          null,
          2,
        )}`,
      });

      const text = data ?? "No suggestions generated.";
      setResult(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get suggestions");
    } finally {
      setIsProcessing(false);
    }
  };

  const modes: Array<{
    id: AIMode;
    label: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      id: "generate",
      label: "Generate",
      icon: <Sparkles className="w-4 h-4" />,
      color: "#8b5cf6",
    },
    {
      id: "describe",
      label: "Describe",
      icon: <FileText className="w-4 h-4" />,
      color: "#3b82f6",
    },
    {
      id: "suggest",
      label: "Suggest",
      icon: <Lightbulb className="w-4 h-4" />,
      color: "#f59e0b",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        role="button"
        tabIndex={0}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape" || e.key === "Enter") onClose();
        }}
        aria-label="Close AI panel"
      />

      <div className="relative w-full max-w-lg mx-4 bg-zinc-950 border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 shadow-inner">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">AI Assistant</h2>
              <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium mt-0.5">
                {machineName ? `Working on: ${machineName}` : "Create or analyze state machines"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800/80 text-zinc-500 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1.5 px-6 pt-5 shrink-0">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMode(m.id);
                setResult("");
                setError(null);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                mode === m.id
                  ? "text-white shadow-md"
                  : "text-zinc-500 hover:text-zinc-300 bg-transparent"
              }`}
              style={
                mode === m.id
                  ? {
                      background: `${m.color}25`,
                      border: `1px solid ${m.color}40`,
                    }
                  : { border: `1px solid transparent` }
              }
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {mode === "generate" && (
            <div className="space-y-4">
              <p className="text-[13px] text-zinc-400 leading-relaxed font-medium">
                Describe the state machine you want to create in plain English.
              </p>
              <div className="flex gap-2.5">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder='e.g. "Traffic light cycling red → green → yellow → red with NEXT event"'
                  className="flex-1 px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all shadow-inner"
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                  id="ai-generate-input"
                />
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isProcessing}
                  className="px-5 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white disabled:from-zinc-800 disabled:to-zinc-800 shadow-md transition-all flex items-center justify-center shrink-0"
                  id="ai-generate-btn"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 shadow-sm" />
                  )}
                </button>
              </div>
              <div className="text-xs text-zinc-500 space-y-2 mt-2">
                <p className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
                  Examples:
                </p>
                <div className="space-y-1.5 pl-1 border-l-2 border-zinc-800/80">
                  <button
                    type="button"
                    className="block w-full text-left cursor-pointer hover:text-zinc-300 transition-colors pl-2"
                    onClick={() => setPrompt("A stopwatch with start, stop, reset, and lap events")}
                  >
                    &ldquo;A stopwatch with start, stop, reset, and lap events&rdquo;
                  </button>
                  <button
                    type="button"
                    className="block w-full text-left cursor-pointer hover:text-zinc-300 transition-colors pl-2"
                    onClick={() =>
                      setPrompt(
                        "A vending machine that accepts coins, dispenses items, and gives change",
                      )
                    }
                  >
                    &ldquo;A vending machine that accepts coins, dispenses items, and gives
                    change&rdquo;
                  </button>
                  <button
                    type="button"
                    className="block w-full text-left cursor-pointer hover:text-zinc-300 transition-colors pl-2"
                    onClick={() => setPrompt("An elevator controller for a 5-floor building")}
                  >
                    &ldquo;An elevator controller for a 5-floor building&rdquo;
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === "describe" && (
            <div className="space-y-5">
              <p className="text-[13px] text-zinc-400 leading-relaxed font-medium">
                Get a plain-English description of the current machine.
              </p>
              <button
                onClick={handleDescribe}
                disabled={!machineExport || isProcessing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white disabled:from-zinc-800 disabled:to-zinc-800 transition-all shadow-md"
                id="ai-describe-btn"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {isProcessing ? "Analyzing..." : "Describe Machine"}
              </button>
            </div>
          )}

          {mode === "suggest" && (
            <div className="space-y-5">
              <p className="text-[13px] text-zinc-400 leading-relaxed font-medium">
                Get AI-powered improvement suggestions for the current machine to identify edge
                cases and dead ends.
              </p>
              <button
                onClick={handleSuggest}
                disabled={!machineExport || isProcessing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white disabled:from-zinc-800 disabled:to-zinc-800 transition-all shadow-md"
                id="ai-suggest-btn"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lightbulb className="w-4 h-4" />
                )}
                {isProcessing ? "Analyzing..." : "Suggest Improvements"}
              </button>
            </div>
          )}

          {/* Result */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 font-medium">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-4 p-5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shadow-inner">
              <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                {result}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
