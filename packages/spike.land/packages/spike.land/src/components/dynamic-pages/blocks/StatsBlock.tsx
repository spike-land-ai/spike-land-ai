"use client";

import type { z } from "zod";
import type { StatsContentSchema } from "@/lib/dynamic-pages/block-schemas";
import type { Prisma } from "@/generated/prisma";

type StatsContent = z.infer<typeof StatsContentSchema>;

interface StatsBlockProps {
  content: Prisma.JsonValue;
  variant?: string;
}

export function StatsBlock({ content }: StatsBlockProps) {
  const data = content as StatsContent;

  return (
    <section className="w-full py-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-6xl mx-auto">
        {data.sectionTitle
          ? (
            <h2 className="text-3xl font-bold text-center mb-12">
              {data.sectionTitle}
            </h2>
          )
          : null}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {data.stats.map((stat, index) => (
            <div
              key={`${stat.label}-${index}`}
              className="text-center"
            >
              <p className="text-4xl font-bold tracking-tight">
                {stat.value}
                {stat.suffix
                  ? (
                    <span className="text-2xl text-muted-foreground ml-1">
                      {stat.suffix}
                    </span>
                  )
                  : null}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
