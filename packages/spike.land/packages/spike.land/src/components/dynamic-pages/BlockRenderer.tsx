"use client";

import React, { lazy, Suspense } from "react";
import type { BlockType } from "@/generated/prisma";
import type { Prisma } from "@/generated/prisma";

interface BlockRendererProps {
  block: {
    id: string;
    blockType: BlockType;
    variant: string | null;
    content: Prisma.JsonValue;
    sortOrder: number;
    isVisible: boolean;
  };
}

const blockComponents: Record<
  BlockType,
  React.LazyExoticComponent<
    React.ComponentType<{ content: Prisma.JsonValue; variant?: string; }>
  >
> = {
  HERO: lazy(() => import("./blocks/HeroBlock").then(m => ({ default: m.HeroBlock }))),
  FEATURE_GRID: lazy(() =>
    import("./blocks/FeatureGridBlock").then(m => ({
      default: m.FeatureGridBlock,
    }))
  ),
  FEATURE_LIST: lazy(() =>
    import("./blocks/FeatureListBlock").then(m => ({
      default: m.FeatureListBlock,
    }))
  ),
  CTA: lazy(() => import("./blocks/CtaBlock").then(m => ({ default: m.CtaBlock }))),
  PRICING: lazy(() => import("./blocks/PricingBlock").then(m => ({ default: m.PricingBlock }))),
  TESTIMONIALS: lazy(() =>
    import("./blocks/TestimonialsBlock").then(m => ({
      default: m.TestimonialsBlock,
    }))
  ),
  STATS: lazy(() => import("./blocks/StatsBlock").then(m => ({ default: m.StatsBlock }))),
  GALLERY: lazy(() =>
    import("./blocks/GalleryBlock").then(m => ({
      default: m.GalleryBlock,
    }))
  ),
  FAQ: lazy(() => import("./blocks/FaqBlock").then(m => ({ default: m.FaqBlock }))),
  FOOTER: lazy(() => import("./blocks/FooterBlock").then(m => ({ default: m.FooterBlock }))),
  COMPARISON_TABLE: lazy(() =>
    import("./blocks/ComparisonTableBlock").then(m => ({
      default: m.ComparisonTableBlock,
    }))
  ),
  APP_GRID: lazy(() =>
    import("./blocks/AppGridBlock").then(m => ({
      default: m.AppGridBlock,
    }))
  ),
  MARKDOWN: lazy(() =>
    import("./blocks/MarkdownBlock").then(m => ({
      default: m.MarkdownBlock,
    }))
  ),
  CUSTOM_REACT: lazy(() =>
    import("./blocks/CustomReactBlock").then(m => ({
      default: m.CustomReactBlock,
    }))
  ),
};

function BlockSkeleton() {
  return <div className="animate-pulse bg-muted/30 rounded-lg h-32 w-full" />;
}

function UnknownBlock({ blockType }: { blockType: string; }) {
  return (
    <div className="border border-dashed border-muted-foreground/30 rounded-lg p-8 text-center text-muted-foreground">
      <p className="text-sm">Unknown block type: {blockType}</p>
    </div>
  );
}

export function BlockRenderer({ block }: BlockRendererProps) {
  const LazyComponent = blockComponents[block.blockType];

  if (!LazyComponent) {
    return <UnknownBlock blockType={block.blockType} />;
  }

  return (
    <Suspense fallback={<BlockSkeleton />}>
      <LazyComponent
        content={block.content}
        variant={block.variant ?? undefined}
      />
    </Suspense>
  );
}
