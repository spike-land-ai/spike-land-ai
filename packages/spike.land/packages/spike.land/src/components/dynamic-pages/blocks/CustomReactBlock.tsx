"use client";

import type { z } from "zod";
import type { CustomReactContentSchema } from "@/lib/dynamic-pages/block-schemas";
import type { Prisma } from "@/generated/prisma";

type CustomReactContent = z.infer<typeof CustomReactContentSchema>;

interface CustomReactBlockProps {
  content: Prisma.JsonValue;
  variant?: string;
}

export function CustomReactBlock({ content }: CustomReactBlockProps) {
  const data = content as CustomReactContent;

  return (
    <section className="w-full py-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-8 text-center">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Custom Component
          </p>
          <p className="text-lg font-semibold">{data.componentName}</p>
          <p className="text-sm text-muted-foreground mt-2">
            This component needs to be registered in the component registry before it can be
            rendered.
          </p>
        </div>
      </div>
    </section>
  );
}
