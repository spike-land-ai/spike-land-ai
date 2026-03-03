"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

type Priority = "low" | "medium" | "high" | "critical";
type TaskStatus = "pending" | "in-progress" | "completed" | "failed";

interface TaskDelegationCardProps {
  taskId: string;
  taskTitle: string;
  priority: Priority;
  senderName: string;
  receiverName: string;
  status: TaskStatus;
  estimatedMs?: number;
}

const priorityClass: Record<Priority, string> = {
  low: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
};

const statusClass: Record<TaskStatus, string> = {
  pending: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  "in-progress": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  completed: "bg-green-500/10 text-green-400 border-green-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
};

const statusDot: Record<TaskStatus, string> = {
  pending: "bg-zinc-500",
  "in-progress": "bg-cyan-400 animate-pulse",
  completed: "bg-green-400",
  failed: "bg-red-400",
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

export function TaskDelegationCard({
  taskId,
  taskTitle,
  priority,
  senderName,
  receiverName,
  status,
  estimatedMs,
}: TaskDelegationCardProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Badge
            variant="outline"
            className={cn("text-xs capitalize", priorityClass[priority])}
          >
            {priority}
          </Badge>
          <Badge
            variant="outline"
            className={cn("text-xs capitalize ml-auto", statusClass[status])}
          >
            <span
              className={cn("h-1.5 w-1.5 rounded-full mr-1.5", statusDot[status])}
            />
            {status}
          </Badge>
        </div>
        <CardTitle className="text-base text-zinc-100 leading-tight">
          {taskTitle}
        </CardTitle>
        <p className="text-xs text-zinc-600 font-mono">{taskId}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Sender -> Receiver */}
        <div className="flex items-center gap-2 bg-zinc-800/60 rounded-lg px-3 py-2">
          <span className="text-xs text-zinc-300 font-medium truncate max-w-[80px]">
            {senderName}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
          <span className="text-xs text-zinc-300 font-medium truncate max-w-[80px]">
            {receiverName}
          </span>
        </div>

        {estimatedMs !== undefined && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Est. time</span>
            <span className="font-mono text-zinc-400">{formatMs(estimatedMs)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
