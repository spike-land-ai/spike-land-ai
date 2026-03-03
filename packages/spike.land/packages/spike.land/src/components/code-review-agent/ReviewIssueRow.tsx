"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, Info, Lightbulb, X } from "lucide-react";

export type IssueSeverity = "error" | "warning" | "info" | "suggestion";

interface ReviewIssueRowProps {
  severity: IssueSeverity;
  filePath: string;
  lineNumber?: number;
  message: string;
  ruleId?: string;
}

const severityConfig: Record<
  IssueSeverity,
  { color: string; badgeClass: string; icon: React.ComponentType<{ className?: string; }>; }
> = {
  error: {
    color: "text-red-400",
    badgeClass: "bg-red-500/10 text-red-400 border-red-500/20",
    icon: X,
  },
  warning: {
    color: "text-yellow-400",
    badgeClass: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    icon: AlertTriangle,
  },
  info: {
    color: "text-blue-400",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: Info,
  },
  suggestion: {
    color: "text-purple-400",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    icon: Lightbulb,
  },
};

export function ReviewIssueRow({
  severity,
  filePath,
  lineNumber,
  message,
  ruleId,
}: ReviewIssueRowProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 py-3 px-4 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
      <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", config.color)} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn("text-xs", config.badgeClass)}>
            {severity}
          </Badge>
          <code className="text-xs text-zinc-400 font-mono truncate">
            {filePath}
            {lineNumber !== undefined && <span className="text-zinc-500">:{lineNumber}</span>}
          </code>
          {ruleId && (
            <Badge
              variant="outline"
              className="text-xs text-zinc-500 border-zinc-700 font-mono"
            >
              {ruleId}
            </Badge>
          )}
        </div>
        <p className="text-sm text-zinc-300 leading-snug">{message}</p>
      </div>
    </div>
  );
}
