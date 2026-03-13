import { useCallback, useEffect, useMemo, useState } from "react";
import type { TimeRange, DashboardData } from "./types";
import { LineChart } from "./Charts";
import { downloadCsv, csvFilename } from "./exportCsv";
import { useGA4Data } from "./useGA4Data";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawEvent {
  id: string;
  source: string;
  event_type: string;
  metadata: string | null;
  client_id: string;
  created_at: number;
}

interface EventTimeSeries {
  eventType: string;
  buckets: Array<{ label: string; count: number }>;
}

// ─── Custom event names the platform tracks ──────────────────────────────────

const KNOWN_EVENTS = [
  "support_fistbump",
  "store_app_install",
  "store_browse",
  "app_view",
  "page_view",
  "blog_view",
  "tool_use",
  "signup_completed",
  "mcp_server_connected",
  "first_tool_call",
  "second_session",
  "upgrade_completed",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 1000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildTimeSeries(events: RawEvent[], range: TimeRange): EventTimeSeries[] {
  if (events.length === 0) return [];

  const now = Date.now();

  // Bucket size based on range
  const bucketMs: Record<TimeRange, number> = {
    "1m": 10_000,
    "5m": 30_000,
    "15m": 60_000,
    "1h": 5 * 60_000,
    "6h": 30 * 60_000,
    "24h": 60 * 60_000,
    "7d": 24 * 60 * 60_000,
    "30d": 24 * 60 * 60_000,
    "3mo": 7 * 24 * 60 * 60_000,
    "6mo": 7 * 24 * 60 * 60_000,
    "1y": 30 * 24 * 60 * 60_000,
    "3y": 30 * 24 * 60 * 60_000,
  };
  const size = bucketMs[range] ?? 60 * 60_000;

  const eventTypes = [...new Set(events.map((e) => e.event_type))];
  const results: EventTimeSeries[] = [];

  for (const type of eventTypes) {
    const typeEvents = events.filter((e) => e.event_type === type);
    const earliest = Math.min(...typeEvents.map((e) => e.created_at));
    const numBuckets = Math.max(2, Math.ceil((now - earliest) / size));
    const startTime = now - numBuckets * size;

    const buckets = Array.from({ length: numBuckets }, (_, i) => {
      const bucketStart = startTime + i * size;
      const bucketEnd = bucketStart + size;
      const count = typeEvents.filter(
        (e) => e.created_at >= bucketStart && e.created_at < bucketEnd,
      ).length;

      // Format label based on range
      const d = new Date(bucketStart);
      let label: string;
      if (size < 3_600_000) {
        label = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (size < 86_400_000) {
        label = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else {
        label = d.toLocaleDateString([], { month: "short", day: "numeric" });
      }

      return { label, count };
    });

    results.push({ eventType: type, buckets });
  }

  return results;
}

// ─── ExportButton ─────────────────────────────────────────────────────────────

function ExportButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
      aria-label="Export as CSV"
    >
      <svg
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M8 2v9M4 7l4 4 4-4M2 13h12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Export CSV
    </button>
  );
}

// ─── EventsTab ────────────────────────────────────────────────────────────────

interface EventsTabProps {
  range: TimeRange;
  d1Data: DashboardData | null;
}

export function EventsTab({ range, d1Data }: EventsTabProps) {
  const [selectedEvent, setSelectedEvent] = useState<string>("all");
  const [rawEvents, setRawEvents] = useState<RawEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // GA4 overview data for the time series endpoint
  const { data: _ } = useGA4Data<unknown>("/analytics/ga4/overview", range);

  const fetchRawEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const params = new URLSearchParams({ range, limit: "200" });
      if (selectedEvent !== "all") params.set("type", selectedEvent);

      const res = await fetch(`/analytics/events?${params.toString()}`, {
        credentials: "include",
      });
      if (res.ok) {
        setRawEvents((await res.json()) as RawEvent[]);
      }
    } catch {
      // keep stale
    } finally {
      setEventsLoading(false);
    }
  }, [range, selectedEvent]);

  useEffect(() => {
    fetchRawEvents();
  }, [fetchRawEvents]);

  // Event type counts from D1 summary
  const eventCounts = useMemo(() => {
    return d1Data?.summary?.eventsByType ?? [];
  }, [d1Data]);

  // All known event types (merge from summary + KNOWN_EVENTS with counts)
  const allEventTypes = useMemo(() => {
    const fromData = eventCounts.map((e) => e.event_type);
    const merged = [...new Set([...KNOWN_EVENTS, ...fromData])];
    return merged.map((type) => ({
      type,
      count: eventCounts.find((e) => e.event_type === type)?.count ?? 0,
    }));
  }, [eventCounts]);

  // Time series for selected events
  const timeSeries = useMemo(() => buildTimeSeries(rawEvents, range), [rawEvents, range]);

  const displayedSeries = selectedEvent === "all"
    ? timeSeries.slice(0, 5) // top 5 when all selected
    : timeSeries.filter((s) => s.eventType === selectedEvent);

  // Export handlers
  const handleExportSummary = () => {
    const rows = allEventTypes.map((e) => ({
      event_type: e.type,
      count: e.count,
      range,
    }));
    downloadCsv(rows, csvFilename("analytics-events-summary", range));
  };

  const handleExportTable = () => {
    const rows = rawEvents.map((e) => ({
      id: e.id,
      event_type: e.event_type,
      source: e.source,
      client_id: e.client_id,
      metadata: e.metadata ?? "",
      created_at: new Date(e.created_at).toISOString(),
    }));
    downloadCsv(rows, csvFilename("analytics-events-raw", range));
  };

  const filteredEvents = selectedEvent === "all"
    ? rawEvents
    : rawEvents.filter((e) => e.event_type === selectedEvent);

  return (
    <div className="space-y-6">
      {/* Event type selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedEvent("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedEvent === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All events
          </button>
          {allEventTypes
            .filter((e) => e.count > 0)
            .slice(0, 12)
            .map((e) => (
              <button
                key={e.type}
                type="button"
                onClick={() => setSelectedEvent(e.type)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedEvent === e.type
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {e.type}
                {e.count > 0 && (
                  <span className="ml-1 opacity-60">{e.count.toLocaleString()}</span>
                )}
              </button>
            ))}
        </div>
        <ExportButton onClick={handleExportSummary} disabled={allEventTypes.length === 0} />
      </div>

      {/* Time series chart */}
      <div className="rubik-panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Event Count Over Time
          </h2>
          <span className="text-xs text-muted-foreground">
            {selectedEvent === "all" ? "Top 5 event types" : selectedEvent}
          </span>
        </div>
        {eventsLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        ) : displayedSeries.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No data for this range
          </div>
        ) : (
          <LineChart
            series={displayedSeries.map((s) => ({
              label: s.eventType,
              data: s.buckets.map((b) => b.count),
            }))}
            labels={displayedSeries[0]?.buckets.map((b) => b.label) ?? []}
            height={180}
          />
        )}
      </div>

      {/* Event breakdown table */}
      <div className="rubik-panel p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Event Breakdown
          </h2>
          <ExportButton onClick={handleExportTable} disabled={filteredEvents.length === 0} />
        </div>

        {eventsLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No events found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Event</th>
                  <th className="pb-2 pr-4 font-medium">Source</th>
                  <th className="pb-2 pr-4 font-medium">Properties</th>
                  <th className="pb-2 text-right font-medium whitespace-nowrap">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.slice(0, 100).map((event) => {
                  const meta = parseMetadata(event.metadata);
                  return (
                    <tr key={event.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4">
                        <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {event.event_type}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">
                        {event.source}
                      </td>
                      <td className="py-2 pr-4 max-w-xs">
                        {meta ? (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(meta)
                              .slice(0, 4)
                              .map(([k, v]) => (
                                <span
                                  key={k}
                                  className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                                >
                                  <span className="font-medium">{k}:</span>{" "}
                                  {String(v).slice(0, 30)}
                                </span>
                              ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="py-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {relativeTime(event.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredEvents.length > 100 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Showing 100 of {filteredEvents.length} events. Export CSV for full data.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Event counts summary */}
      {allEventTypes.filter((e) => e.count > 0).length > 0 && (
        <div className="rubik-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              All Event Types — {range}
            </h2>
            <ExportButton onClick={handleExportSummary} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 font-medium">Event Type</th>
                  <th className="pb-2 text-right font-medium">Count</th>
                  <th className="pb-2 text-right font-medium">Share</th>
                  <th className="pb-2 pl-4 font-medium">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {allEventTypes
                  .filter((e) => e.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .map((e) => {
                    const total = allEventTypes.reduce((s, x) => s + x.count, 0);
                    const pct = total > 0 ? (e.count / total) * 100 : 0;
                    const topCount = allEventTypes[0]?.count ?? 1;
                    const barW = (e.count / topCount) * 100;

                    return (
                      <tr key={e.type} className="border-b border-border last:border-0">
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => setSelectedEvent(e.type)}
                            className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                              selectedEvent === e.type
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground hover:bg-muted/80"
                            }`}
                          >
                            {e.type}
                          </button>
                        </td>
                        <td className="py-2 text-right font-semibold tabular-nums text-foreground">
                          {e.count.toLocaleString()}
                        </td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {pct.toFixed(1)}%
                        </td>
                        <td className="py-2 pl-4">
                          <div className="h-2 w-full max-w-[120px] rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-primary transition-all"
                              style={{ width: `${Math.max(2, barW)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
