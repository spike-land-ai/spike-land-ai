import { Link, useParams } from "@tanstack/react-router";
import { ChevronRight, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { CategoryGrid } from "../../../components/store/CategoryGrid";
import {
  StoreFilters,
  hasActiveFilters,
  useStoreFilters,
  DEFAULT_FILTER_STATE,
} from "../../../components/store/StoreFilters";
import { HeroShelf } from "../../../components/storefront/HeroShelf";
import { groupAppsByCategory, useApps } from "../../../hooks/useApps";
import type { McpAppSummary } from "../../../hooks/useApps";

// ---------------------------------------------------------------------------
// Category metadata (icon + description) derived from categories.ts slugs
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, string> = {
  "Identity & Access": "🔐",
  "Browser Automation": "🤖",
  "Code & Developer Tools": "⚡",
  "Agents & Collaboration": "🤝",
  "Docs & Knowledge": "📚",
  "Analytics & Insights": "📊",
  "Commerce & Billing": "💳",
  "Media & Creative": "🎨",
  "Games & Simulation": "🎮",
  "Infrastructure & Ops": "🏗️",
  "Integrations & APIs": "🔗",
  "General Utility": "🔧",
};

function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? "📦";
}

// ---------------------------------------------------------------------------
// Filter logic
// ---------------------------------------------------------------------------

function applyFilters(
  apps: McpAppSummary[],
  filters: ReturnType<typeof useStoreFilters>["filters"],
): McpAppSummary[] {
  let result = [...apps];

  // Pricing filter
  if (filters.pricing === "free") {
    result = result.filter((app) => app.pricing === "free" || !app.pricing);
  } else if (filters.pricing === "paid") {
    result = result.filter((app) => app.pricing && app.pricing !== "free");
  }

  // Tag filter (app must include ALL selected tags)
  if (filters.tags.length > 0) {
    result = result.filter((app) =>
      filters.tags.every(
        (tag) => app.tags.includes(tag) || app.category.toLowerCase().includes(tag.toLowerCase()),
      ),
    );
  }

  // Sort
  switch (filters.sort) {
    case "newest":
      result = result.sort((a, b) => b.sort_order - a.sort_order);
      break;
    case "top-rated":
      result = result.sort((a, b) => {
        // Prefer featured apps as a proxy for top-rated
        if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      break;
    case "popular":
    default:
      result = result.sort((a, b) => {
        if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
        return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
      });
  }

  return result;
}

function collectAvailableTags(apps: McpAppSummary[]): string[] {
  const tagCounts = new Map<string, number>();

  for (const app of apps) {
    for (const tag of app.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(tagCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, 20);
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CategoryDetailSkeleton() {
  return (
    <div className="rubik-container-wide rubik-page space-y-8">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-16 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
      </div>

      {/* Header skeleton */}
      <div className="rubik-panel-strong flex flex-col gap-4 p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 animate-pulse rounded-2xl bg-muted" />
          <div className="space-y-2">
            <div className="h-8 w-48 animate-pulse rounded-xl bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex gap-6">
        <div className="hidden w-56 shrink-0 lg:block">
          <div className="rubik-panel h-80 animate-pulse" />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items
              <div key={i} className="rubik-panel h-52 animate-pulse rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoryDetailPage
// ---------------------------------------------------------------------------

export function CategoryDetailPage() {
  const { categorySlug } = useParams({ strict: false }) as { categorySlug?: string };
  const { data: apps, isLoading, isError } = useApps();
  const { filters, setFilters } = useStoreFilters();

  const categoryName = useMemo(() => {
    if (!categorySlug) return null;
    return decodeURIComponent(categorySlug).replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }, [categorySlug]);

  const groupedApps = useMemo(() => groupAppsByCategory(apps ?? []), [apps]);

  const categoryGroup = useMemo(() => {
    if (!categoryName) return null;
    // Exact match first, then case-insensitive
    return (
      groupedApps.find((g) => g.category === categoryName) ??
      groupedApps.find(
        (g) => g.category.toLowerCase() === categoryName.toLowerCase(),
      ) ??
      null
    );
  }, [groupedApps, categoryName]);

  const allCategoryApps = categoryGroup?.apps ?? [];

  const availableTags = useMemo(() => collectAvailableTags(allCategoryApps), [allCategoryApps]);

  const filteredApps = useMemo(
    () => applyFilters(allCategoryApps, filters),
    [allCategoryApps, filters],
  );

  const featuredApps = useMemo(
    () => allCategoryApps.filter((app) => app.is_featured).slice(0, 3),
    [allCategoryApps],
  );

  const isFiltered = hasActiveFilters(filters);

  // ----- Loading state -----
  if (isLoading) {
    return <CategoryDetailSkeleton />;
  }

  // ----- Error state -----
  if (isError) {
    return (
      <div className="rubik-container rubik-page rubik-stack">
        <div className="rubik-panel space-y-4 p-8 text-center">
          <p className="font-display text-lg font-semibold text-foreground">Failed to load apps</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ----- Category not found -----
  if (!categoryGroup) {
    return (
      <div className="rubik-container rubik-page rubik-stack">
        <div className="rubik-panel flex flex-col items-center gap-4 border-dashed p-12 text-center">
          <p className="text-lg font-semibold text-foreground">Category not found</p>
          <p className="text-sm text-muted-foreground">
            The category{" "}
            <span className="font-medium text-foreground">&ldquo;{categoryName}&rdquo;</span> does
            not exist or has no apps.
          </p>
          <Link
            to="/apps"
            className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            Browse all apps
          </Link>
        </div>
      </div>
    );
  }

  const icon = getCategoryIcon(categoryGroup.category);

  return (
    <div className="rubik-container-wide rubik-page space-y-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          to="/apps"
          className="transition-colors hover:text-foreground"
        >
          Store
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-foreground" aria-current="page">
          {categoryGroup.category}
        </span>
      </nav>

      {/* Category header */}
      <section
        className="rubik-panel-strong relative overflow-hidden p-6 sm:p-8"
        aria-labelledby="category-heading"
      >
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-card to-background" />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/8 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.5rem] border border-border/40 bg-gradient-to-br from-muted/50 to-muted/20 text-4xl shadow-lg ring-1 ring-border/20">
            {icon}
          </div>

          <div className="flex-1 space-y-2">
            <span className="rubik-eyebrow">
              <Sparkles className="h-3.5 w-3.5" />
              Category
            </span>
            <h1
              id="category-heading"
              className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
            >
              {categoryGroup.category}
            </h1>
            <p className="text-sm leading-7 text-muted-foreground">
              {allCategoryApps.length} app{allCategoryApps.length !== 1 ? "s" : ""} in this category
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {featuredApps.length > 0 && (
              <span className="rubik-chip rubik-chip-accent text-xs">
                {featuredApps.length} Featured
              </span>
            )}
            <span className="rubik-chip text-xs">{allCategoryApps.length} Apps</span>
          </div>
        </div>
      </section>

      {/* Featured shelf — only shown when not actively filtering */}
      {!isFiltered && featuredApps.length > 0 && (
        <section aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="sr-only">
            Featured Apps
          </h2>
          <HeroShelf featuredApps={featuredApps} />
        </section>
      )}

      {/* Main content: filters + grid */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Filter sidebar */}
        <div className="lg:w-56 lg:shrink-0">
          <div className="lg:sticky lg:top-6">
            <StoreFilters
              filters={filters}
              availableTags={availableTags}
              onFiltersChange={setFilters}
              resultCount={filteredApps.length}
            />
          </div>
        </div>

        {/* App grid */}
        <div className="min-w-0 flex-1">
          {isFiltered && (
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filteredApps.length}</span>{" "}
                of {allCategoryApps.length} apps
              </p>
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTER_STATE)}
                className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
              >
                Clear filters
              </button>
            </div>
          )}

          <CategoryGrid
            apps={filteredApps}
            categoryName={categoryGroup.category}
            onClearFilters={isFiltered ? () => setFilters(DEFAULT_FILTER_STATE) : undefined}
          />
        </div>
      </div>
    </div>
  );
}
