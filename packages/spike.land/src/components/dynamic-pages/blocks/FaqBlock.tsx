"use client";

import type { z } from "zod";
import type { FaqContentSchema } from "@/lib/dynamic-pages/block-schemas";
import type { Prisma } from "@/generated/prisma";

type FaqContent = z.infer<typeof FaqContentSchema>;

interface FaqBlockProps {
  content: Prisma.JsonValue;
  variant?: string;
}

export function FaqBlock({ content }: FaqBlockProps) {
  const data = content as FaqContent;

  return (
    <section className="w-full py-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-3xl mx-auto">
        {data.sectionTitle ? (
          <h2 className="text-3xl font-bold text-center mb-12">{data.sectionTitle}</h2>
        ) : null}
        <div className="space-y-2">
          {data.items.map((item, index) => (
            <details
              key={`${item.question}-${index}`}
              className="group rounded-lg border border-border"
            >
              <summary className="flex cursor-pointer items-center justify-between px-6 py-4 font-medium transition-colors hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <svg
                  className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
