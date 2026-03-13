import { useRef, useCallback } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { AppCategoryGroup } from "../../hooks/useApps";

interface CategoryRailProps {
  groups: AppCategoryGroup[];
  activeCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  isLoading?: boolean;
}

/** Number of skeleton rows to show while categories are loading. */
const SKELETON_COUNT = 6;

/**
 * Converts a display category name to a URL-safe slug.
 * e.g. "Code & Developer Tools" → "code---developer-tools"
 */
function categoryToSlug(category: string): string {
  return encodeURIComponent(
    category
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, ""),
  );
}

export function CategoryRail({
  groups,
  activeCategory,
  onSelectCategory,
  isLoading = false,
}: CategoryRailProps) {
  const { t } = useTranslation("store");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Refs for all focusable elements in order: [Discover, ...groups]
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  const focusIndex = useCallback(
    (index: number) => {
      const total = 1 + groups.length; // "Discover" + category links
      const clamped = (index + total) % total;
      itemRefs.current[clamped]?.focus();
    },
    [groups.length],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        focusIndex(currentIndex + 1);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        focusIndex(currentIndex - 1);
      }
    },
    [focusIndex],
  );

  if (isLoading) {
    return (
      <nav aria-label={t("categoryRailLabel")} aria-busy="true" className="flex flex-col space-y-1">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable identity
          <div key={i} className="rubik-panel h-10 animate-pulse rounded-xl" aria-hidden="true" />
        ))}
      </nav>
    );
  }

  const isOnAppsIndex = pathname === "/apps" || pathname === "/apps/";

  return (
    <nav
      aria-label={t("categoryRailLabel")}
      aria-describedby="category-rail-desc"
      className="flex flex-col space-y-1"
    >
      {/* Visually hidden description for screen-reader users */}
      <span id="category-rail-desc" className="sr-only">
        {t("categoryRailDesc")}
      </span>

      {/* Discover (always links to /apps index) */}
      <Link
        ref={(el) => {
          itemRefs.current[0] = el;
        }}
        to="/apps"
        aria-current={isOnAppsIndex && activeCategory === null ? "page" : undefined}
        onClick={() => onSelectCategory(null)}
        onKeyDown={(e) => handleKeyDown(e, 0)}
        className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
          isOnAppsIndex && activeCategory === null
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        }`}
      >
        <span>{t("discover")}</span>
      </Link>

      <div className="my-2 h-px w-full bg-border/40" />

      {groups.map((group, i) => {
        const slug = categoryToSlug(group.category);
        const categoryPath = `/apps/category/${slug}`;
        const isActive =
          pathname === categoryPath ||
          pathname.startsWith(`${categoryPath}/`) ||
          activeCategory === group.category;

        return (
          <Link
            key={group.category}
            ref={(el) => {
              itemRefs.current[i + 1] = el;
            }}
            to="/apps/category/$categorySlug"
            params={{ categorySlug: slug }}
            aria-current={isActive ? "page" : undefined}
            onKeyDown={(e) => handleKeyDown(e, i + 1)}
            className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
              isActive
                ? "bg-muted text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
          >
            <span className="truncate">{group.category}</span>
            {isActive && (
              <span className="ml-2 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background text-[10px] ring-1 ring-border/50">
                {group.apps.length}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
