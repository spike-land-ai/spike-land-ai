import { useState } from "react";
import type { HistoryItem } from "../../hooks/useQaStudioMcp";
import { ChevronDown, ChevronUp, Terminal } from "lucide-react";
import { cn } from "../../../styling/cn";

export function ConsolePanel({ history }: { history: HistoryItem[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn("border-t border-border flex flex-col bg-card/90 dark:glass-card backdrop-blur-md transition-all duration-300 ease-in-out shadow-lg z-10", expanded ? "h-80" : "h-11")}>
      <div 
        className="h-11 flex items-center px-4 cursor-pointer hover:bg-muted/40 active:bg-muted/60 select-none transition-colors border-b border-transparent group"
        onClick={() => setExpanded(!expanded)}
      >
        <Terminal className="w-4 h-4 mr-2.5 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="text-[13px] font-semibold flex-1 tracking-tight">Console <span className="text-muted-foreground/60 ml-1 font-normal">({history.length})</span></span>
        <div className="p-1 hover:bg-muted/80 rounded-md transition-colors">
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>
      {expanded && (
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-3 bg-muted/10 scrollbar-thin scrollbar-thumb-border">
          {history.length === 0 && (
            <div className="text-muted-foreground text-xs italic text-center py-8 opacity-60">No tool calls yet. Start exploring!</div>
          )}
          {history.map(item => (
            <div key={item.id} className="border border-border/50 bg-background/60 dark:glass-card rounded-xl p-3.5 text-xs font-mono shadow-sm hover:border-primary/20 transition-colors group">
              <div className="flex justify-between text-[10px] text-muted-foreground/70 mb-2.5 pb-2 border-b border-border/30">
                <span className="bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider">{new Date(item.timestamp).toLocaleTimeString()}</span>
                {item.duration && <span className="italic">{item.duration}ms</span>}
              </div>
              <div className="font-bold text-primary mb-1.5 flex items-center gap-1.5">
                <span className="text-primary/40">▶</span> {item.tool}
              </div>
              <div className="text-muted-foreground/90 mb-2.5 break-all leading-relaxed bg-muted/30 p-2 rounded-lg border border-border/20">{JSON.stringify(item.args)}</div>
              
              {item.error ? (
                <div className="text-destructive mt-2.5 p-3 bg-destructive/10 rounded-lg border border-destructive/20 break-all leading-normal">
                  <span className="font-bold mr-1">Error:</span> {item.error}
                </div>
              ) : item.result ? (
                <div className="text-green-600 dark:text-green-400 mt-2.5 flex items-center gap-1.5 font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Success
                </div>
              ) : (
                <div className="text-yellow-600 dark:text-yellow-400 mt-2.5 animate-pulse flex items-center gap-1.5 font-medium">
                   <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> Pending...
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
