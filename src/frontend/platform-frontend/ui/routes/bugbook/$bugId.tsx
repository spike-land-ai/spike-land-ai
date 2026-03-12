import { useParams, Link } from "@tanstack/react-router";
import { useBugbookDetail, useConfirmBug } from "../../hooks/useBugbook";

const severityColor: Record<string, string> = {
  low: "bg-muted text-foreground",
  medium: "bg-warning text-warning-foreground",
  high: "bg-warning text-warning-foreground",
  critical: "bg-destructive text-destructive-foreground",
};

const statusColor: Record<string, string> = {
  CANDIDATE: "bg-info text-info-foreground",
  ACTIVE: "bg-destructive text-destructive-foreground",
  FIXED: "bg-success text-success-foreground",
  DEPRECATED: "bg-muted text-muted-foreground",
};

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading bug details">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-16 rounded bg-muted animate-pulse" />
        <div className="h-4 w-2 rounded bg-muted animate-pulse" />
        <div className="h-4 w-40 rounded bg-muted animate-pulse" />
      </div>

      {/* Header card skeleton */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-pulse">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-6 w-3/4 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-2/3 rounded bg-muted" />
          </div>
          <div className="shrink-0 text-right space-y-1">
            <div className="h-9 w-16 rounded bg-muted" />
            <div className="h-3 w-14 rounded bg-muted" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <div className="h-5 w-20 rounded-full bg-muted" />
          <div className="h-5 w-16 rounded-full bg-muted" />
          <div className="h-5 w-24 rounded-full bg-muted" />
        </div>
      </div>

      {/* Reports skeleton */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-pulse space-y-3">
        <div className="h-4 w-24 rounded bg-muted" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4 space-y-2">
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BugbookDetailPage() {
  const { bugId } = useParams({ strict: false });
  const { data, isLoading, isError } = useBugbookDetail(bugId ?? "");
  const confirmBug = useConfirmBug();

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (isError || !data?.bug) {
    return (
      <div className="space-y-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
          <Link to="/bugbook" className="text-primary hover:underline">
            Bugbook
          </Link>
        </nav>
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive">
          Bug not found.
        </div>
      </div>
    );
  }

  const { bug, reports, eloHistory } = data;

  return (
    <div className="space-y-6">
      {/* Breadcrumb with cross-links */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
        <Link to="/bugbook" className="text-primary hover:underline">
          Bugbook
        </Link>
        <span className="text-muted-foreground" aria-hidden="true">
          /
        </span>
        <span className="text-muted-foreground truncate max-w-xs">{bug.title}</span>
        <span className="text-muted-foreground" aria-hidden="true">
          |
        </span>
        <Link to="/bugbook/leaderboard" className="text-primary hover:underline text-xs">
          Leaderboard
        </Link>
        <span className="text-muted-foreground" aria-hidden="true">
          ·
        </span>
        <Link to="/bugbook/my-reports" className="text-primary hover:underline text-xs">
          My Reports
        </Link>
      </nav>

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{bug.title}</h1>
            {bug.description && (
              <p className="mt-2 text-sm text-muted-foreground">{bug.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold text-primary">{bug.elo}</div>
            <div className="text-xs text-muted-foreground">ELO Rating</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[bug.status] ?? ""}`}
          >
            {bug.status}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${severityColor[bug.severity] ?? ""}`}
          >
            {bug.severity}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {bug.category}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {bug.report_count} report{bug.report_count !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>First seen: {new Date(bug.first_seen_at).toLocaleDateString()}</span>
          <span>Last seen: {new Date(bug.last_seen_at).toLocaleDateString()}</span>
          {bug.fixed_at && <span>Fixed: {new Date(bug.fixed_at).toLocaleDateString()}</span>}
        </div>

        {bug.status !== "FIXED" && bug.status !== "DEPRECATED" && (
          <button
            onClick={() => confirmBug.mutate(bugId ?? "")}
            disabled={confirmBug.isPending}
            className="mt-4 rounded-lg bg-warning text-warning-foreground px-4 py-2 text-sm font-medium hover:bg-warning/90 disabled:opacity-50 transition-colors"
          >
            {confirmBug.isPending ? "Confirming..." : "I have this bug too"}
          </button>
        )}

        {confirmBug.isError && (
          <p className="mt-2 text-sm text-destructive">{confirmBug.error.message}</p>
        )}
      </div>

      {/* ELO History */}
      {eloHistory.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            ELO History
          </h2>
          <div className="space-y-2">
            {eloHistory.map((entry, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"
              >
                <span className="text-foreground">{entry.reason.replace(/_/g, " ")}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {entry.old_elo} &rarr; {entry.new_elo}
                  </span>
                  <span
                    className={`font-medium ${entry.change_amount >= 0 ? "text-success-foreground" : "text-destructive"}`}
                  >
                    {entry.change_amount >= 0 ? "+" : ""}
                    {entry.change_amount}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reports */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Reports ({reports.length})
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports yet.</p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-foreground">{report.description}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${severityColor[report.severity] ?? ""}`}
                  >
                    {report.severity}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>Service: {report.service_name}</span>
                  <span>{new Date(report.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
