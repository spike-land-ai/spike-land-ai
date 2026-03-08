import { Link } from "@tanstack/react-router";
import { useApps } from "../../hooks/useApps";
import { Sparkles } from "lucide-react";
import { useState } from "react";

export function ToolsIndexPage() {
  const { data: apps, isLoading, isError, error } = useApps();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div role="status" aria-live="polite" className="text-muted-foreground animate-pulse">
          Loading apps...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">MCP Apps</h1>
        </div>
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
          <p className="text-muted-foreground">Unable to load apps. Please try again later.</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">MCP Apps</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Interactive stateful workflows powered by MCP tools.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
          <Sparkles className="w-3.5 h-3.5" />
          {apps?.length || 0} Apps
        </span>
      </div>

      {!apps || apps.length === 0 ? (
        <div className="rounded-xl border border-border border-dashed p-12 text-center text-muted-foreground">
          No apps available at the moment.
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            {apps.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((app) => (
              <Link
                key={app.slug}
                to="/tools/$appSlug"
                params={{
                  appSlug: app.slug,
                }}
                className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] hover:border-primary/40"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted/50 text-2xl group-hover:scale-110 transition-transform">
                    {app.emoji || "🔧"}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                      {app.name}
                    </h3>
                    <p className="text-xs font-medium text-muted-foreground">
                      {app.tool_count} {app.tool_count === 1 ? "tool" : "tools"}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                  {app.description}
                </p>

                <div className="mt-6 flex items-center justify-end text-sm font-semibold text-primary/80 group-hover:text-primary">
                  Launch App{" "}
                  <span
                    aria-hidden="true"
                    className="ml-1 group-hover:translate-x-1 transition-transform"
                  >
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {apps.length > itemsPerPage && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm font-medium text-foreground px-4">
                Page {currentPage} of {Math.ceil(apps.length / itemsPerPage)}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(Math.ceil(apps.length / itemsPerPage), p + 1))
                }
                disabled={currentPage === Math.ceil(apps.length / itemsPerPage)}
                className="px-3 py-1 text-sm font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
