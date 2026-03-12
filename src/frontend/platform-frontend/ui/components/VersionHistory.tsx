import { History, User, Clock, Check, ChevronRight } from "lucide-react";
import { cn } from "../../styling/cn";

interface AppVersion {
  version: number;
  changeDescription: string;
  author?: string;
  timestamp: string;
}

interface VersionHistoryProps {
  versions: AppVersion[];
}

export function VersionHistory({ versions }: VersionHistoryProps) {
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const latest = sorted[0]?.version;

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <div className="p-4 rounded-full bg-muted">
          <History className="size-8 text-muted-foreground/30" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-foreground">No versions recorded</p>
          <p className="text-xs text-muted-foreground">
            Changes will appear here as you update your application.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-6 before:absolute before:left-6 before:top-2 before:bottom-2 before:w-px before:bg-border/50">
      {sorted.map((v) => (
        <div
          key={v.version}
          className={cn(
            "relative flex items-start gap-6 group transition-all duration-300",
            v.version === latest ? "opacity-100" : "opacity-70 hover:opacity-100",
          )}
        >
          <div
            className={cn(
              "relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-300 shadow-sm",
              v.version === latest
                ? "bg-primary border-primary text-primary-foreground shadow-primary/20 scale-110"
                : "bg-card border-border text-muted-foreground group-hover:border-primary/30 group-hover:text-primary",
            )}
          >
            {v.version === latest ? (
              <Check className="size-5" />
            ) : (
              <span className="text-xs font-black uppercase">v{v.version}</span>
            )}
          </div>

          <div
            className={cn(
              "flex-1 rounded-3xl border p-5 transition-all duration-300",
              v.version === latest
                ? "bg-card border-primary/20 shadow-xl shadow-primary/5"
                : "border-border bg-card/50 hover:bg-card hover:border-border hover:shadow-md",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-foreground leading-snug">
                    {v.changeDescription}
                  </h4>
                  {v.version === latest && (
                    <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-success-foreground border border-success/10">
                      Active
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-[11px] font-medium text-muted-foreground/60">
                  {v.author && (
                    <div className="flex items-center gap-1.5">
                      <User className="size-3" />
                      <span>{v.author}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-3" />
                    <span>
                      {new Date(v.timestamp).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter text-muted-foreground/30 group-hover:text-primary transition-colors">
                Details
                <ChevronRight className="size-3" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export type { AppVersion, VersionHistoryProps };
