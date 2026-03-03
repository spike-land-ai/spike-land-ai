"use client";

import type { z } from "zod";
import type { CtaContentSchema } from "@/lib/dynamic-pages/block-schemas";
import type { Prisma } from "@/generated/prisma";

type CtaContent = z.infer<typeof CtaContentSchema>;

interface CtaBlockProps {
  content: Prisma.JsonValue;
  variant?: string;
}

const buttonVariantClasses: Record<string, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
  outline: "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
};

export function CtaBlock({ content }: CtaBlockProps) {
  const data = content as CtaContent;

  return (
    <section className="w-full py-16 px-6 md:px-12 lg:px-24 bg-muted/30">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">{data.headline}</h2>
        {data.description
          ? (
            <p className="text-lg text-muted-foreground mb-8">
              {data.description}
            </p>
          )
          : null}
        <div className="flex flex-wrap justify-center gap-4">
          {data.buttons.map((button, index) => {
            const variantClass = buttonVariantClasses[button.variant ?? "primary"]
              ?? buttonVariantClasses.primary;
            return (
              <a
                key={`${button.text}-${index}`}
                href={button.url}
                className={`inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium transition-colors ${variantClass}`}
              >
                {button.text}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
