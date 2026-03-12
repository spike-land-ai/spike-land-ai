import { useTranslation } from "react-i18next";
import { StoreAppCard } from "./StoreAppCard";
import type { McpAppSummary } from "../../hooks/useApps";

interface StoreSectionProps {
  title: string;
  subtitle?: string;
  apps: McpAppSummary[];
  categoryName?: string;
  layout?: "grid" | "list";
  onViewAll?: () => void;
  /** When true, renders skeleton placeholder cards instead of real content. */
  isLoading?: boolean;
  /** Number of skeleton cards to show when isLoading is true. Defaults to 4. */
  skeletonCount?: number;
}

const GRID_SKELETON_CLASS = "rubik-panel h-52 animate-pulse rounded-2xl";
const LIST_SKELETON_CLASS = "rubik-panel h-16 animate-pulse rounded-xl";

export function StoreSection({
  title,
  subtitle,
  apps,
  categoryName,
  layout = "grid",
  onViewAll,
  isLoading = false,
  skeletonCount = 4,
}: StoreSectionProps) {
  const { t } = useTranslation("store");

  return (
    <section className="space-y-4 pt-6">
      <div className="flex items-end justify-between border-b border-border/40 pb-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {onViewAll && (isLoading || apps.length >= 4) && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-sm font-bold text-primary transition-colors hover:text-primary/80"
          >
            {t("seeAll")}
          </button>
        )}
      </div>

      {isLoading ? (
        layout === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable identity
              <div key={i} className={GRID_SKELETON_CLASS} aria-hidden="true" />
            ))}
          </div>
        ) : (
          <div className="grid gap-x-8 gap-y-2 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable identity
              <div key={i} className={LIST_SKELETON_CLASS} aria-hidden="true" />
            ))}
          </div>
        )
      ) : apps.length === 0 ? (
        /* Empty state: never leave dead space — show a CTA */
        <div className="rubik-panel flex flex-col items-center gap-4 border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">{t("emptySection")}</p>
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              {t("emptySectionCta")}
            </button>
          )}
        </div>
      ) : layout === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {apps.map((app) => (
            <StoreAppCard key={app.slug} app={app} categoryName={categoryName} layout="grid" />
          ))}
        </div>
      ) : (
        <div className="grid gap-x-8 gap-y-2 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app, index) => (
            <StoreAppCard
              key={app.slug}
              app={app}
              categoryName={categoryName}
              rank={index + 1}
              layout="list"
            />
          ))}
        </div>
      )}
    </section>
  );
}
