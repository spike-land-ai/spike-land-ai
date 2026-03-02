"use client";

import { cn } from "@/lib/utils";

interface SwarmStatsBarProps {
  active: number;
  idle: number;
  completed: number;
  failed: number;
  totalTasks: number;
  completedTasks: number;
}

interface StatItemProps {
  label: string;
  count: number;
  dotClass: string;
  textClass: string;
}

function StatItem({ label, count, dotClass, textClass }: StatItemProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", dotClass)} />
      <span className={cn("text-sm font-semibold tabular-nums", textClass)}>{count}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}

export function SwarmStatsBar({
  active,
  idle,
  completed,
  failed,
  totalTasks,
  completedTasks,
}: SwarmStatsBarProps) {
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 space-y-4">
      <div className="flex items-center flex-wrap gap-x-6 gap-y-3">
        <StatItem
          label="active"
          count={active}
          dotClass="bg-green-400 animate-pulse"
          textClass="text-green-400"
        />
        <StatItem label="idle" count={idle} dotClass="bg-zinc-500" textClass="text-zinc-300" />
        <StatItem
          label="completed"
          count={completed}
          dotClass="bg-blue-400"
          textClass="text-blue-400"
        />
        <StatItem label="failed" count={failed} dotClass="bg-red-400" textClass="text-red-400" />

        <div className="flex-1 min-w-[160px]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-zinc-500">Task Progress</span>
            <span className="text-xs font-mono text-zinc-300">
              {completedTasks}/{totalTasks}
              <span className="text-zinc-600 ml-1">({progressPct}%)</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
