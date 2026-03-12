import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { McpAppSummary } from "../../hooks/useApps";
import { Link } from "@tanstack/react-router";

interface HeroShelfProps {
  featuredApps: McpAppSummary[];
  isLoading?: boolean;
}

export function HeroShelf({ featuredApps, isLoading = false }: HeroShelfProps) {
  const { t } = useTranslation("store");

  if (isLoading) {
    return (
      <section
        aria-busy="true"
        aria-label={t("featuredApp")}
        className="relative overflow-hidden rounded-3xl border border-border/50 bg-card"
      >
        <div className="relative flex flex-col gap-8 p-8 md:flex-row md:items-center md:p-12">
          <div className="flex-1 space-y-6">
            <div className="rubik-panel h-6 w-28 animate-pulse rounded-full" />
            <div className="space-y-3">
              <div className="rubik-panel h-10 animate-pulse rounded-xl" />
              <div className="rubik-panel h-10 w-3/4 animate-pulse rounded-xl" />
              <div className="rubik-panel h-5 animate-pulse rounded-lg" />
              <div className="rubik-panel h-5 w-2/3 animate-pulse rounded-lg" />
            </div>
            <div className="flex items-center gap-4 pt-2">
              <div className="rubik-panel h-11 w-28 animate-pulse rounded-full" />
              <div className="rubik-panel h-5 w-36 animate-pulse rounded-lg" />
            </div>
          </div>
          <div className="hidden shrink-0 md:block">
            <div className="rubik-panel h-48 w-48 animate-pulse rounded-[2rem]" />
          </div>
        </div>
      </section>
    );
  }

  if (!featuredApps || featuredApps.length === 0) return null;

  const heroApp = featuredApps[0];

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border/50 bg-card"
      aria-label={t("featuredApp")}
    >
      {/* Abstract geometric background elements (Rubik identity: structured, dense) */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-card to-background" />
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative flex flex-col items-center gap-8 p-8 md:flex-row md:p-12">
        <div className="flex-1 space-y-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {t("featuredApp")}
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tight text-foreground md:text-5xl">
              {heroApp.name}
            </h2>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
              {heroApp.tagline || heroApp.description}
            </p>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <Link
              to="/apps/$appSlug"
              params={{ appSlug: heroApp.slug }}
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98]"
            >
              {t("getApp")}
            </Link>
            <span className="text-sm font-semibold text-muted-foreground">
              {heroApp.pricing === "free" ? t("free") : t("premium")} • {heroApp.category}
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 md:block">
          <div className="flex h-32 w-32 items-center justify-center rounded-[2rem] border border-border/40 bg-gradient-to-br from-muted/50 to-muted/20 text-7xl shadow-2xl shadow-primary/10 ring-1 ring-border/20 md:h-48 md:w-48 md:text-8xl">
            {heroApp.emoji || "✨"}
          </div>
        </div>
      </div>
    </section>
  );
}
