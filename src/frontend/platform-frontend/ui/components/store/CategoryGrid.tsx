import { useCallback, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StoreAppCard } from "../storefront/StoreAppCard";
import type { McpAppSummary } from "../../hooks/useApps";
import { cn } from "../../../styling/cn";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function GridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable identity
        <div key={i} className="rubik-panel h-52 animate-pulse rounded-2xl" aria-hidden="true" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination controls
// ---------------------------------------------------------------------------

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Build visible page range: always show first, last, and ±2 around current
  const visiblePages = new Set<number>();
  visiblePages.add(1);
  visiblePages.add(totalPages);
  for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
    visiblePages.add(i);
  }
  const pageList = Array.from(visiblePages).sort((a, b) => a - b);

  return (
    <nav aria-label="Page navigation" className="flex items-center justify-center gap-1 pt-6">
      <button
        type="button"
        aria-label="Previous page"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pageList.map((page, idx) => {
        const prev = pageList[idx - 1];
        const showEllipsis = prev !== undefined && page - prev > 1;
        return (
          <span key={page} className="flex items-center gap-1">
            {showEllipsis && (
              <span className="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground">
                …
              </span>
            )}
            <button
              type="button"
              aria-label={`Page ${page}`}
              aria-current={currentPage === page ? "page" : undefined}
              onClick={() => onPageChange(page)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium transition-colors",
                currentPage === page
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              {page}
            </button>
          </span>
        );
      })}

      <button
        type="button"
        aria-label="Next page"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  onClearFilters?: () => void;
}

function EmptyState({ onClearFilters }: EmptyStateProps) {
  return (
    <div className="rubik-panel flex flex-col items-center gap-4 border-dashed px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 text-3xl">
        🔍
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">No apps match your filters</p>
        <p className="text-sm text-muted-foreground">
          Try adjusting your filters or search in a different category.
        </p>
      </div>
      {onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoryGrid
// ---------------------------------------------------------------------------

interface CategoryGridProps {
  apps: McpAppSummary[];
  categoryName?: string;
  isLoading?: boolean;
  onClearFilters?: () => void;
}

export function CategoryGrid({
  apps,
  categoryName,
  isLoading = false,
  onClearFilters,
}: CategoryGridProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState<PageSize>(12);

  const totalPages = Math.ceil(apps.length / pageSize);

  // Reset to page 1 when apps list changes (due to filter changes)
  const stableAppsKey = apps.map((a) => a.slug).join(",");

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [],
  );

  // Reset page when app list changes
  const prevKey = useState(stableAppsKey);
  if (prevKey[0] !== stableAppsKey) {
    prevKey[1](stableAppsKey);
    if (currentPage !== 1) setCurrentPage(1);
  }

  if (isLoading) {
    return <GridSkeleton count={pageSize} />;
  }

  if (apps.length === 0) {
    return <EmptyState onClearFilters={onClearFilters} />;
  }

  const startIndex = (currentPage - 1) * pageSize;
  const pageApps = apps.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {pageApps.map((app) => (
          <StoreAppCard key={app.slug} app={app} categoryName={categoryName} layout="grid" />
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
