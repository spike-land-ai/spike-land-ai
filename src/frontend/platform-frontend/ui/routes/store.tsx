import { useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CategoryRail, HeroShelf, StoreSection } from "../components/storefront";
import { groupAppsByCategory, useApps } from "../hooks/useApps";

// ---------------------------------------------------------------------------
// Page-level skeleton helpers
// ---------------------------------------------------------------------------

function HeroSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card">
      <div className="flex flex-col gap-8 p-8 md:flex-row md:items-center md:p-12">
        <div className="flex-1 space-y-6">
          <div className="rubik-panel h-6 w-28 animate-pulse rounded-full" />
          <div className="space-y-3">
            <div className="rubik-panel h-10 animate-pulse rounded-xl" />
            <div className="rubik-panel h-10 w-3/4 animate-pulse rounded-xl" />
          </div>
          <div className="rubik-panel h-11 w-28 animate-pulse rounded-full" />
        </div>
        <div className="hidden md:block">
          <div className="rubik-panel h-48 w-48 animate-pulse rounded-[2rem]" />
        </div>
      </div>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <section className="rubik-panel-strong flex flex-col gap-6 p-6 sm:p-8">
      <div className="rubik-panel h-6 w-24 animate-pulse rounded-full" />
      <div className="space-y-3">
        <div className="rubik-panel h-10 animate-pulse rounded-xl" />
        <div className="rubik-panel h-10 w-5/6 animate-pulse rounded-xl" />
        <div className="rubik-panel h-5 animate-pulse rounded-lg" />
      </div>
      <div className="flex gap-3">
        <div className="rubik-panel h-7 w-20 animate-pulse rounded-full" />
        <div className="rubik-panel h-7 w-28 animate-pulse rounded-full" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Mobile category pill bar
// ---------------------------------------------------------------------------

interface MobileCategoryBarProps {
  groupedApps: ReturnType<typeof groupAppsByCategory>;
  activeCategory: string | null;
  isDiscover: boolean;
  onSelectCategory: (category: string | null) => void;
  isLoading?: boolean;
}

function MobileCategoryBar({
  groupedApps,
  activeCategory,
  isDiscover,
  onSelectCategory,
  isLoading = false,
}: MobileCategoryBarProps) {
  const { t } = useTranslation("store");
  // Refs for all pill buttons: [0 = Discover, 1..N = categories]
  const pillRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusIndex = useCallback(
    (index: number) => {
      const total = 1 + groupedApps.length;
      const clamped = (index + total) % total;
      pillRefs.current[clamped]?.focus();
    },
    [groupedApps.length],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        focusIndex(currentIndex + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        focusIndex(currentIndex - 1);
      }
    },
    [focusIndex],
  );

  if (isLoading) {
    return (
      <div className="xl:hidden space-y-3">
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-2" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable identity
              <div key={i} className="rubik-panel h-9 w-20 shrink-0 animate-pulse rounded-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="xl:hidden space-y-3">
      <div className="overflow-x-auto pb-2">
        <div role="group" aria-label={t("categoryRailLabel")} className="flex gap-2">
          <button
            ref={(el) => {
              pillRefs.current[0] = el;
            }}
            type="button"
            aria-selected={isDiscover}
            onClick={() => onSelectCategory(null)}
            onKeyDown={(e) => handleKeyDown(e, 0)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              isDiscover
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("discover")}
          </button>
          {groupedApps.map((group, i) => (
            <button
              key={group.category}
              ref={(el) => {
                pillRefs.current[i + 1] = el;
              }}
              type="button"
              aria-selected={activeCategory === group.category}
              onClick={() => onSelectCategory(group.category)}
              onKeyDown={(e) => handleKeyDown(e, i + 1)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === group.category
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
  );
}

// ---------------------------------------------------------------------------
// StorePage
// ---------------------------------------------------------------------------

export function StorePage() {
  const { t } = useTranslation("store");
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

  // ----- Loading state -----
  if (isLoading) {
    return (
      <div className="rubik-container-wide rubik-page flex flex-col gap-8 xl:flex-row">
        {/* Sidebar skeleton */}
        <aside className="hidden xl:block xl:w-64 xl:shrink-0">
          <div className="sticky top-6 space-y-4">
            <div className="rubik-panel animate-pulse p-5">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-8 w-32 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-4 w-full animate-pulse rounded bg-muted" />
            </div>
            <div className="rubik-panel p-3">
              <CategoryRail
                groups={[]}
                activeCategory={null}
                onSelectCategory={() => undefined}
                isLoading
              />
            </div>
          </div>
        </aside>

        {/* Main skeleton */}
        <main className="min-w-0 flex-1 space-y-8">
          <HeaderSkeleton />
          <MobileCategoryBar
            groupedApps={[]}
            activeCategory={null}
            isDiscover
            onSelectCategory={() => undefined}
            isLoading
          />
          <HeroSkeleton />
          <StoreSection
            title={t("topFreeApps")}
            subtitle={t("topFreeAppsDesc")}
            apps={[]}
            layout="list"
            isLoading
            skeletonCount={6}
          />
          <StoreSection
            title={t("newNoteworthy")}
            apps={[]}
            layout="grid"
            isLoading
            skeletonCount={4}
          />
        </main>
      </div>
    );
  }

  // ----- Error state -----
  if (isError) {
    return (
      <div className="rubik-container rubik-page rubik-stack">
        <div className="rubik-panel space-y-4 p-8 text-center">
          <p className="font-display text-lg font-semibold text-foreground">{t("loadError")}</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : t("loadError")}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  // ----- Empty state -----
  if (!apps || apps.length === 0) {
    return (
      <div className="rubik-container rubik-page rubik-stack">
        <div className="rubik-panel flex flex-col items-center gap-4 border-dashed p-12 text-center">
          <p className="text-muted-foreground">{t("emptyStore")}</p>
          <button
            type="button"
            onClick={() => selectCategory(null)}
            className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            {t("emptyCta")}
          </button>
        </div>
      </div>
    );
  }

  const isDiscover = activeGroup === null;

  return (
    <div className="rubik-container-wide rubik-page flex flex-col gap-8 xl:flex-row">
      <aside className="hidden xl:block xl:w-64 xl:shrink-0">
        <div className="sticky top-6 space-y-4">
          <div className="rubik-panel p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">
              {t("navigation")}
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">
              {t("appStore")}
            </h1>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {t("sidebarDescription")}
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
              {t("appStore")}
            </span>
            <div className="space-y-3">
              <h2 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                {t("heroTitle")}
              </h2>
              <p className="rubik-lede">{t("heroSubtitle")}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <span className="rubik-chip rubik-chip-accent">
              {t("appsCount", { count: apps.length })}
            </span>
            <span className="rubik-chip">
              {t("categoriesCount", { count: groupedApps.length })}
            </span>
            {!isDiscover && activeGroup && (
              <button
                type="button"
                onClick={() => selectCategory(null)}
                className="rubik-chip transition-colors hover:border-primary/20 hover:text-primary"
              >
                {t("backToDiscover")}
              </button>
            )}
          </div>
        </section>

        <MobileCategoryBar
          groupedApps={groupedApps}
          activeCategory={activeGroup?.category ?? null}
          isDiscover={isDiscover}
          onSelectCategory={selectCategory}
        />

        {isDiscover ? (
          <>
            <HeroShelf featuredApps={featuredApps.length > 0 ? featuredApps : apps.slice(0, 1)} />

            <StoreSection
              title={t("topFreeApps")}
              subtitle={t("topFreeAppsDesc")}
              apps={apps.slice(0, 9)}
              layout="list"
            />

            <StoreSection
              title={newestApps.length > 0 ? t("newNoteworthy") : t("recommended")}
              subtitle={newestApps.length > 0 ? t("newNoteworthyDesc") : t("recommendedDesc")}
              apps={newestApps.length > 0 ? newestApps : recommendedApps}
              layout="grid"
            />

            {groupedApps.slice(0, 3).map((group) => (
              <StoreSection
                key={group.category}
                title={group.category}
                subtitle={t("categorySlice", { category: group.category })}
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
                <div className="text-xs font-semibold uppercase tracking-widest text-primary">
                  {t("categoryView")}
                </div>
                <h3 className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {activeGroup.category}
                </h3>
                <p className="text-sm leading-7 text-muted-foreground">
                  {t("categoryBrowse", {
                    count: activeGroup.apps.length,
                    apps: activeGroup.apps.length === 1 ? t("app") : t("apps"),
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => selectCategory(null)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/20 hover:text-primary"
              >
                {t("discoverCategories")}
                <ArrowRight className="h-4 w-4" />
              </button>
            </section>

            <StoreSection
              title={t("allApps")}
              subtitle={t("allAppsDesc")}
              apps={activeGroup.apps}
              categoryName={activeGroup.category}
              layout="grid"
              onViewAll={() => selectCategory(null)}
            />
          </>
        )}
      </main>
    </div>
  );
}
