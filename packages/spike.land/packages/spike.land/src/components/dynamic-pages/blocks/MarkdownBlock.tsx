"use client";

import type { z } from "zod";
import type { MarkdownContentSchema } from "@/lib/dynamic-pages/block-schemas";
import type { Prisma } from "@/generated/prisma";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownContent = z.infer<typeof MarkdownContentSchema>;

interface MarkdownBlockProps {
  content: Prisma.JsonValue;
  variant?: string;
}

/**
 * Renders markdown content in a prose-styled container.
 * Uses ReactMarkdown to safely render Markdown and sanitize HTML output.
 */
export function MarkdownBlock({ content }: MarkdownBlockProps) {
  const data = content as MarkdownContent;

  return (
    <section className="w-full py-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-3xl mx-auto">
        <div className="prose dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {data.content}
          </ReactMarkdown>
        </div>
      </div>
    </section>
  );
}
