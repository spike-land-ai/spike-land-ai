import { CreateHero } from "@/components/create/create-hero";
import { LiveAppCard } from "@/components/create/live-app-card";
import { getRecentApps, getTopApps } from "@/lib/create/content-service";
import { logger } from "@/lib/logger";
import type { CreatedApp } from "@prisma/client";
import { Sparkles } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create | Spike Land AI",
  description:
    "Describe any app and watch AI build it live. One-shot React app generator powered by Spike Land.",
};

interface PageProps {
  searchParams: Promise<{ prompt?: string; }>;
}

interface SectionHeaderProps {
  title: string;
  count: number;
}

function SectionHeader({ title, count }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="w-1 h-7 rounded-full bg-indigo-500 shrink-0" />
      <h2 className="text-2xl font-bold text-white">
        {title}
        <span className="ml-3 inline-flex items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 text-sm font-medium px-2.5 py-0.5 min-w-[2rem] leading-tight">
          {count}
        </span>
      </h2>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20">
        <Sparkles className="h-6 w-6 text-indigo-400" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">
        No apps created yet
      </h3>
      <p className="text-zinc-400 text-sm max-w-xs leading-relaxed mb-6">
        Be the first to build something. Describe your idea above and watch AI generate a live React
        app in seconds.
      </p>
      <a
        href="#create"
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
      >
        <Sparkles className="h-4 w-4" />
        Create your first app
      </a>
    </section>
  );
}

export default async function CreateLanding({ searchParams }: PageProps) {
  const { prompt } = await searchParams;
  let popular: CreatedApp[] = [];
  let recent: CreatedApp[] = [];

  try {
    [popular, recent] = await Promise.all([
      getTopApps(12),
      getRecentApps(9),
    ]);
  } catch (error) {
    logger.error("Failed to load created apps:", error);
  }

  // De-duplicate: remove any recent apps that already appear in popular
  const popularIds = new Set(popular.map(a => a.id));
  const uniqueRecent = recent.filter(a => !popularIds.has(a.id));

  const isEmpty = popular.length === 0 && uniqueRecent.length === 0;

  return (
    <div className="container mx-auto px-4 space-y-16 py-8">
      {/* Hero Section with ComposerBox and starter idea chips */}
      <CreateHero {...(prompt !== undefined ? { prompt } : {})} />

      {isEmpty ? <EmptyState /> : (
        <>
          {/* Popular Apps — primary section */}
          {popular.length > 0 && (
            <section>
              <SectionHeader title="Popular Apps" count={popular.length} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {popular.map(app => (
                  <LiveAppCard
                    key={app.id}
                    title={app.title}
                    description={app.description}
                    slug={app.slug}
                    codespaceId={app.codespaceId}
                    viewCount={app.viewCount}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Visual separator between sections */}
          {popular.length > 0 && uniqueRecent.length > 0 && <hr className="border-zinc-800" />}

          {/* Recently Created */}
          {uniqueRecent.length > 0 && (
            <section>
              <SectionHeader
                title="Recently Created"
                count={uniqueRecent.length}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {uniqueRecent.map(app => (
                  <LiveAppCard
                    key={app.id}
                    title={app.title}
                    description={app.description}
                    slug={app.slug}
                    codespaceId={app.codespaceId}
                    viewCount={app.viewCount}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
