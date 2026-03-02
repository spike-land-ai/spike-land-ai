"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TestRunCardProps {
  runId: string;
  suiteName: string;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  timestamp: string;
  status: "running" | "passed" | "failed";
}

const statusStyles: Record<TestRunCardProps["status"], string> = {
  running: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  passed: "bg-green-500/10 text-green-400 border-green-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TestRunCard({
  runId,
  suiteName,
  passed,
  failed,
  skipped,
  durationMs,
  timestamp,
  status,
}: TestRunCardProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base text-zinc-100">{suiteName}</CardTitle>
          <Badge variant="outline" className={cn("text-xs shrink-0", statusStyles[status])}>
            {status}
          </Badge>
        </div>
        <p className="text-xs text-zinc-500 font-mono">{runId}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm font-mono">
          <span className="text-green-400">
            <span className="text-zinc-400 mr-1">passed</span>
            {passed}
          </span>
          <span className="text-red-400">
            <span className="text-zinc-400 mr-1">failed</span>
            {failed}
          </span>
          <span className="text-yellow-400">
            <span className="text-zinc-400 mr-1">skipped</span>
            {skipped}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{formatDuration(durationMs)}</span>
          <span>{formatTimestamp(timestamp)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
