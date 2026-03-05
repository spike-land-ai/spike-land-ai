import React, { useState } from "react";
import type { HistoryItem } from "../../hooks/useQaStudioMcp";
import { ChevronDown, ChevronUp, Terminal } from "lucide-react";

export function ConsolePanel({ history }: { history: HistoryItem[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border-t border-border flex flex-col bg-card transition-all ${expanded ? "h-64" : "h-10"}`}>
      <div 
        className="h-10 flex items-center px-4 cursor-pointer hover:bg-muted/50 select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <Terminal className="w-4 h-4 mr-2 text-muted-foreground" />
        <span className="text-sm font-medium flex-1">Console ({history.length})</span>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
      </div>
      {expanded && (
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-2 bg-muted/10">
          {history.length === 0 && (
            <div className="text-muted-foreground text-xs italic text-center py-4">No tool calls yet</div>
          )}
          {history.map(item => (
            <div key={item.id} className="border border-border bg-background rounded p-3 text-xs font-mono shadow-sm">
              <div className="flex justify-between text-muted-foreground mb-2 pb-2 border-b border-border/50">
                <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                {item.duration && <span>{item.duration}ms</span>}
              </div>
              <div className="font-semibold text-primary mb-1">▶ {item.tool}</div>
              <div className="text-muted-foreground mb-2 break-all">{JSON.stringify(item.args)}</div>
              
              {item.error ? (
                <div className="text-red-500 mt-2 p-2 bg-red-500/10 rounded border border-red-500/20 break-all">Error: {item.error}</div>
              ) : item.result ? (
                <div className="text-green-600 dark:text-green-500 mt-2">✓ Success</div>
              ) : (
                <div className="text-yellow-600 dark:text-yellow-500 mt-2 animate-pulse">⟳ Pending...</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
