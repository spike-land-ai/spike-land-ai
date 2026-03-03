"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { type TicketItem, TicketListItem } from "./TicketListItem";

// Memoized wrapper so individual ticket rows don't re-render when unrelated
// state changes in the parent (e.g. search input typing, filter changes).
const MemoTicketListItem = memo(function MemoTicketListItem({
  ticket,
  isSelected,
  onSelectTicket,
}: {
  ticket: TicketItem;
  isSelected: boolean;
  onSelectTicket: (ticket: TicketItem) => void;
}) {
  const handleClick = useCallback(() => onSelectTicket(ticket), [onSelectTicket, ticket]);
  return (
    <TicketListItem
      ticket={ticket}
      isSelected={isSelected}
      onClick={handleClick}
    />
  );
});

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "UNPLANNED", label: "Unplanned" },
  { value: "PLANNING", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "COMPLETED", label: "Done" },
] as const;

export function TicketListPanel({
  tickets,
  selectedTicketNumber,
  onSelectTicket,
  onRefresh,
  isLoading,
}: {
  tickets: TicketItem[];
  selectedTicketNumber: number | null;
  onSelectTicket: (ticket: TicketItem) => void;
  onRefresh: () => void;
  isLoading: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredTickets = useMemo(() =>
    tickets.filter(t => {
      const matchesSearch = !search
        || t.title.toLowerCase().includes(search.toLowerCase())
        || String(t.number).includes(search);

      const status = t.plan?.status ?? "UNPLANNED";
      const matchesFilter = statusFilter === "all"
        || (statusFilter === "active"
          && ["SENT_TO_JULES", "JULES_WORKING", "JULES_REVIEW", "BUILD_FIXING"]
            .includes(status))
        || status === statusFilter;

      return matchesSearch && matchesFilter;
    }), [tickets, search, statusFilter]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">
            Tickets{" "}
            <span className="text-zinc-500 font-normal">
              ({filteredTickets.length})
            </span>
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-7 w-7 text-zinc-400 hover:text-white"
          >
            {isLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-800/50 border border-white/10 rounded-md text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                statusFilter === f.value
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : "bg-zinc-800/50 text-zinc-500 border-white/5 hover:border-white/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {filteredTickets.length === 0 && (
            <p className="text-xs text-zinc-600 text-center py-8">
              {isLoading ? "Loading tickets..." : "No tickets found"}
            </p>
          )}
          {filteredTickets.map(ticket => (
            <MemoTicketListItem
              key={ticket.number}
              ticket={ticket}
              isSelected={selectedTicketNumber === ticket.number}
              onSelectTicket={onSelectTicket}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
