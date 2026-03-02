"use client";

import { useCallback, useState } from "react";
import type { z } from "zod";
import type { AppGridContentSchema } from "@/lib/dynamic-pages/block-schemas";
import type { Prisma } from "@/generated/prisma";

type AppGridContent = z.infer<typeof AppGridContentSchema>;

interface AppGridBlockProps {
  content: Prisma.JsonValue;
  variant?: string;
}

export function AppGridBlock({ content }: AppGridBlockProps) {
  const data = content as AppGridContent;
  const categories = data.categories ?? [];
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const handleCategoryClick = useCallback((category: string | null) => {
    setActiveCategory(category);
  }, []);

  const filteredApps = activeCategory
    ? data.apps.filter((app) => app.category === activeCategory)
    : data.apps;

  return (
    <section className="w-full py-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-6xl mx-auto">
        {data.sectionTitle ? (
          <h2 className="text-3xl font-bold text-center mb-8">{data.sectionTitle}</h2>
        ) : null}
        {categories.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <button
              type="button"
              onClick={() => handleCategoryClick(null)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                type="button"
                key={category}
                onClick={() => handleCategoryClick(category)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === category
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredApps.map((app, index) => (
            <div
              key={`${app.name}-${index}`}
              className="rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-4 mb-3">
                {app.icon ? (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary text-xl flex-shrink-0">
                    {app.icon}
                  </div>
                ) : null}
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{app.name}</h3>
                  {app.tagline ? (
                    <p className="text-sm text-muted-foreground truncate">{app.tagline}</p>
                  ) : null}
                </div>
              </div>
              {app.category ? (
                <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {app.category}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
