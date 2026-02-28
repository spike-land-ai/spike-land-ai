import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

import {
  getAppBySlug,
  getAppsByCategory,
  STORE_APPS,
} from "@/app/store/data/store-apps";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStoreIcon } from "@/app/store/components/store-icon-map";
import { StoreAppRating } from "@/app/store/components/store-app-rating";
import { StoreReviewsSection } from "@/app/store/components/store-reviews-section";
import { StoreInstallButton } from "@/app/store/components/store-install-button";
import { StoreWishlistButton } from "@/app/store/components/store-wishlist-button";
import { StoreRecommendations } from "@/app/store/components/store-recommendations";
import { CommentSection } from "@/components/engagement/CommentSection";
import { ContentViewStats } from "@/components/engagement/ContentViewStats";

export const revalidate = 3600; // ISR: revalidate every hour

interface PageProps {
  params: Promise<{ slug: string; }>;
}

export function generateStaticParams() {
  return STORE_APPS.map(app => ({ slug: app.slug }));
}

export async function generateMetadata(
  { params }: PageProps,
): Promise<Metadata> {
  const { slug } = await params;
  const app = getAppBySlug(slug);
  if (!app) return {};

  return {
    title: `${app.name} — ${app.tagline} | Spike Land`,
    description: app.description,
    openGraph: {
      title: `${app.name} — ${app.tagline} | Spike Land`,
      description: app.description,
      type: "website",
      url: `https://spike.land/store/${app.slug}`,
      siteName: "Spike Land",
    },
    twitter: {
      card: "summary_large_image",
      title: `${app.name} — ${app.tagline} | Spike Land`,
      description: app.description,
    },
  };
}

const variantGradients: Record<string, string> = {
  blue: "from-blue-500 to-cyan-500",
  fuchsia: "from-fuchsia-500 to-pink-500",
  green: "from-emerald-500 to-green-500",
  purple: "from-purple-500 to-indigo-500",
  orange: "from-orange-500 to-amber-500",
  pink: "from-pink-500 to-rose-500",
};

function AppStructuredData({
  app,
}: {
  app: { name: string; description: string; slug: string; };
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: app.name,
    description: app.description,
    applicationCategory: "WebApplication",
    url: `https://spike.land/store/${app.slug}`,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "GBP",
    },
    provider: {
      "@type": "Organization",
      name: "Spike Land",
      url: "https://spike.land",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default async function StoreAppPage({ params }: PageProps) {
  const { slug } = await params;
  const app = getAppBySlug(slug);
  if (!app) notFound();

  const IconComponent = getStoreIcon(app.icon);
  const gradient = variantGradients[app.cardVariant]
    ?? variantGradients.blue;
  const appUrl = app.appUrl;
  const isInternal = appUrl?.startsWith("/");

  // Related apps (same category, excluding current)
  const relatedApps = getAppsByCategory(app.category)
    .filter(a => a.slug !== app.slug)
    .slice(0, 3);

  // Group MCP tools by category
  const groupedTools = app.mcpTools.reduce<
    Record<string, typeof app.mcpTools>
  >((acc, tool) => {
    const list = acc[tool.category] ?? [];
    list.push(tool);
    acc[tool.category] = list;
    return acc;
  }, {});

  return (
    <>
      <AppStructuredData app={app} />

      <div className="text-white">
        {/* Breadcrumb nav */}
        <div className="container mx-auto max-w-4xl px-6 pt-8">
          <nav className="flex items-center gap-1.5 text-sm text-zinc-500 mb-10">
            <Link
              href="/apps/store"
              className="hover:text-white transition-colors"
            >
              Store
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-zinc-300 capitalize">{app.category}</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-zinc-300">{app.name}</span>
          </nav>
        </div>

        {/* Header */}
        <div className="container mx-auto max-w-4xl px-6 mb-10">
          <div className="flex items-start gap-6">
            {/* Large squircle icon */}
            <div
              className={`flex h-24 w-24 md:h-28 md:w-28 shrink-0 items-center justify-center rounded-[28px] bg-gradient-to-br ${gradient} shadow-2xl`}
            >
              <IconComponent className="h-12 w-12 md:h-14 md:w-14 text-white" />
            </div>

            <div className="flex-1 space-y-3">
              <h1 className="text-4xl font-black md:text-5xl">{app.name}</h1>
              <p className="text-lg text-zinc-400">{app.tagline}</p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Badge
                  variant="secondary"
                  className="bg-white/[0.05] text-zinc-400 border-0 capitalize"
                >
                  {app.category}
                </Badge>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-0">
                  Free
                </Badge>
                <ContentViewStats path={`/store/${slug}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="container mx-auto max-w-4xl px-6 mb-16">
          <div className="flex flex-wrap items-center gap-3">
            {appUrl && (
              <Button
                asChild
                className="gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full px-8 h-11 font-semibold"
              >
                {isInternal ? <Link href={appUrl}>Open App</Link> : (
                  <a
                    href={appUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open App
                  </a>
                )}
              </Button>
            )}
            {app.mcpServerUrl && (
              <Button
                asChild
                variant="outline"
                className="rounded-full px-8 h-11 border-white/10 hover:bg-white/[0.05]"
              >
                <a
                  href={app.mcpServerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Connect MCP
                </a>
              </Button>
            )}
            <StoreInstallButton
              appSlug={app.slug}
              {...(app.installCount !== undefined ? { initialCount: app.installCount } : {})}
            />
            <StoreWishlistButton appSlug={app.slug} />
          </div>
        </div>

        {/* Divider */}
        <div className="container mx-auto max-w-4xl px-6">
          <div className="border-t border-white/[0.06]" />
        </div>

        {/* About */}
        <section className="container mx-auto max-w-4xl px-6 py-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-4">
            About
          </h2>
          <p className="text-zinc-400 leading-relaxed text-lg">
            {app.longDescription}
          </p>
        </section>

        {/* Features Grid */}
        <section className="container mx-auto max-w-4xl px-6 pb-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-6">
            Features
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {app.features.map(feature => {
              const FeatureIcon = getStoreIcon(feature.icon);
              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06]">
                    <FeatureIcon className="h-5 w-5 text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-white mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Ratings & Reviews */}
        {app.rating !== undefined && app.ratingCount !== undefined && (
          <section className="container mx-auto max-w-4xl px-6 pb-12">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-4">
              Ratings & Reviews
            </h2>
            <StoreAppRating
              rating={app.rating}
              ratingCount={app.ratingCount}
              showBreakdown
            />
          </section>
        )}

        <section className="container mx-auto max-w-4xl px-6 pb-12">
          <Suspense
            fallback={<div className="animate-pulse h-48 rounded-xl bg-white/5" />}
          >
            <StoreReviewsSection appSlug={app.slug} />
          </Suspense>
        </section>

        {/* Comments */}
        <section className="container mx-auto max-w-4xl px-6 pb-12">
          <CommentSection contentType="app" contentSlug={app.slug} />
        </section>

        {/* Related Apps */}
        {relatedApps.length > 0 && (
          <section className="container mx-auto max-w-4xl px-6 pb-12">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-6">
              More from {app.category}
            </h2>
            <div className="flex flex-wrap gap-4">
              {relatedApps.map(related => {
                const RelatedIcon = getStoreIcon(related.icon);
                const relatedGradient = variantGradients[related.cardVariant]
                  ?? variantGradients.blue;
                return (
                  <Link
                    key={related.slug}
                    href={`/store/${related.slug}`}
                    className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:bg-white/[0.05] transition-colors"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${relatedGradient}`}
                    >
                      <RelatedIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {related.name}
                      </p>
                      <p className="text-xs text-zinc-500 leading-tight">
                        {related.tagline}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* MCP Tools */}
        <section className="container mx-auto max-w-4xl px-6 pb-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-6">
            Capabilities
          </h2>
          <div className="space-y-4">
            {Object.entries(groupedTools).map(([category, tools]) => (
              <div
                key={category}
                className="rounded-2xl border border-white/[0.06] overflow-hidden"
              >
                <div className="bg-white/[0.02] px-5 py-3 border-b border-white/[0.04]">
                  <span className="text-sm font-medium text-zinc-400 capitalize">
                    {category.replace(/-/g, " ")}
                  </span>
                </div>
                <div className="divide-y divide-white/[0.03]">
                  {tools.map(tool => (
                    <div key={tool.name} className="px-5 py-3">
                      <code className="text-sm font-mono text-blue-400">
                        {tool.name}
                      </code>
                      <p className="text-sm text-zinc-500 mt-0.5">
                        {tool.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tags */}
        <section className="container mx-auto max-w-4xl px-6 pb-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-4">
            Tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {app.tags.map(tag => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-white/[0.03] text-zinc-500 border-0"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </section>

        {/* Recommendations */}
        <section className="container mx-auto max-w-4xl px-6 pb-12">
          <StoreRecommendations appSlug={app.slug} />
        </section>

        {/* Bottom CTA */}
        <div className="container mx-auto max-w-4xl px-6 pb-16">
          <div className="relative rounded-3xl border border-white/[0.06] bg-gradient-to-br from-blue-500/10 via-white/[0.02] to-purple-500/10 p-10 text-center overflow-hidden">
            {/* Background glow */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.12),transparent_70%)] pointer-events-none"
            />
            {/* Top highlight */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"
            />
            <p className="relative z-10 text-zinc-400 mb-5">
              Explore more AI-generated apps.
            </p>
            <Button
              asChild
              className="relative z-10 rounded-full bg-white text-black hover:bg-zinc-200 font-semibold px-8 shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all duration-300 hover:scale-[1.03]"
            >
              <Link href="/apps/store">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Browse All Apps
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
