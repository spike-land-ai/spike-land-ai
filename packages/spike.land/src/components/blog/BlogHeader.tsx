import { Calendar, Clock, Tag, User } from "lucide-react";
import Image from "next/image";

import type { BlogPostFrontmatter } from "@/lib/blog/types";

interface BlogHeaderProps {
  frontmatter: BlogPostFrontmatter;
  readingTime: string;
}

/**
 * Blog post header with title, meta info, and featured image
 */
export function BlogHeader({ frontmatter, readingTime }: BlogHeaderProps) {
  return (
    <header className="mb-4">
      {/* Category badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 backdrop-blur-sm mb-8">
        <Tag className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs font-bold tracking-widest uppercase">
          {frontmatter.category}
        </span>
      </div>

      {/* Title — Montserrat, tight tracking for large display size */}
      <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight mb-6 text-foreground">
        {frontmatter.title}
      </h1>

      {/* Description — larger lead text, muted for visual contrast */}
      <p className="text-lg sm:text-xl text-muted-foreground/90 leading-relaxed font-normal mb-8 max-w-2xl">
        {frontmatter.description}
      </p>

      {/* Meta info row */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground border-t border-b border-border/40 py-4 my-8">
        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 shrink-0 text-primary/70" />
          <span className="font-medium">{frontmatter.author}</span>
        </div>
        <span className="text-border/60" aria-hidden="true">·</span>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-primary/70" />
          <time dateTime={frontmatter.date}>
            {new Date(frontmatter.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })}
          </time>
        </div>
        <span className="text-border/60" aria-hidden="true">·</span>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0 text-primary/70" />
          <span>{readingTime}</span>
        </div>
      </div>

      {/* Tags */}
      {frontmatter.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-10">
          {frontmatter.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-bold tracking-widest uppercase bg-primary/8 text-primary/80 px-2.5 py-1 rounded-full border border-primary/15"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Featured Image */}
      {frontmatter.image && (
        <div className="relative aspect-[21/9] w-full overflow-hidden rounded-2xl mt-6 mb-2 border border-border/40 shadow-xl shadow-black/20">
          <div className="absolute inset-0 bg-gradient-to-t from-background/10 to-transparent z-10 pointer-events-none" />
          <Image
            src={frontmatter.image}
            alt={frontmatter.title}
            fill
            className="object-cover"
            priority
          />
        </div>
      )}
    </header>
  );
}
