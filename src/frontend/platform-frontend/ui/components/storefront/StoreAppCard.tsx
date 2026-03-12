import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { McpAppSummary } from "../../hooks/useApps";

interface StoreAppCardProps {
  app: McpAppSummary;
  categoryName?: string;
  rank?: number;
  layout?: "grid" | "list";
}

export function StoreAppCard({ app, categoryName, rank, layout = "grid" }: StoreAppCardProps) {
  const { t } = useTranslation("store");
  const isList = layout === "list";

  if (isList) {
    return (
      <Link
        to="/apps/$appSlug"
        params={{ appSlug: app.slug }}
        className="group flex items-center gap-4 rounded-xl border border-transparent p-3 transition-colors hover:bg-muted/40 active:bg-muted/60"
      >
        {rank && (
          <span className="w-4 text-center text-sm font-bold text-muted-foreground/50">{rank}</span>
        )}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted/40 text-2xl shadow-sm ring-1 ring-border/50 transition-transform group-hover:scale-[1.02]">
          {app.emoji || "🔧"}
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <h3 className="truncate text-base font-semibold text-foreground transition-colors group-hover:text-primary">
            {app.name}
          </h3>
          <p className="truncate text-xs font-medium text-muted-foreground">
            {categoryName || app.category}
          </p>
        </div>
        <div className="shrink-0">
          <span className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            {t("get")}
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to="/apps/$appSlug"
      params={{ appSlug: app.slug }}
      className="group flex flex-col rounded-2xl border border-border/40 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-border/80 hover:shadow-md"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30 text-3xl shadow-sm ring-1 ring-border/50 transition-transform group-hover:scale-105">
          {app.emoji || "🔧"}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <h3 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary">
          {app.name}
        </h3>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {categoryName || app.category}
        </p>
        <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{app.description}</p>
      </div>

      <div className="mt-auto flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          {t("tool_other", { count: app.tool_count })}
        </span>
        <span className="rounded-full bg-primary/10 px-5 py-1.5 text-xs font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          {t("get")}
        </span>
      </div>
    </Link>
  );
}
