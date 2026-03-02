"use client";

import type { z } from "zod";
import type { FeatureGridContentSchema } from "@/lib/dynamic-pages/block-schemas";
import type { Prisma } from "@/generated/prisma";

type FeatureGridContent = z.infer<typeof FeatureGridContentSchema>;

interface FeatureGridBlockProps {
  content: Prisma.JsonValue;
  variant?: string;
}

const columnClasses: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5",
  6: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
};

export function FeatureGridBlock({ content }: FeatureGridBlockProps) {
  const data = content as FeatureGridContent;
  const columns = data.columns ?? 3;
  const gridClass = columnClasses[columns] ?? columnClasses[3];

  return (
    <section className="w-full py-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-6xl mx-auto">
        {data.sectionTitle ? (
          <h2 className="text-3xl font-bold text-center mb-12">{data.sectionTitle}</h2>
        ) : null}
        <div className={`grid ${gridClass} gap-6`}>
          {data.features.map((feature, index) => (
            <div
              key={`${feature.title}-${index}`}
              className="rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-md"
            >
              {feature.icon ? (
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary text-lg">
                  {feature.icon}
                </div>
              ) : null}
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
