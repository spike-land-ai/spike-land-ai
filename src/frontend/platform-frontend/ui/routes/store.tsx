import { useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { CategoryRail, HeroShelf, StoreSection } from "../components/storefront";
import { groupAppsByCategory, useApps } from "../hooks/useApps";

export function StorePage() {
  const search = useSearch({ strict: false }) as { category?: string };
  const navigate = useNavigate();
  const { data: apps, isLoading, isError, error } = useApps();

  const groupedApps = useMemo(() => groupAppsByCategory(apps ?? []), [apps]);
  const featuredApps = useMemo(
    () => (apps ?? []).filter((app) => app.is_featured).slice(0, 4),
    [apps],
  );
  const newestApps = useMemo(() => (apps ?? []).filter((app) => app.is_new).slice(0, 8), [apps]);
  const activeGroup = useMemo(() => {
    if (!search.category) return null;
    return groupedApps.find((group) => group.category === search.category) ?? null;
  }, [groupedApps, search.category]);
  const recommendedApps = useMemo(() => (apps ?? []).slice(3, 11), [apps]);

  const selectCategory = (category: string | null) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        category: category ?? undefined,
      }),
    });
  };

  if (isLoading) {
    return (
      <div className="rubik-container rubik-page flex h-64 items-center justify-center">
        <div role="status" aria-live="polite" className="text-muted-foreground animate-pulse">
          Loading app store...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rubik-container rubik-page rubik-stack">
        <div className="rubik-panel space-y-4 p-8 text-center">
          <p className="text-lg font-display font-semibold text-foreground">
            We couldn&apos;t load the app catalog right now.
          </p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
          </p>
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

  if (!apps || apps.length === 0) {
    return (
      <div className="rubik-container rubik-page rubik-stack">
        <div className="rubik-panel border-dashed p-12 text-center text-muted-foreground">
          No apps found in the public catalog.
        </div>
      </div>
    );
  }

  const isDiscover = activeGroup === null;

  return (
    <div className="rubik-container rubik-page flex flex-col gap-8 xl:flex-row">
      <aside className="hidden xl:block xl:w-64 xl:shrink-0">
        <div className="sticky top-6 space-y-4">
          <div className="rubik-panel p-5">
            <div className="text-xs font-semibold tracking-widest uppercase text-primary">
              Navigation
            </div>
            <h1 className="mt-2 text-2xl font-display font-bold tracking-tight text-foreground">
              App Store
            </h1>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Browse by category when you know the capability family, or stay in discover mode to
              see the editorial shelves.
            </p>
          </div>

          <div className="rubik-panel p-3">
            <CategoryRail
              groups={groupedApps}
              activeCategory={activeGroup?.category ?? null}
              onSelectCategory={selectCategory}
            />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 space-y-8">
        <section className="rubik-panel-strong flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <span className="rubik-eyebrow">
              <Sparkles className="h-3.5 w-3.5" />
              App Store
            </span>
            <div className="space-y-3">
              <h2 className="text-4xl font-display font-extrabold tracking-tight text-foreground sm:text-5xl">
                Browse product-shaped MCP apps, not disconnected tool listings.
              </h2>
              <p className="rubik-lede">
                Discover public app surfaces, compare capability families, and jump straight into
                the chat, terminal, docs, or runtime view that matters.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <span className="rubik-chip rubik-chip-accent">{apps.length} apps</span>
            <span className="rubik-chip">{groupedApps.length} categories</span>
            {!isDiscover && activeGroup && (
              <button
                type="button"
                onClick={() => selectCategory(null)}
                className="rubik-chip transition-colors hover:border-primary/20 hover:text-primary"
              >
                Back to discover
              </button>
            )}
          </div>
        </section>

        <div className="xl:hidden space-y-3">
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => selectCategory(null)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isDiscover
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                Discover
              </button>
              {groupedApps.map((group) => (
                <button
                  key={group.category}
                  type="button"
                  onClick={() => selectCategory(group.category)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    activeGroup?.category === group.category
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {group.category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isDiscover ? (
          <>
            <HeroShelf featuredApps={featuredApps.length > 0 ? featuredApps : apps.slice(0, 1)} />

            <StoreSection
              title="Top Free Apps"
              subtitle="The most active app surfaces across the public catalog."
              apps={apps.slice(0, 9)}
              layout="list"
            />

            <StoreSection
              title={newestApps.length > 0 ? "New & Noteworthy" : "Recommended"}
              subtitle={
                newestApps.length > 0
                  ? "Freshly added apps and newly merchandised surfaces."
                  : "A second shelf of strong app surfaces to explore next."
              }
              apps={newestApps.length > 0 ? newestApps : recommendedApps}
              layout="grid"
            />

            {groupedApps.slice(0, 3).map((group) => (
              <StoreSection
                key={group.category}
                title={group.category}
                subtitle={`A quick slice of ${group.category.toLowerCase()} apps.`}
                apps={group.apps.slice(0, 4)}
                categoryName={group.category}
                layout="grid"
                onViewAll={() => selectCategory(group.category)}
              />
            ))}
          </>
        ) : (
          <>
            <section className="rubik-panel flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <div className="text-xs font-semibold tracking-widest uppercase text-primary">
                  Category View
                </div>
                <h3 className="text-3xl font-display font-bold tracking-tight text-foreground">
                  {activeGroup.category}
                </h3>
                <p className="text-sm leading-7 text-muted-foreground">
                  Browse {activeGroup.apps.length} {activeGroup.apps.length === 1 ? "app" : "apps"}{" "}
                  in this capability family.
                </p>
              </div>
              <button
                type="button"
                onClick={() => selectCategory(null)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/20 hover:text-primary"
              >
                Discover all categories
                <ArrowRight className="h-4 w-4" />
              </button>
            </section>

            <StoreSection
              title="All Apps"
              subtitle="Every app in this category, sorted by storefront order."
              apps={activeGroup.apps}
              categoryName={activeGroup.category}
              layout="grid"
            />
          </>
        )}
      </main>
    </div>
  );
}
