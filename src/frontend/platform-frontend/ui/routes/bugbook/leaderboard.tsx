import { Link } from "@tanstack/react-router";
import { useBugbookLeaderboard } from "../../hooks/useBugbook";

const tierColor: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-info text-info-foreground",
  business: "bg-warning text-warning-foreground",
};

const severityColor: Record<string, string> = {
  low: "bg-muted text-foreground",
  medium: "bg-warning text-warning-foreground",
  high: "bg-warning text-warning-foreground",
  critical: "bg-destructive text-destructive-foreground",
};

function LeaderboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading leaderboard">
      <div className="flex items-center gap-2">
        <div className="h-4 w-16 rounded bg-muted animate-pulse" />
        <div className="h-4 w-2 rounded bg-muted animate-pulse" />
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
      </div>
      <div className="h-8 w-48 rounded bg-muted animate-pulse" />
      {[0, 1].map((section) => (
        <div
          key={section}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-pulse space-y-4"
        >
          <div className="h-4 w-32 rounded bg-muted" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 py-2 border-b border-border last:border-0"
            >
              <div className="h-4 w-4 rounded bg-muted" />
              <div className="h-4 flex-1 rounded bg-muted" />
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="h-4 w-12 rounded bg-muted" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function BugbookLeaderboardPage() {
  const { data, isLoading, isError } = useBugbookLeaderboard();

  if (isLoading) {
    return <LeaderboardSkeleton />;
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
          <Link to="/bugbook" className="text-primary hover:underline">
            Bugbook
          </Link>
        </nav>
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive">
          Failed to load leaderboard.
        </div>
      </div>
    );
  }

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
        <span className="text-muted-foreground">Leaderboard</span>
        <span className="text-muted-foreground" aria-hidden="true">
          |
        </span>
        <Link to="/bugbook/my-reports" className="text-primary hover:underline text-xs">
          My Reports
        </Link>
      </nav>

      <h1 className="text-2xl font-bold text-foreground">Leaderboard</h1>

      {/* Top Bugs */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Top Bugs by ELO
        </h2>
        {!data?.topBugs?.length ? (
          <p className="text-sm text-muted-foreground">No active bugs yet.</p>
        ) : (
          <>
            {/* Desktop table — hidden below sm */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">#</th>
                    <th className="pb-2 pr-4 font-medium">Bug</th>
                    <th className="pb-2 pr-4 font-medium">Category</th>
                    <th className="pb-2 pr-4 font-medium">Severity</th>
                    <th className="pb-2 pr-4 text-right font-medium">Reports</th>
                    <th className="pb-2 text-right font-medium">ELO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.topBugs.map((bug, i) => (
                    <tr key={bug.id} className="last:border-0 hover:bg-muted transition-colors">
                      <td className="py-2 pr-4 font-medium text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-4">
                        <Link
                          to="/bugbook/$bugId"
                          params={{ bugId: bug.id }}
                          className="text-primary hover:underline"
                        >
                          {bug.title}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{bug.category}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityColor[bug.severity] ?? "bg-muted text-foreground"}`}
                        >
                          {bug.severity}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">
                        {bug.report_count}
                      </td>
                      <td className="py-2 text-right font-bold text-primary">{bug.elo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card layout — shown below sm */}
            <div className="sm:hidden space-y-3">
              {data.topBugs.map((bug, i) => (
                <div
                  key={bug.id}
                  className="rounded-xl border border-border bg-muted/40 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                    <span className="font-bold text-primary text-sm">{bug.elo} ELO</span>
                  </div>
                  <Link
                    to="/bugbook/$bugId"
                    params={{ bugId: bug.id }}
                    className="block font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {bug.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{bug.category}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${severityColor[bug.severity] ?? "bg-muted text-foreground"}`}
                    >
                      {bug.severity}
                    </span>
                    <span className="text-muted-foreground">{bug.report_count} reports</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Top Reporters */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Top Bug Reporters
        </h2>
        {!data?.topReporters?.length ? (
          <p className="text-sm text-muted-foreground">No reporters yet.</p>
        ) : (
          <>
            {/* Desktop table — hidden below sm */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">#</th>
                    <th className="pb-2 pr-4 font-medium">User</th>
                    <th className="pb-2 pr-4 font-medium">Tier</th>
                    <th className="pb-2 pr-4 text-right font-medium">Events</th>
                    <th className="pb-2 text-right font-medium">ELO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.topReporters.map((user, i) => (
                    <tr
                      key={user.user_id}
                      className="last:border-0 hover:bg-muted transition-colors"
                    >
                      <td className="py-2 pr-4 font-medium text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-4 font-medium text-foreground">
                        {user.user_id.slice(0, 8)}...
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tierColor[user.tier] ?? ""}`}
                        >
                          {user.tier}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">
                        {user.event_count}
                      </td>
                      <td className="py-2 text-right font-bold text-primary">{user.elo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card layout — shown below sm */}
            <div className="sm:hidden space-y-3">
              {data.topReporters.map((user, i) => (
                <div
                  key={user.user_id}
                  className="rounded-xl border border-border bg-muted/40 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                    <span className="font-bold text-primary text-sm">{user.elo} ELO</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground text-sm">
                      {user.user_id.slice(0, 8)}...
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tierColor[user.tier] ?? ""}`}
                    >
                      {user.tier}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{user.event_count} events</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
