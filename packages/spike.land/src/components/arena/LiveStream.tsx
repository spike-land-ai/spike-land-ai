"use client";

import { useEffect, useRef, useState } from "react";
import { PhaseSteps } from "./PhaseSteps";
import type { ArenaPhase } from "@/lib/arena/types";

interface LiveStreamProps {
  challengeId: string;
  submissionId: string;
}

interface LogEntry {
  id: number;
  message: string;
  type: "info" | "error" | "success";
  timestamp: number;
}

export function LiveStream({ challengeId, submissionId }: LiveStreamProps) {
  const [phase, setPhase] = useState<ArenaPhase>("PROMPTED");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [codespaceUrl, setCodespaceUrl] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/connect/challenges/${challengeId}/stream?submissionId=${submissionId}`,
    );

    const addLog = (message: string, type: LogEntry["type"] = "info") => {
      const id = ++idRef.current;
      setLogs((prev) => [...prev, { id, message, type, timestamp: Date.now() }]);
    };

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);

        switch (parsed.type) {
          case "connected":
            addLog("Connected to stream");
            break;
          case "phase_update": {
            const data = parsed.data as { phase?: string; message?: string };
            if (data.phase) setPhase(data.phase as ArenaPhase);
            if (data.message) addLog(data.message);
            break;
          }
          case "code_generated":
            addLog("Code generated successfully", "success");
            break;
          case "error_detected": {
            const errData = parsed.data as { error?: string };
            addLog(`Error: ${errData.error || "Unknown"}`, "error");
            break;
          }
          case "error_fixed":
            addLog("Error fixed", "success");
            break;
          case "transpile_success": {
            const tsData = parsed.data as { codespaceUrl?: string };
            if (tsData.codespaceUrl) setCodespaceUrl(tsData.codespaceUrl);
            addLog("Transpilation successful!", "success");
            setPhase("REVIEWING");
            break;
          }
          case "scored": {
            const scoreData = parsed.data as {
              reviewScore?: number;
              eloChange?: number;
            };
            addLog(
              `Scored! ${((scoreData.reviewScore || 0) * 100).toFixed(0)}% (ELO ${
                (scoreData.eloChange || 0) > 0 ? "+" : ""
              }${scoreData.eloChange || 0})`,
              "success",
            );
            setPhase("SCORED");
            break;
          }
          case "failed": {
            const failData = parsed.data as { message?: string };
            addLog(failData.message || "Generation failed", "error");
            setPhase("FAILED");
            break;
          }
        }
      } catch {
        // Invalid JSON
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [challengeId, submissionId]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="space-y-4">
      <PhaseSteps currentPhase={phase} />

      {/* Log output */}
      <div
        ref={logRef}
        className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs"
      >
        {logs.map((log) => (
          <div
            key={log.id}
            className={`mb-1 ${
              log.type === "error"
                ? "text-red-400"
                : log.type === "success"
                  ? "text-green-400"
                  : "text-zinc-400"
            }`}
          >
            <span className="text-zinc-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{" "}
            {log.message}
          </div>
        ))}
        {logs.length === 0 && <span className="text-zinc-600">Waiting for events...</span>}
      </div>

      {/* Live preview iframe */}
      {codespaceUrl && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Live Preview</h3>
          <div className="border border-zinc-800 rounded-lg overflow-hidden bg-white">
            <iframe
              src={codespaceUrl}
              className="w-full h-96"
              title="Live preview"
              sandbox="allow-scripts"
            />
          </div>
        </div>
      )}
    </div>
  );
}
