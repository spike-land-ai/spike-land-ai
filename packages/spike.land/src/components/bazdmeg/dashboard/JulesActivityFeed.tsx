"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

interface JulesActivity {
  type?: string;
  content?: string;
}

export function JulesActivityFeed({
  activities,
  sessionUrl,
  sessionState,
  isPolling,
  onRefresh,
}: {
  activities: JulesActivity[];
  sessionUrl: string | null;
  sessionState: string | null;
  isPolling: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium text-zinc-400">Jules Activity</h3>
          {isPolling && <Loader2 className="h-3 w-3 text-cyan-400 animate-spin" />}
          {sessionState && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {sessionState}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {sessionUrl && (
            <a
              href={sessionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            className="h-6 w-6 text-zinc-400 hover:text-white"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {activities.length === 0 && (
            <p className="text-xs text-zinc-600 text-center py-8">
              No activity yet. Jules is getting started...
            </p>
          )}
          {activities.map((activity, i) => (
            <div key={i} className="p-2 rounded-md bg-zinc-800/30 border border-white/5">
              {activity.type && (
                <span className="text-[10px] text-cyan-400 font-medium">{activity.type}</span>
              )}
              {activity.content && (
                <p className="text-xs text-zinc-300 mt-0.5 whitespace-pre-wrap">
                  {activity.content}
                </p>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
