"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { AgentResponse } from "@/lib/validations/agent";
import {
  Activity,
  Clock,
  Code2,
  FolderOpen,
  MessageSquare,
  MoreVertical,
  Pencil,
  Power,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";

interface AgentCardProps {
  agent: AgentResponse;
  onRename?: (agent: AgentResponse) => void;
  onSendTask?: (agent: AgentResponse) => void;
  onDisconnect?: (agent: AgentResponse) => void;
  onDelete?: (agent: AgentResponse) => void;
}

const statusConfig = {
  online: {
    label: "Online",
    variant: "success" as const,
    dotClass: "bg-aurora-green animate-pulse",
  },
  sleeping: {
    label: "Sleeping",
    variant: "warning" as const,
    dotClass: "bg-aurora-yellow",
  },
  offline: {
    label: "Offline",
    variant: "outline" as const,
    dotClass: "bg-gray-400",
  },
};

export function AgentCard({
  agent,
  onRename,
  onSendTask,
  onDisconnect,
  onDelete,
}: AgentCardProps) {
  const status = statusConfig[agent.status];

  // Calculate time since last seen
  const getTimeSince = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Get top tools used
  const topTools = agent.toolStats
    ? Object.entries(agent.toolStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
    : [];

  return (
    <Card
      className={cn(
        "group relative transition-all duration-300",
        agent.status === "online" && "ring-1 ring-aurora-green/30",
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <div className="relative">
              <div
                className={cn(
                  "h-3 w-3 rounded-full",
                  status.dotClass,
                )}
              />
              {agent.status === "online" && (
                <div className="absolute inset-0 h-3 w-3 animate-ping rounded-full bg-aurora-green/50" />
              )}
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                {agent.displayName}
              </CardTitle>
              <CardDescription className="text-xs">
                {agent.machineId.slice(0, 8)}...
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onRename?.(agent)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onSendTask?.(agent)}
                  disabled={agent.status === "offline"}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send Task
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {agent.status !== "offline" && (
                  <DropdownMenuItem
                    onClick={() => onDisconnect?.(agent)}
                    className="text-aurora-yellow"
                  >
                    <Power className="mr-2 h-4 w-4" />
                    Disconnect
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => onDelete?.(agent)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Project info */}
        {agent.projectPath && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FolderOpen className="h-4 w-4 flex-shrink-0" />
            <span className="truncate" title={agent.projectPath}>
              {agent.projectPath.split("/").slice(-2).join("/")}
            </span>
          </div>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{getTimeSince(agent.lastSeenAt)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            <span>{agent.totalTasksCompleted} tasks</span>
          </div>
          <div className="flex items-center gap-1">
            <Code2 className="h-3 w-3" />
            <span>{agent.totalTokensUsed.toLocaleString()} tokens</span>
          </div>
        </div>

        {/* Top tools */}
        {topTools.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {topTools.map(([tool, count]) => (
              <Badge key={tool} variant="outline" className="text-xs">
                {tool}: {count}
              </Badge>
            ))}
          </div>
        )}

        {/* Recent activity */}
        {agent.recentActivity && agent.recentActivity.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Recent Activity
            </p>
            <div className="space-y-1">
              {agent.recentActivity.slice(0, 2).map((activity, i) => (
                <p
                  key={`${activity.timestamp}-${i}`}
                  className="text-xs text-muted-foreground/80 truncate"
                  title={activity.description}
                >
                  {activity.description}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            asChild
          >
            <Link href={`/agents/${agent.id}`}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat
            </Link>
          </Button>
          {agent.status === "online" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onSendTask?.(agent)}
            >
              <Send className="mr-2 h-4 w-4" />
              Task
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
