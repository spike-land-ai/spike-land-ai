"use client";

import type { z } from "zod";
import type { FooterContentSchema } from "@/lib/dynamic-pages/block-schemas";
import type { Prisma } from "@/generated/prisma";

type FooterContent = z.infer<typeof FooterContentSchema>;

interface FooterBlockProps {
  content: Prisma.JsonValue;
  variant?: string;
}

export function FooterBlock({ content }: FooterBlockProps) {
  const data = content as FooterContent;
  const links = data.links ?? [];

  return (
    <footer className="w-full border-t border-border py-8 px-6 md:px-12 lg:px-24">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {data.copyright
          ? <p className="text-sm text-muted-foreground">{data.copyright}</p>
          : null}
        {links.length > 0
          ? (
            <nav className="flex flex-wrap gap-6">
              {links.map((link, index) => (
                <a
                  key={`${link.label}-${index}`}
                  href={link.url}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )
          : null}
      </div>
    </footer>
  );
}
