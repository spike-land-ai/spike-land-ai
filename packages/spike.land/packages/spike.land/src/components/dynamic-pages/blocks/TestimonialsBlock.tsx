"use client";

import type { z } from "zod";
import type { TestimonialsContentSchema } from "@/lib/dynamic-pages/block-schemas";
import type { Prisma } from "@/generated/prisma";
import Image from "next/image";

type TestimonialsContent = z.infer<typeof TestimonialsContentSchema>;

interface TestimonialsBlockProps {
  content: Prisma.JsonValue;
  variant?: string;
}

export function TestimonialsBlock({ content }: TestimonialsBlockProps) {
  const data = content as TestimonialsContent;

  return (
    <section className="w-full py-16 px-6 md:px-12 lg:px-24 bg-muted/20">
      <div className="max-w-6xl mx-auto">
        {data.sectionTitle
          ? (
            <h2 className="text-3xl font-bold text-center mb-12">
              {data.sectionTitle}
            </h2>
          )
          : null}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.testimonials.map((testimonial, index) => (
            <div
              key={`${testimonial.author}-${index}`}
              className="rounded-lg border border-border bg-card p-6"
            >
              <blockquote className="text-sm leading-relaxed text-muted-foreground mb-4">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3">
                {testimonial.avatarUrl
                  ? (
                    <Image
                      src={testimonial.avatarUrl}
                      alt={testimonial.author}
                      className="h-10 w-10 rounded-full object-cover"
                      width={40}
                      height={40}
                      unoptimized
                    />
                  )
                  : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {testimonial.author.charAt(0).toUpperCase()}
                    </div>
                  )}
                <div>
                  <p className="text-sm font-semibold">{testimonial.author}</p>
                  {testimonial.role
                    ? (
                      <p className="text-xs text-muted-foreground">
                        {testimonial.role}
                      </p>
                    )
                    : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
