import { useEffect, useCallback, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { useApp, useApps, groupAppsByCategory } from "../../hooks/useApps";
import { trackAnalyticsEvent } from "../../hooks/useAnalytics";
import { MdxSurface } from "../../components/MdxSurface";
import { StoreAppCard } from "../../components/storefront/StoreAppCard";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Tag,
  Loader2,
  PackageOpen,
} from "lucide-react";

// ── App Detail Page ──────────────────────────────────────────────────────────

/**
 * Tool / App detail page for the store tools route.
 *
 * Renders:
 * - App header (emoji, name, description, category badge, install CTA)
 * - MDX surface with interactive tool embeds
 * - Related apps sidebar (apps in the same category)
 */
export function AppDetailPage() {
  const { appSlug } = useParams({ strict: false });
  const slug = appSlug as string;

  const { data: app, isLoading, isError, error } = useApp(slug);
  const { data: allApps } = useApps();

  // Track page view
  useEffect(() => {
    if (!app || !slug) return;
    trackAnalyticsEvent("app_view", {
      appSlug: slug,
      appName: app.name,
      category: app.category ?? "",
    });
  }, [slug, app]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span role="status" aria-live="polite" className="text-sm text-muted-foreground">
            Loading app...
          </span>
        </div>
      </div>
    );
  }

  if (isError || !app) {
    return (
      <div className="mx-auto max-w-2xl py-16 px-4 text-center space-y-6">
        <PackageOpen className="w-12 h-12 text-muted-foreground mx-auto" />
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">App not found</h2>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "This app could not be loaded."}
          </p>
        </div>
        <Link
          to="/apps"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Apps
        </Link>
      </div>
    );
  }

  // Related apps: same category, excluding this app, max 6
  const relatedApps = allApps
    ? groupAppsByCategory(allApps.filter((a) => a.slug !== slug))
        .find((g) => g.category === app.category)
        ?.apps.slice(0, 6) ?? []
    : [];

  return (
    <div className="flex flex-col lg:flex-row min-h-screen gap-0">
      {/* Main content column */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* App header */}
        <AppHeader app={app} />

        {/* MDX surface with interactive tools */}
        <div className="flex-1">
          <MdxSurface
            appSlug={slug}
            content={app.markdown || undefined}
            className="h-full min-h-[60vh]"
          />
        </div>
      </main>

      {/* Related apps sidebar */}
      {relatedApps.length > 0 && (
        <aside
          aria-label="Related apps"
          className="w-full lg:w-72 xl:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-muted/10"
        >
          <RelatedAppsSidebar
            apps={relatedApps}
            category={app.category}
            currentSlug={slug}
          />
        </aside>
      )}
    </div>
  );
}

// ── App Header ────────────────────────────────────────────────────────────────

interface AppHeaderProps {
  app: {
    slug: string;
    name: string;
    description: string;
    emoji: string;
    category: string;
    tagline?: string;
    pricing?: string;
    tags?: string[];
    tool_count?: number;
    is_new?: boolean;
    is_featured?: boolean;
  };
}

function AppHeader({ app }: AppHeaderProps) {
  const [installed, setInstalled] = useState(false);

  const handleInstall = useCallback(() => {
    // Trigger install flow (no-op placeholder — backend install handled elsewhere)
    setInstalled(true);
    trackAnalyticsEvent("app_install_click", { appSlug: app.slug, appName: app.name });
  }, [app.slug, app.name]);

  return (
    <header className="border-b border-border bg-card px-4 py-5 sm:px-6">
      {/* Back nav */}
      <nav className="mb-4" aria-label="Breadcrumb">
        <Link
          to="/apps"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All Apps
        </Link>
      </nav>

      {/* App identity row */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Emoji icon */}
        <div
          aria-hidden="true"
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-muted/40 text-4xl shadow-sm ring-1 ring-border/50"
        >
          {app.emoji || "🔧"}
        </div>

        {/* Text info */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{app.name}</h1>
            {app.is_new && (
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                New
              </span>
            )}
            {app.is_featured && (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                Featured
              </span>
            )}
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {app.tagline || app.description}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {app.category && (
              <span className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                {app.category}
              </span>
            )}
            {app.tool_count != null && app.tool_count > 0 && (
              <span>{app.tool_count} tool{app.tool_count === 1 ? "" : "s"}</span>
            )}
            {app.pricing && app.pricing !== "free" && (
              <span className="capitalize">{app.pricing}</span>
            )}
          </div>

          {/* Tags */}
          {app.tags && app.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {app.tags.slice(0, 6).map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <button
            type="button"
            onClick={handleInstall}
            disabled={installed}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all focus:outline-none focus:ring-4 focus:ring-primary/20 ${
              installed
                ? "bg-green-500/15 text-green-700 dark:text-green-400 cursor-default"
                : "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md"
            }`}
            aria-label={installed ? `${app.name} installed` : `Install ${app.name}`}
          >
            <Download className="w-4 h-4" />
            {installed ? "Installed" : "Install"}
          </button>

          <a
            href={`https://mcp.spike.land/apps/${app.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Open ${app.name} on spike.land`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            spike.land
          </a>
        </div>
      </div>
    </header>
  );
}

// ── Related Apps Sidebar ──────────────────────────────────────────────────────

interface RelatedAppsSidebarProps {
  apps: Array<{
    slug: string;
    name: string;
    description: string;
    emoji: string;
    category: string;
    tags: string[];
    tagline: string;
    pricing: string;
    is_featured: boolean;
    is_new: boolean;
    tool_count: number;
    sort_order: number;
  }>;
  category: string;
  currentSlug: string;
}

function RelatedAppsSidebar({ apps, category }: RelatedAppsSidebarProps) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">More in {category}</h2>
        <Link
          to="/apps"
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          See all
        </Link>
      </div>

      <div className="space-y-2">
        {apps.map((relatedApp) => (
          <StoreAppCard
            key={relatedApp.slug}
            app={relatedApp}
            layout="list"
          />
        ))}
      </div>
    </div>
  );
}
