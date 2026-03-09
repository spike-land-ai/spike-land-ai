import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Clock3 } from "lucide-react";
import { groupAppsByCategory, useApps, type McpAppSummary } from "../hooks/useApps";
import { cn } from "../../styling/cn";

function AppCard({ app, featured = false }: { app: McpAppSummary; featured?: boolean }) {
  const pricingLabel = app.pricing === "premium" ? "premium" : "free";

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card dark:glass-card p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.01] hover:border-primary/30 hover:shadow-primary/10",
        featured && "ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
            {app.emoji || "🔧"}
          </div>
          <h3 className="font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
            {app.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {app.is_new && (
            <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-medium text-success-foreground border border-success/30">
              new
            </span>
          )}
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
            {pricingLabel}
          </span>
        </div>
      </div>
      {app.tagline && (
        <p className="mt-3 text-sm font-medium text-foreground/80">{app.tagline}</p>
      )}
      {app.description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
          {app.description}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
          {app.category}
        </span>
        <span>{app.tool_count} {app.tool_count === 1 ? "tool" : "tools"}</span>
        {app.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="rounded-full border border-border px-2 py-0.5">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export function StorePage() {
  const { data: apps, isLoading, isError, error } = useApps();
  const search = "";

  const filteredData = useMemo(() => {
    if (!apps) {
      return { featured: [], newest: [], categories: [], total: 0 };
    }
    const q = search.trim().toLowerCase();
    const filteredApps = q
      ? apps.filter((app) =>
          [app.name, app.description, app.tagline, app.category, ...app.tags]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(q)),
        )
      : apps;

    const grouped = groupAppsByCategory(filteredApps);
    const featured = filteredApps.filter((app) => app.is_featured);
    const newest = filteredApps.filter((app) => app.is_new).slice(0, 6);

    return {
      featured: featured.length > 0 ? featured : filteredApps.slice(0, 6),
      newest,
      categories: grouped,
      total: filteredApps.length,
    };
  }, [apps, search]);

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground">App Store</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl border border-border bg-muted dark:glass-card animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground">App Store</h1>
        <div className="rounded-2xl border border-border bg-card dark:glass-card shadow-sm p-8 text-center space-y-4">
          <p className="text-muted-foreground">
            We couldn't load the app catalog right now. This might be a temporary issue.
          </p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="rounded-2xl border border-border bg-card dark:glass-card shadow-sm p-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">App Store</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discover, install, rate, and review AI applications.
          </p>
        </div>
        <span className="text-sm font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
          {filteredData.total} apps
        </span>
      </div>

      {filteredData.featured.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Featured Apps</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredData.featured.map((app) => (
              <Link
                key={app.slug}
                to="/apps/$appSlug"
                params={{ appSlug: app.slug }}
                className="group block"
              >
                <AppCard app={app} featured />
              </Link>
            ))}
          </div>
        </section>
      )}

      {filteredData.newest.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">New This Week</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredData.newest.map((app) => (
              <Link
                key={app.slug}
                to="/apps/$appSlug"
                params={{ appSlug: app.slug }}
                className="group block"
              >
                <AppCard app={app} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {filteredData.categories.map((group) => (
        <section key={group.category} className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{group.category}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.apps.map((app) => (
              <Link key={app.slug} to="/apps/$appSlug" params={{ appSlug: app.slug }} className="group block">
                <AppCard app={app} />
              </Link>
            ))}
          </div>
        </section>
      ))}

      {filteredData.featured.length === 0 && filteredData.categories.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card dark:glass-card p-12 text-center text-muted-foreground">
          No apps found in the public catalog.
        </div>
      )}
    </div>
  );
}
