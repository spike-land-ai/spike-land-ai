import { useRef, useCallback } from "react";
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

export function CategoryRail({
  groups,
  activeCategory,
  onSelectCategory,
  isLoading = false,
}: CategoryRailProps) {
  const { t } = useTranslation("store");

  // Refs for all focusable buttons in order: [Discover, ...groups]
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusIndex = useCallback(
    (index: number) => {
      const total = 1 + groups.length; // "Discover" + category buttons
      const clamped = (index + total) % total;
      buttonRefs.current[clamped]?.focus();
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

      <button
        ref={(el) => {
          buttonRefs.current[0] = el;
        }}
        type="button"
        aria-pressed={activeCategory === null}
        onClick={() => onSelectCategory(null)}
        onKeyDown={(e) => handleKeyDown(e, 0)}
        className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
          activeCategory === null
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        }`}
      >
        <span>{t("discover")}</span>
      </button>

      <div className="my-2 h-px w-full bg-border/40" />

      {groups.map((group, i) => {
        const isActive = activeCategory === group.category;
        return (
          <button
            key={group.category}
            ref={(el) => {
              buttonRefs.current[i + 1] = el;
            }}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelectCategory(group.category)}
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
          </button>
        );
      })}
    </nav>
  );
}
