import { useState, useMemo } from "react";
import type { HistoryItem } from "../../hooks/useQaStudioMcp";
import { ChevronDown, ChevronUp, Terminal, Filter } from "lucide-react";
import { cn } from "../../../styling/cn";

export function ConsolePanel({ history }: { history: HistoryItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<"all" | "success" | "error" | "pending">("all");

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (filter === "all") return true;
      if (filter === "error") return !!item.error;
      if (filter === "success") return !!item.result && !item.error;
      if (filter === "pending") return !item.result && !item.error;
      return true;
    });
  }, [history, filter]);

  return (
    <div
      className={cn(
        "border-t border-border flex flex-col bg-background transition-all duration-300 ease-in-out shadow-lg z-10",
        expanded ? "h-80" : "h-11",
      )}
    >
      <div className="h-11 flex items-center px-4 border-b border-border bg-card">
        <div
          className="flex items-center flex-1 cursor-pointer select-none group h-full"
          onClick={() => setExpanded(!expanded)}
        >
          <Terminal className="w-4 h-4 mr-2.5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-[13px] font-semibold tracking-tight text-foreground">
            Console{" "}
            <span className="text-muted-foreground ml-1 font-normal">({history.length})</span>
          </span>
          <div className="ml-2 p-1 hover:bg-muted rounded-md transition-colors">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {expanded && (
          <div className="flex items-center gap-2 ml-4">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="flex bg-muted/50 p-0.5 rounded-md border border-border">
              {(["all", "success", "error", "pending"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-medium rounded-sm transition-colors capitalize",
                    filter === f
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {expanded && (
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-3 bg-muted/10 scrollbar-thin scrollbar-thumb-border">
          {filteredHistory.length === 0 && (
            <div className="text-muted-foreground text-xs italic text-center py-8 opacity-60">
              {history.length === 0
                ? "No tool calls yet. Start exploring!"
                : `No ${filter} tool calls found.`}
            </div>
          )}
          {filteredHistory.map((item) => (
            <div
              key={item.id}
              className="border border-border bg-background rounded-xl p-3.5 text-xs font-mono shadow-sm hover:border-primary/30 transition-colors group"
            >
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary flex items-center gap-1.5 text-[13px]">
                    <span className="text-primary/40 text-[10px]">▶</span> {item.tool}
                  </span>
                  {item.error ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                      ERROR
                    </span>
                  ) : item.result ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-success/10 text-success-foreground border border-success/20">
                      SUCCESS
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-warning/10 text-warning-foreground border border-warning/20 animate-pulse">
                      PENDING
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                  {item.duration && <span className="italic">{item.duration}ms</span>}
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-1">
                    Arguments
                  </div>
                  <div className="text-muted-foreground break-all leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/50">
                    {JSON.stringify(item.args)}
                  </div>
                </div>

                {item.error ? (
                  <div>
                    <div className="text-[10px] font-bold text-destructive/70 uppercase tracking-wider mb-1">
                      Error Message
                    </div>
                    <div className="text-destructive p-2.5 bg-destructive/5 rounded-lg border border-destructive/20 break-all leading-normal">
                      {item.error}
                    </div>
                  </div>
                ) : item.result ? (
                  <div>
                    <div className="text-[10px] font-bold text-success-foreground/70 uppercase tracking-wider mb-1">
                      Result
                    </div>
                    <div className="text-foreground/80 p-2.5 bg-green-500/5 rounded-lg border border-green-500/20 break-all leading-normal max-h-32 overflow-auto scrollbar-thin scrollbar-thumb-border">
                      {JSON.stringify(item.result)}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
