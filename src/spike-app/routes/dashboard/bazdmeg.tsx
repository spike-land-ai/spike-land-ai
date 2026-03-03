import { useCallback, useMemo, useState } from "react";

type TimeRange = "24h" | "7d" | "30d";

interface PlatformEvent {
  id: string;
  event_type: string;
  source: string;
  metadata: string;
  created_at: number;
}

type EventMeta = Record<string, unknown>;

function timeRangeToMs(range: TimeRange): number {
  switch (range) {
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
  }
}

function parseMeta(metadata: string): EventMeta {
  try {
    return JSON.parse(metadata) as EventMeta;
  } catch {
    return {};
  }
}

function MetricCard({
  label,
  value,
  subtitle,
  color,
}: {
  label: string;
  value: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color ?? "text-gray-900"}`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
}

function TimeRangeSelector({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}) {
  const ranges: TimeRange[] = ["24h", "7d", "30d"];
  return (
    <div className="flex gap-1 rounded-lg border bg-gray-50 p-1">
      {ranges.map((range) => (
        <button
          key={range}
          onClick={() => onChange(range)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
            value === range
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {range}
        </button>
      ))}
    </div>
  );
}

function GateStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    GREEN: "bg-green-100 text-green-800",
    YELLOW: "bg-yellow-100 text-yellow-800",
    RED: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        colors[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}

function EventTypeBadge({ eventType }: { eventType: string }) {
  const colors: Record<string, string> = {
    workspace_enter: "bg-blue-100 text-blue-700",
    workspace_exit: "bg-blue-50 text-blue-500",
    tool_call: "bg-gray-100 text-gray-600",
    gate_check: "bg-purple-100 text-purple-700",
    context_served: "bg-green-100 text-green-700",
    context_gap: "bg-orange-100 text-orange-700",
    agent_stuck: "bg-red-100 text-red-700",
    stuck_resolved: "bg-emerald-100 text-emerald-700",
    jail_block: "bg-red-50 text-red-600",
  };
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
        colors[eventType] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {eventType}
    </span>
  );
}

interface ReconstructedState {
  activeWorkspaces: Map<string, { enteredAt: number; allowedPaths: string[] }>;
  latestGates: Map<string, { status: string; detail: string }>;
  unresolvedStuck: Array<{
    reason: string;
    attemptedAction: string;
    workspace: string;
    time: number;
  }>;
}

function reconstructState(events: PlatformEvent[], upTo: number): ReconstructedState {
  const sorted = events
    .filter((e) => e.created_at <= upTo)
    .sort((a, b) => a.created_at - b.created_at);

  const activeWorkspaces = new Map<string, { enteredAt: number; allowedPaths: string[] }>();
  const latestGates = new Map<string, { status: string; detail: string }>();
  const unresolvedStuck: ReconstructedState["unresolvedStuck"] = [];

  for (const e of sorted) {
    const meta = parseMeta(e.metadata);
    const workspace = typeof meta.workspace === "string" ? meta.workspace : "unknown";

    switch (e.event_type) {
      case "workspace_enter":
        activeWorkspaces.set(workspace, {
          enteredAt: e.created_at,
          allowedPaths: Array.isArray(meta.allowedPaths) ? (meta.allowedPaths as string[]) : [],
        });
        break;
      case "workspace_exit":
        activeWorkspaces.delete(workspace);
        break;
      case "gate_check":
        latestGates.set(String(meta.gateName ?? "unknown"), {
          status: String(meta.status ?? "unknown"),
          detail: String(meta.detail ?? ""),
        });
        break;
      case "agent_stuck":
        unresolvedStuck.push({
          reason: String(meta.reason ?? ""),
          attemptedAction: String(meta.attemptedAction ?? ""),
          workspace,
          time: e.created_at,
        });
        break;
      case "stuck_resolved":
        // Remove the most recent stuck signal for this workspace
        for (let i = unresolvedStuck.length - 1; i >= 0; i--) {
          const entry = unresolvedStuck[i];
          if (entry && entry.workspace === workspace) {
            unresolvedStuck.splice(i, 1);
            break;
          }
        }
        break;
    }
  }

  return { activeWorkspaces, latestGates, unresolvedStuck };
}

const EVENT_DOT_COLORS: Record<string, string> = {
  workspace_enter: "bg-blue-500",
  workspace_exit: "bg-blue-300",
  gate_check: "bg-purple-500",
  agent_stuck: "bg-red-500",
  stuck_resolved: "bg-emerald-500",
  context_served: "bg-green-500",
  context_gap: "bg-orange-500",
  tool_call: "bg-gray-400",
};

function ReplaySlider({
  events,
  replayTimestamp,
  onTimestampChange,
  onGoLive,
}: {
  events: PlatformEvent[];
  replayTimestamp: number | null;
  onTimestampChange: (ts: number) => void;
  onGoLive: () => void;
}) {
  const sortedByTime = useMemo(
    () => [...events].sort((a, b) => a.created_at - b.created_at),
    [events],
  );

  const earliest = sortedByTime[0]?.created_at ?? Date.now();
  const latest = sortedByTime[sortedByTime.length - 1]?.created_at ?? Date.now();
  const range = latest - earliest || 1;
  const current = replayTimestamp ?? latest;

  const eventMarkers = useMemo(() => {
    if (range <= 0) return [];
    return sortedByTime.map((e) => ({
      position: ((e.created_at - earliest) / range) * 100,
      color: EVENT_DOT_COLORS[e.event_type] ?? "bg-gray-300",
      type: e.event_type,
    }));
  }, [sortedByTime, earliest, range]);

  if (events.length === 0) return null;

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Workspace Replay
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{new Date(current).toLocaleString()}</span>
          <button
            onClick={onGoLive}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              replayTimestamp === null
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700"
            }`}
          >
            {replayTimestamp === null ? "LIVE" : "Go Live"}
          </button>
        </div>
      </div>

      {/* Slider with event markers */}
      <div className="relative px-1">
        {/* Event marker dots on the track */}
        <div className="pointer-events-none absolute inset-x-1 top-1/2 h-1 -translate-y-1/2">
          {eventMarkers.map((marker, i) => (
            <div
              key={i}
              className={`absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${marker.color} opacity-60`}
              style={{ left: `${marker.position}%` }}
              title={marker.type}
            />
          ))}
        </div>
        <input
          type="range"
          min={earliest}
          max={latest}
          value={current}
          onChange={(e) => onTimestampChange(Number(e.target.value))}
          className="relative z-10 w-full cursor-pointer accent-blue-600"
        />
      </div>

      {/* Reconstructed state when in replay mode */}
      {replayTimestamp !== null && (
        <ReconstructedStateDisplay events={sortedByTime} upTo={replayTimestamp} />
      )}
    </div>
  );
}

function ReconstructedStateDisplay({ events, upTo }: { events: PlatformEvent[]; upTo: number }) {
  const state = useMemo(() => reconstructState(events, upTo), [events, upTo]);

  const workspaceEntries = Array.from(state.activeWorkspaces.entries());

  return (
    <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3">
      {/* Active workspaces at this point */}
      <div>
        <p className="mb-1 text-xs font-medium text-gray-500">Active Workspaces</p>
        {workspaceEntries.length === 0 ? (
          <p className="text-xs text-gray-400">None</p>
        ) : (
          <div className="space-y-1">
            {workspaceEntries.map(([name, info]) => (
              <div key={name} className="rounded bg-blue-50 px-2 py-1">
                <span className="text-xs font-medium text-blue-700">{name}</span>
                <span className="ml-2 text-xs text-blue-400">
                  since {new Date(info.enteredAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gate status at this point */}
      <div>
        <p className="mb-1 text-xs font-medium text-gray-500">Gate Status</p>
        {state.latestGates.size === 0 ? (
          <p className="text-xs text-gray-400">No checks</p>
        ) : (
          <div className="space-y-1">
            {Array.from(state.latestGates.entries()).map(([name, gate]) => (
              <div key={name} className="flex items-center gap-1">
                <GateStatusBadge status={gate.status} />
                <span className="text-xs text-gray-600">{name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unresolved stuck signals */}
      <div>
        <p className="mb-1 text-xs font-medium text-gray-500">Unresolved Stuck</p>
        {state.unresolvedStuck.length === 0 ? (
          <p className="text-xs text-gray-400">None</p>
        ) : (
          <div className="space-y-1">
            {state.unresolvedStuck.map((s, i) => (
              <div key={i} className="rounded bg-red-50 px-2 py-1">
                <span className="text-xs font-medium text-red-700">{s.workspace}</span>
                <p className="text-xs text-red-500">{s.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function BazdmegDashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [replayTimestamp, setReplayTimestamp] = useState<number | null>(null);
  const cutoff = Date.now() - timeRangeToMs(timeRange);

  // TODO: wire up to edge API
  const allEvents: PlatformEvent[] = [];

  const handleReplayChange = useCallback((ts: number) => setReplayTimestamp(ts), []);
  const handleGoLive = useCallback(() => setReplayTimestamp(null), []);

  // Filter to bazdmeg-mcp events within time range (and replay ceiling)
  const events = useMemo(
    () =>
      allEvents
        .filter(
          (e) =>
            e.source === "bazdmeg-mcp" &&
            e.created_at >= cutoff &&
            (replayTimestamp === null || e.created_at <= replayTimestamp),
        )
        .sort((a, b) => b.created_at - a.created_at),
    [allEvents, cutoff, replayTimestamp],
  );

  // Unfiltered events for the replay slider (needs full time-range to show all markers)
  const allTimeRangeEvents = useMemo(
    () =>
      allEvents
        .filter((e) => e.source === "bazdmeg-mcp" && e.created_at >= cutoff)
        .sort((a, b) => b.created_at - a.created_at),
    [allEvents, cutoff],
  );

  // Metric computations
  const toolCalls = useMemo(() => events.filter((e) => e.event_type === "tool_call"), [events]);

  const activeWorkspaces = useMemo(() => {
    const workspaces = new Set<string>();
    for (const e of events) {
      if (e.event_type === "workspace_enter") {
        const meta = parseMeta(e.metadata);
        if (typeof meta.workspace === "string") workspaces.add(meta.workspace);
      }
    }
    return workspaces;
  }, [events]);

  const gateEvents = useMemo(() => events.filter((e) => e.event_type === "gate_check"), [events]);

  const gatePassRate = useMemo(() => {
    if (gateEvents.length === 0) return null;
    const passed = gateEvents.filter((e) => {
      const meta = parseMeta(e.metadata);
      return meta.status === "GREEN";
    }).length;
    return Math.round((passed / gateEvents.length) * 100);
  }, [gateEvents]);

  const stuckSignals = useMemo(
    () => events.filter((e) => e.event_type === "agent_stuck"),
    [events],
  );

  // Event type list for filter
  const eventTypes = useMemo(() => {
    const types = new Set(events.map((e) => e.event_type));
    return ["all", ...Array.from(types).sort()];
  }, [events]);

  const filteredEvents = useMemo(
    () =>
      eventTypeFilter === "all" ? events : events.filter((e) => e.event_type === eventTypeFilter),
    [events, eventTypeFilter],
  );

  // Latest gate results per gate name
  const latestGateResults = useMemo(() => {
    const results = new Map<string, { status: string; detail: string; time: number }>();
    for (const e of gateEvents) {
      const meta = parseMeta(e.metadata);
      const name = String(meta.gateName ?? "unknown");
      const existing = results.get(name);
      if (!existing || e.created_at > existing.time) {
        results.set(name, {
          status: String(meta.status ?? "unknown"),
          detail: String(meta.detail ?? ""),
          time: e.created_at,
        });
      }
    }
    return Array.from(results.entries()).map(([name, data]) => ({
      name,
      ...data,
    }));
  }, [gateEvents]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">BAZDMEG Dashboard</h1>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Replay Slider */}
      <ReplaySlider
        events={allTimeRangeEvents}
        replayTimestamp={replayTimestamp}
        onTimestampChange={handleReplayChange}
        onGoLive={handleGoLive}
      />

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Active Workspaces"
          value={String(activeWorkspaces.size)}
          subtitle={activeWorkspaces.size > 0 ? Array.from(activeWorkspaces).join(", ") : undefined}
        />
        <MetricCard label="Tool Calls" value={String(toolCalls.length)} subtitle={timeRange} />
        <MetricCard
          label="Gate Pass Rate"
          value={gatePassRate !== null ? `${gatePassRate}%` : "N/A"}
          subtitle={`${gateEvents.length} checks`}
          color={
            gatePassRate === null
              ? undefined
              : gatePassRate >= 80
                ? "text-green-600"
                : gatePassRate >= 50
                  ? "text-yellow-600"
                  : "text-red-600"
          }
        />
        <MetricCard
          label="Stuck Signals"
          value={String(stuckSignals.length)}
          subtitle={stuckSignals.length > 0 ? "needs attention" : "all clear"}
          color={stuckSignals.length > 0 ? "text-red-600" : "text-green-600"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gate Results */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Latest Gate Results
          </h3>
          {latestGateResults.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed text-gray-400">
              No gate checks yet
            </div>
          ) : (
            <div className="space-y-2">
              {latestGateResults.map((gate) => (
                <div
                  key={gate.name}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                >
                  <span className="text-sm font-medium text-gray-700">{gate.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="max-w-48 truncate text-xs text-gray-500">{gate.detail}</span>
                    <GateStatusBadge status={gate.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stuck Signals */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Stuck Signals
          </h3>
          {stuckSignals.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed text-gray-400">
              No stuck signals
            </div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {stuckSignals.map((signal) => {
                const meta = parseMeta(signal.metadata);
                return (
                  <div key={signal.id} className="rounded-lg border border-red-100 bg-red-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-red-800">
                        {String(meta.workspace ?? "unknown")}
                      </span>
                      <span className="text-xs text-red-400">
                        {new Date(signal.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-red-700">{String(meta.reason ?? "")}</p>
                    {typeof meta.attemptedAction === "string" && (
                      <p className="mt-1 text-xs text-red-500">Attempted: {meta.attemptedAction}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Event Log */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Event Log</h3>
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="rounded-md border bg-gray-50 px-2 py-1 text-sm text-gray-700"
          >
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type === "all" ? "All Events" : type}
              </option>
            ))}
          </select>
        </div>
        {filteredEvents.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed text-gray-400">
            No events found
          </div>
        ) : (
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {filteredEvents.slice(0, 50).map((event) => {
              const meta = parseMeta(event.metadata);
              const isExpanded = expandedEvent === event.id;
              return (
                <div key={event.id}>
                  <button
                    onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <EventTypeBadge eventType={event.event_type} />
                      {typeof meta.workspace === "string" && (
                        <span className="text-xs text-gray-500">{meta.workspace}</span>
                      )}
                      {typeof meta.tool === "string" && (
                        <span className="text-xs text-gray-400">{meta.tool}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(event.created_at).toLocaleTimeString()}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="mb-1 ml-2 rounded bg-gray-50 p-2">
                      <pre className="overflow-x-auto text-xs text-gray-600">
                        {JSON.stringify(meta, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
