import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { cn } from "../../../styling/cn";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PricingFilter = "all" | "free" | "paid";
export type RatingFilter = "all" | "4plus" | "3plus";
export type SortOption = "popular" | "newest" | "top-rated";

export interface StoreFilterState {
  tags: string[];
  pricing: PricingFilter;
  rating: RatingFilter;
  sort: SortOption;
}

export const DEFAULT_FILTER_STATE: StoreFilterState = {
  tags: [],
  pricing: "all",
  rating: "all",
  sort: "popular",
};

// ---------------------------------------------------------------------------
// URL search param helpers
// ---------------------------------------------------------------------------

interface CategorySearchParams {
  tags?: string;
  pricing?: PricingFilter;
  rating?: RatingFilter;
  sort?: SortOption;
}

export function parseFiltersFromSearch(
  search: Partial<CategorySearchParams>,
): StoreFilterState {
  return {
    tags: search.tags ? search.tags.split(",").filter(Boolean) : [],
    pricing: (search.pricing as PricingFilter) ?? "all",
    rating: (search.rating as RatingFilter) ?? "all",
    sort: (search.sort as SortOption) ?? "popular",
  };
}

export function serializeFiltersToSearch(
  filters: StoreFilterState,
): CategorySearchParams {
  return {
    tags: filters.tags.length > 0 ? filters.tags.join(",") : undefined,
    pricing: filters.pricing !== "all" ? filters.pricing : undefined,
    rating: filters.rating !== "all" ? filters.rating : undefined,
    sort: filters.sort !== "popular" ? filters.sort : undefined,
  };
}

export function hasActiveFilters(filters: StoreFilterState): boolean {
  return (
    filters.tags.length > 0 ||
    filters.pricing !== "all" ||
    filters.rating !== "all" ||
    filters.sort !== "popular"
  );
}

// ---------------------------------------------------------------------------
// Tag filter chips
// ---------------------------------------------------------------------------

interface TagFilterProps {
  availableTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}

function TagFilter({ availableTags, selectedTags, onToggleTag }: TagFilterProps) {
  if (availableTags.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tags</p>
      <div className="flex flex-wrap gap-1.5">
        {availableTags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggleTag(tag)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              {tag}
              {isSelected && <X className="h-2.5 w-2.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort dropdown
// ---------------------------------------------------------------------------

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popular", label: "Most Popular" },
  { value: "newest", label: "Newest First" },
  { value: "top-rated", label: "Top Rated" },
];

interface SortDropdownProps {
  value: SortOption;
  onChange: (sort: SortOption) => void;
}

function SortDropdown({ value, onChange }: SortDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);

  const currentLabel = SORT_OPTIONS.find((o) => o.value === value)?.label ?? "Most Popular";

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Sort By</p>
      <div ref={ref} className="relative" onKeyDown={handleKeyDown}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30"
        >
          <span>{currentLabel}</span>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>

        {open && (
          <ul
            role="listbox"
            aria-label="Sort options"
            className="absolute left-0 top-full z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            {SORT_OPTIONS.map((option) => (
              <li key={option.value} role="option" aria-selected={value === option.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                    value === option.value
                      ? "font-semibold text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pricing toggle
// ---------------------------------------------------------------------------

const PRICING_OPTIONS: { value: PricingFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

interface PricingToggleProps {
  value: PricingFilter;
  onChange: (pricing: PricingFilter) => void;
}

function PricingToggle({ value, onChange }: PricingToggleProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Pricing</p>
      <div
        role="group"
        aria-label="Filter by pricing"
        className="flex rounded-xl border border-border bg-muted/30 p-0.5"
      >
        {PRICING_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-[10px] px-2 py-1.5 text-xs font-semibold transition-all",
              value === option.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rating filter
// ---------------------------------------------------------------------------

const RATING_OPTIONS: { value: RatingFilter; label: string }[] = [
  { value: "all", label: "All ratings" },
  { value: "4plus", label: "4+ stars" },
  { value: "3plus", label: "3+ stars" },
];

interface RatingFilterProps {
  value: RatingFilter;
  onChange: (rating: RatingFilter) => void;
}

function RatingFilterControl({ value, onChange }: RatingFilterProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Rating</p>
      <div className="flex flex-col gap-1">
        {RATING_OPTIONS.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="rating-filter"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="accent-primary"
            />
            <span
              className={cn(
                "text-sm transition-colors",
                value === option.value ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main StoreFilters component
// ---------------------------------------------------------------------------

interface StoreFiltersProps {
  filters: StoreFilterState;
  availableTags: string[];
  onFiltersChange: (filters: StoreFilterState) => void;
  /** Controlled open state for mobile drawer */
  isOpen?: boolean;
  onClose?: () => void;
  resultCount?: number;
}

export function StoreFilters({
  filters,
  availableTags,
  onFiltersChange,
  resultCount,
}: StoreFiltersProps) {
  const isActive = hasActiveFilters(filters);

  const handleTagToggle = useCallback(
    (tag: string) => {
      const next = filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag];
      onFiltersChange({ ...filters, tags: next });
    },
    [filters, onFiltersChange],
  );

  const handleReset = useCallback(() => {
    onFiltersChange(DEFAULT_FILTER_STATE);
  }, [onFiltersChange]);

  return (
    <aside
      aria-label="Filter and sort options"
      className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-card p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Filters</span>
          {isActive && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {(filters.tags.length > 0 ? 1 : 0) +
                (filters.pricing !== "all" ? 1 : 0) +
                (filters.rating !== "all" ? 1 : 0)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {resultCount !== undefined && (
            <span className="text-xs text-muted-foreground">{resultCount} apps</span>
          )}
          {isActive && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="h-px w-full bg-border/40" />

      <SortDropdown
        value={filters.sort}
        onChange={(sort) => onFiltersChange({ ...filters, sort })}
      />

      <PricingToggle
        value={filters.pricing}
        onChange={(pricing) => onFiltersChange({ ...filters, pricing })}
      />

      <RatingFilterControl
        value={filters.rating}
        onChange={(rating) => onFiltersChange({ ...filters, rating })}
      />

      {availableTags.length > 0 && (
        <TagFilter
          availableTags={availableTags}
          selectedTags={filters.tags}
          onToggleTag={handleTagToggle}
        />
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Hook: useStoreFilters
// Syncs filter state to URL search params
// ---------------------------------------------------------------------------

export function useStoreFilters() {
  const search = useSearch({ strict: false }) as Partial<CategorySearchParams>;
  const navigate = useNavigate();

  const filters = parseFiltersFromSearch(search);

  const setFilters = useCallback(
    (next: StoreFilterState) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          ...serializeFiltersToSearch(next),
        }),
        replace: true,
      });
    },
    [navigate],
  );

  return { filters, setFilters };
}
