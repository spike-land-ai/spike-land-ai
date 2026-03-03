import { useState, useEffect, useRef } from "react";
import { Terminal, CheckCircle2, Clock, Activity } from "lucide-react";

interface ToolCallLog {
  id: string;
  timestamp: Date;
  toolName: string;
  args: Record<string, unknown>;
  durationMs: number;
  isError?: boolean;
  status?: "PENDING" | "COMPLETED" | "ERROR";
  result?: string | null;
}

export function LiveActivity() {
  const [logs, setLogs] = useState<ToolCallLog[]>([]);

  useEffect(() => {
    let isMounted = true;
    let pollTimeout: number;

    async function pollRealCalls() {
      try {
        const url = import.meta.env.VITE_API_URL || "";
        const response = await fetch(`${url}/api/monitoring/calls`);
        const data = await response.json();

        if (!isMounted) return;

        if (data.calls && Array.isArray(data.calls)) {
          const fetchedLogs: ToolCallLog[] = data.calls
            .map((c: any) => ({
              id: c.id,
              timestamp: new Date(c.createdAt),
              toolName: c.toolName,
              args: (typeof c.args === "string" ? JSON.parse(c.args) : c.args) || {},
              durationMs: c.durationMs,
              isError: !!c.isError,
              status: c.status || (c.isError ? "ERROR" : "COMPLETED"),
              result: c.result,
            }))
            .filter((c: ToolCallLog) => !c.isError);

          setLogs(fetchedLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 50));
        }
      } catch (err) {
        console.error("Failed to load monitoring tool calls", err);
      } finally {
        if (isMounted) {
          pollTimeout = window.setTimeout(pollRealCalls, 2000);
        }
      }
    }

    pollRealCalls();
    return () => {
      isMounted = false;
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, []);

  return (
    <div className="h-full w-full bg-obsidian-950/50 font-mono text-[10px] overflow-hidden flex flex-col rounded-3xl border border-white/5">
      <div className="flex items-center gap-3 p-4 bg-white/5 border-b border-white/5">
        <Activity className="w-4 h-4 text-emerald-neon animate-pulse" />
        <span className="font-black uppercase tracking-[0.2em] text-gray-400">Live Orchestration Stream</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-neon animate-ping" />
          <span className="text-emerald-neon/70 font-black">SYNCED</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {logs.map((log, index) => (
          <div
            key={log.id}
            className={`animate-in fade-in slide-in-from-right-4 duration-500 rounded-2xl bg-white/5 border border-white/5 p-4 hover:bg-white/10 transition-all ${index === 0 ? "neon-border-emerald" : ""}`}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
              <div className="flex items-center gap-3">
                <span className="text-gray-600 font-black tracking-tighter uppercase">
                  {log.timestamp.toLocaleTimeString(undefined, { hour12: false })}
                </span>
                <span className="text-amber-neon font-black uppercase tracking-widest text-[11px]">
                  {log.toolName.replace("img_", "PIXEL.")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {log.status === "PENDING" ? (
                  <div className="w-3 h-3 border-2 border-amber-neon/30 border-t-amber-neon rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-neon opacity-50" />
                )}
              </div>
            </div>

            <pre className="text-gray-400 whitespace-pre-wrap leading-relaxed opacity-80">
              {Object.entries(log.args || {}).map(([key, val]) => (
                <div key={key} className="flex gap-2">
                  <span className="text-gray-600 font-black uppercase">{key}</span>
                  <span className="text-gray-300 truncate">{String(val)}</span>
                </div>
              ))}
            </pre>
          </div>
        ))}
        
        {logs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-4 py-20 opacity-20">
            <Terminal className="w-12 h-12 text-gray-500" />
            <span className="font-black uppercase tracking-[0.3em] animate-pulse">Awaiting Signal...</span>
          </div>
        )}
      </div>
    </div>
  );
}
