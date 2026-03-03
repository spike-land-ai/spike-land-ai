"use client";

import type { CSSProperties } from "react";
import type { z } from "zod";
import type { HeroContentSchema } from "@/lib/dynamic-pages/block-schemas";
import type { Prisma } from "@/generated/prisma";

type HeroContent = z.infer<typeof HeroContentSchema>;

interface HeroBlockProps {
  content: Prisma.JsonValue;
  variant?: string;
}

const alignmentClasses: Record<string, string> = {
  left: "text-left items-start",
  center: "text-center items-center",
  right: "text-right items-end",
};

export function HeroBlock({ content }: HeroBlockProps) {
  const data = content as HeroContent;
  const alignment = data.alignment ?? "center";
  const alignClass = alignmentClasses[alignment] ?? alignmentClasses.center;

  const backgroundStyle: CSSProperties = data.backgroundImage
    ? {
      backgroundImage: `url(${data.backgroundImage})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }
    : {};

  return (
    <section
      className="relative w-full py-24 px-6 md:px-12 lg:px-24"
      style={backgroundStyle}
    >
      {data.backgroundImage
        ? <div className="absolute inset-0 bg-background/70" />
        : null}
      <div
        className={`relative flex flex-col gap-6 max-w-4xl mx-auto ${alignClass}`}
      >
        <h1 className="text-5xl font-bold tracking-tight">{data.headline}</h1>
        {data.subheadline
          ? (
            <p className="text-xl text-muted-foreground max-w-2xl">
              {data.subheadline}
            </p>
          )
          : null}
        {data.ctaText && data.ctaUrl
          ? (
            <a
              href={data.ctaUrl}
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {data.ctaText}
            </a>
          )
          : null}
      </div>
    </section>
  );
}
