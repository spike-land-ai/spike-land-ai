"use client";

import { cn } from "@/lib/utils";
import { WorkflowStatusBadge } from "./WorkflowStatusBadge";

export interface TicketItem {
  number: number;
  title: string;
  labels: string[];
  author: string;
  updatedAt: string;
  url: string;
  body: string | null;
  plan: {
    id: string;
    status: string;
    planVersion: number;
    julesSessionId: string | null;
    julesLastState: string | null;
    updatedAt: string;
  } | null;
}

export function TicketListItem({
  ticket,
  isSelected,
  onClick,
}: {
  ticket: TicketItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const timeAgo = getTimeAgo(ticket.updatedAt);

  return (
    <button
      onClick={onClick}
      aria-label={`Ticket #${ticket.number}: ${ticket.title}`}
      aria-pressed={isSelected}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all duration-200",
        isSelected
          ? "bg-zinc-800/80 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
          : "bg-zinc-900/30 border-white/5 hover:border-white/10 hover:bg-zinc-800/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-zinc-500 font-mono">
              #{ticket.number}
            </span>
            <WorkflowStatusBadge status={ticket.plan?.status ?? null} />
          </div>
          <h3 className="text-sm font-medium text-white truncate">
            {ticket.title}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            {ticket.labels.slice(0, 3).map(label => (
              <span
                key={label}
                className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700"
              >
                {label}
              </span>
            ))}
            <span className="text-[10px] text-zinc-600 ml-auto">
              {timeAgo}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
