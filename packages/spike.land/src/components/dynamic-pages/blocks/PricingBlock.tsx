"use client";

import type { z } from "zod";
import type { PricingContentSchema } from "@/lib/dynamic-pages/block-schemas";
import type { Prisma } from "@/generated/prisma";

type PricingContent = z.infer<typeof PricingContentSchema>;

interface PricingBlockProps {
  content: Prisma.JsonValue;
  variant?: string;
}

export function PricingBlock({ content }: PricingBlockProps) {
  const data = content as PricingContent;

  return (
    <section className="w-full py-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-6xl mx-auto">
        {data.sectionTitle ? (
          <h2 className="text-3xl font-bold text-center mb-12">{data.sectionTitle}</h2>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
          {data.tiers.map((tier, index) => (
            <div
              key={`${tier.name}-${index}`}
              className={`rounded-lg border bg-card p-8 flex flex-col ${
                tier.highlighted ? "ring-2 ring-primary border-primary" : "border-border"
              }`}
            >
              <h3 className="text-xl font-semibold mb-2">{tier.name}</h3>
              <p className="text-3xl font-bold mb-6">{tier.price}</p>
              <ul className="flex-1 space-y-3 mb-8">
                {tier.features.map((feature, featureIndex) => (
                  <li key={`${feature}-${featureIndex}`} className="flex items-start gap-2 text-sm">
                    <svg
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {tier.ctaUrl ? (
                <a
                  href={tier.ctaUrl}
                  className={`inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium transition-colors ${
                    tier.highlighted
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-border bg-transparent hover:bg-accent"
                  }`}
                >
                  {tier.ctaText ?? "Get Started"}
                </a>
              ) : (
                <span className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium border border-border text-muted-foreground">
                  {tier.ctaText ?? "Get Started"}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
