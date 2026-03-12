import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useBugbookList } from "../../hooks/useBugbook";
import type { Bug } from "../../hooks/useBugbook";

const STATUSES = ["All", "CANDIDATE", "ACTIVE", "FIXED", "DEPRECATED"] as const;
const SORTS = [
  { value: "elo" as const, label: "ELO Rating" },
  { value: "recent" as const, label: "Most Recent" },
];

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

function BugCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-5 w-10 shrink-0 rounded-full bg-muted" />
      </div>
      <div className="mt-3 flex gap-1.5">
        <div className="h-4 w-16 rounded-full bg-muted" />
        <div className="h-4 w-14 rounded-full bg-muted" />
        <div className="h-4 w-20 rounded-full bg-muted" />
      </div>
      <div className="mt-3 flex gap-4">
        <div className="h-3 w-16 rounded bg-muted" />
        <div className="h-3 w-24 rounded bg-muted" />
      </div>
    </div>
  );
}

function BugCard({ bug }: { bug: Bug }) {
  return (
    <Link
      to="/bugbook/$bugId"
      params={{ bugId: bug.id }}
      className="group block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight text-foreground group-hover:text-primary">
          {bug.title}
        </h3>
        <span className="shrink-0 rounded-full bg-info text-info-foreground px-2.5 py-0.5 text-xs font-bold">
          {bug.elo}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[bug.status] ?? ""}`}
        >
          {bug.status}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityColor[bug.severity] ?? ""}`}
        >
          {bug.severity}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {bug.category}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          {bug.report_count} report{bug.report_count !== 1 ? "s" : ""}
        </span>
        <span>Last seen {new Date(bug.last_seen_at).toLocaleDateString()}</span>
      </div>
    </Link>
  );
}

export function BugbookIndexPage() {
  const [status, setStatus] = useState<string>("All");
  const [sort, setSort] = useState<"elo" | "recent">("elo");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useBugbookList({
    ...(status !== "All" && { status }),
    sort,
    limit: 100,
  });

  const filtered =
    data?.bugs?.filter(
      (bug) =>
        bug.title.toLowerCase().includes(search.toLowerCase()) ||
        bug.category.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];

  return (
    <div className="space-y-6">
      {/* Page header with cross-links */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bugbook</h1>
          <p className="text-sm text-muted-foreground">Public bug tracker with ELO ranking</p>
        </div>
        <nav aria-label="Bugbook navigation" className="flex flex-wrap gap-2">
          <Link
            to="/bugbook/my-reports"
            className="rounded-lg bg-secondary text-secondary-foreground px-3 py-1.5 text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            My Reports
          </Link>
          <Link
            to="/bugbook/leaderboard"
            className="rounded-lg bg-secondary text-secondary-foreground px-3 py-1.5 text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            Leaderboard
          </Link>
          <span className="rounded-lg bg-success text-success-foreground px-3 py-1.5 text-xs font-medium flex items-center">
            {data?.total ?? 0} bugs
          </span>
        </nav>
      </div>

      <input
        type="text"
        placeholder="Search bugs..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-muted/80"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-1.5" role="group" aria-label="Sort order">
          {SORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSort(s.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                sort === s.value
                  ? "bg-foreground text-background"
                  : "bg-muted text-foreground hover:bg-muted/80"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Loading bugs"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <BugCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive">
          Failed to load bugs. Try refreshing.
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No bugs found matching your filters.
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((bug) => (
            <BugCard key={bug.id} bug={bug} />
          ))}
        </div>
      )}
    </div>
  );
}
