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

export function BugbookLeaderboardPage() {
  const { data, isLoading, isError } = useBugbookLeaderboard();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <Link to="/bugbook" className="text-primary hover:underline"><span aria-hidden="true">&larr;</span> Back to Bugbook</Link>
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive">
          Failed to load leaderboard.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link to="/bugbook" className="text-primary hover:underline">Bugbook</Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">Leaderboard</span>
      </div>

      <h1 className="text-2xl font-bold text-foreground">Leaderboard</h1>

      {/* Top Bugs */}
      <div className="rounded-2xl border border-border bg-card dark:glass-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Top Bugs by ELO
        </h2>
        {!data?.topBugs?.length ? (
          <p className="text-sm text-muted-foreground">No active bugs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Bug</th>
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4">Severity</th>
                  <th className="pb-2 pr-4 text-right">Reports</th>
                  <th className="pb-2 text-right">ELO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.topBugs.map((bug, i) => (
                  <tr key={bug.id} className="last:border-0 hover:bg-muted transition-colors">
                    <td className="py-2 pr-4 font-medium text-muted-foreground">{i + 1}</td>
                    <td className="py-2 pr-4">
                      <Link to="/bugbook/$bugId" params={{ bugId: bug.id }} className="text-primary hover:underline">
                        {bug.title}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{bug.category}</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityColor[bug.severity] ?? "bg-muted text-foreground"}`}>
                        {bug.severity}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">{bug.report_count}</td>
                    <td className="py-2 text-right font-bold text-primary">{bug.elo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Reporters */}
      <div className="rounded-2xl border border-border bg-card dark:glass-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Top Bug Reporters
        </h2>
        {!data?.topReporters?.length ? (
          <p className="text-sm text-muted-foreground">No reporters yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">User</th>
                  <th className="pb-2 pr-4">Tier</th>
                  <th className="pb-2 pr-4 text-right">Events</th>
                  <th className="pb-2 text-right">ELO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.topReporters.map((user, i) => (
                  <tr key={user.user_id} className="last:border-0 hover:bg-muted transition-colors">
                    <td className="py-2 pr-4 font-medium text-muted-foreground">{i + 1}</td>
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {user.user_id.slice(0, 8)}...
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tierColor[user.tier] ?? ""}`}>
                        {user.tier}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">{user.event_count}</td>
                    <td className="py-2 text-right font-bold text-primary">{user.elo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
