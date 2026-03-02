"use client";

import type { z } from "zod";
import type { GalleryContentSchema } from "@/lib/dynamic-pages/block-schemas";
import type { Prisma } from "@/generated/prisma";
import Image from "next/image";

type GalleryContent = z.infer<typeof GalleryContentSchema>;

interface GalleryBlockProps {
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

export function GalleryBlock({ content }: GalleryBlockProps) {
  const data = content as GalleryContent;
  const columns = data.columns ?? 3;
  const gridClass = columnClasses[columns] ?? columnClasses[3];

  return (
    <section className="w-full py-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-6xl mx-auto">
        {data.sectionTitle ? (
          <h2 className="text-3xl font-bold text-center mb-12">{data.sectionTitle}</h2>
        ) : null}
        <div className={`grid ${gridClass} gap-4`}>
          {data.images.map((image, index) => (
            <figure key={`${image.src}-${index}`} className="group">
              <div className="overflow-hidden rounded-lg">
                <Image
                  src={image.src}
                  alt={image.alt ?? ""}
                  className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                  width={800}
                  height={600}
                  unoptimized
                />
              </div>
              {image.caption ? (
                <figcaption className="mt-2 text-sm text-muted-foreground text-center">
                  {image.caption}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
