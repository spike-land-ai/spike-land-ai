"use client";

import type { z } from "zod";
import type { FeatureListContentSchema } from "@/lib/dynamic-pages/block-schemas";
import type { Prisma } from "@/generated/prisma";

type FeatureListContent = z.infer<typeof FeatureListContentSchema>;

interface FeatureListBlockProps {
  content: Prisma.JsonValue;
  variant?: string;
}

export function FeatureListBlock({ content }: FeatureListBlockProps) {
  const data = content as FeatureListContent;

  return (
    <section className="w-full py-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-4xl mx-auto">
        {data.sectionTitle
          ? (
            <h2 className="text-3xl font-bold text-center mb-12">
              {data.sectionTitle}
            </h2>
          )
          : null}
        <div className="flex flex-col gap-12">
          {data.features.map((feature, index) => {
            const isEven = index % 2 === 0;
            return (
              <div
                key={`${feature.title}-${index}`}
                className={`flex flex-col md:flex-row gap-6 items-center ${
                  isEven ? "" : "md:flex-row-reverse"
                }`}
              >
                {feature.icon
                  ? (
                    <div className="flex-shrink-0 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-xl">
                      {feature.icon}
                    </div>
                  )
                  : null}
                <div className={isEven ? "md:text-left" : "md:text-right"}>
                  <h3 className="text-xl font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
