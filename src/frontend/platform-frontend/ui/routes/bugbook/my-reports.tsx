import { Link } from "@tanstack/react-router";
import { useMyBugReports } from "../../hooks/useBugbook";
import { AuthGuard } from "../../components/AuthGuard";

// Derive types directly from the hook's inferred return shape.
type MyReportsData = NonNullable<ReturnType<typeof useMyBugReports>["data"]>;
type BugReport = MyReportsData["reports"][number];
type BugStatus = BugReport["bug_status"];

const statusColor: Record<string, string> = {
  FIXED: "bg-success text-success-foreground",
  ACTIVE: "bg-info text-info-foreground",
  DEPRECATED: "bg-muted text-muted-foreground",
  CANDIDATE: "bg-warning text-warning-foreground",
};

const severityColor: Record<string, string> = {
  low: "bg-muted text-foreground",
  medium: "bg-warning text-warning-foreground",
  high: "bg-warning text-warning-foreground",
  critical: "bg-destructive text-destructive-foreground",
};

function getStatusColor(status: BugStatus): string {
  return statusColor[status] ?? "bg-muted text-muted-foreground";
}

function ReportCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-5 w-2/3 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-4/5 rounded bg-muted" />
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <div className="h-5 w-20 rounded-full bg-muted" />
          <div className="h-5 w-16 rounded-full bg-muted" />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="h-3 w-3 rounded bg-muted" />
        <div className="h-3 w-24 rounded bg-muted" />
      </div>
    </div>
  );
}

export function MyReportsPage() {
  return (
    <AuthGuard>
      <MyReportsContent />
    </AuthGuard>
  );
}

function MyReportsContent() {
  const { data, isLoading, error } = useMyBugReports();

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading your reports">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-16 rounded bg-muted animate-pulse" />
          <div className="h-4 w-2 rounded bg-muted animate-pulse" />
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        </div>

        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 rounded bg-muted animate-pulse" />
          <div className="h-6 w-32 rounded-full bg-muted animate-pulse" />
        </div>

        {/* Report card skeletons */}
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ReportCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
          <Link to="/bugbook" className="text-primary hover:underline">
            Bugbook
          </Link>
        </nav>
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive">
          Error loading your reports. Make sure you are logged in.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb with cross-links */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
        <Link to="/bugbook" className="text-primary hover:underline">
          Bugbook
        </Link>
        <span className="text-muted-foreground" aria-hidden="true">
          /
        </span>
        <span className="text-muted-foreground">My Reports</span>
        <span className="text-muted-foreground" aria-hidden="true">
          |
        </span>
        <Link to="/bugbook/leaderboard" className="text-primary hover:underline text-xs">
          Leaderboard
        </Link>
      </nav>

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">My Bug Reports</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">My ELO:</span>
          <span className="rounded-full border border-border bg-warning text-warning-foreground px-3 py-0.5 text-sm font-semibold">
            {data.userElo.elo}
          </span>
          <span className="rounded-full border border-border bg-muted text-muted-foreground px-3 py-0.5 text-xs font-medium capitalize">
            {data.userElo.tier}
          </span>
        </div>
      </div>

      {data.reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          You haven&apos;t reported any bugs yet.
        </div>
      ) : (
        <div className="space-y-4">
          {data.reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({ report }: { report: BugReport }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row justify-between gap-4 transition hover:shadow-sm">
      <div className="flex-1 min-w-0">
        <Link
          to="/bugbook/$bugId"
          params={{ bugId: report.bug_id }}
          className="text-base font-semibold text-foreground hover:text-primary transition-colors"
        >
          {report.bug_title}
        </Link>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{report.description}</p>
        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
          <span>{new Date(report.created_at).toLocaleDateString()}</span>
          <span aria-hidden="true">·</span>
          <span>Bug ELO: {report.bug_elo}</span>
        </div>
      </div>

      {/* Status & severity badges — stack horizontally on mobile, column on sm+ */}
      <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(report.bug_status)}`}
        >
          {report.bug_status}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${severityColor[report.severity] ?? "bg-muted text-foreground"}`}
        >
          {report.severity}
        </span>
      </div>
    </div>
  );
}
