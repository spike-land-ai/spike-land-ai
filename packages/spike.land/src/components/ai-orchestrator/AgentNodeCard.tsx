"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AgentType = "researcher" | "coder" | "reviewer" | "coordinator" | "specialist";
type AgentStatus = "active" | "idle" | "completed" | "failed";

interface AgentNodeCardProps {
  agentId: string;
  agentName: string;
  agentType: AgentType;
  status: AgentStatus;
  currentTask?: string | undefined;
  completedTasks?: number | undefined;
}

const statusDotClass: Record<AgentStatus, string> = {
  active: "bg-green-400 animate-pulse",
  idle: "bg-zinc-500",
  completed: "bg-blue-400",
  failed: "bg-red-400",
};

const statusTextClass: Record<AgentStatus, string> = {
  active: "text-green-400",
  idle: "text-zinc-400",
  completed: "text-blue-400",
  failed: "text-red-400",
};

const agentTypeBadgeClass: Record<AgentType, string> = {
  researcher: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  coder: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  reviewer: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  coordinator: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  specialist: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

export function AgentNodeCard({
  agentId,
  agentName,
  agentType,
  status,
  currentTask,
  completedTasks,
}: AgentNodeCardProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge variant="outline" className={cn("text-xs", agentTypeBadgeClass[agentType])}>
            {agentType}
          </Badge>
          <span className={cn("text-xs font-mono ml-auto", statusTextClass[status])}>{status}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full shrink-0", statusDotClass[status])} />
          <CardTitle className="text-base text-zinc-100 leading-tight">{agentName}</CardTitle>
        </div>
        <p className="text-xs text-zinc-600 font-mono">{agentId}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {currentTask && (
          <div className="text-xs text-zinc-400 line-clamp-2 bg-zinc-800/60 rounded px-2 py-1.5">
            {currentTask}
          </div>
        )}
        {completedTasks !== undefined && (
          <div className="text-xs text-zinc-500">
            {completedTasks} task{completedTasks !== 1 ? "s" : ""} completed
          </div>
        )}
      </CardContent>
    </Card>
  );
}
