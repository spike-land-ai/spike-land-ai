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
    <header>
      {/* Category */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 backdrop-blur-sm self-start mb-6">
        <Tag className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold tracking-wide uppercase">
          {frontmatter.category}
        </span>
      </div>

      {/* Title */}
      <h1 className="font-heading text-5xl md:text-6xl font-extrabold leading-tight tracking-tighter mb-4 text-foreground drop-shadow-sm">
        {frontmatter.title}
      </h1>

      {/* Description */}
      <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed font-medium mb-8 max-w-3xl">
        {frontmatter.description}
      </p>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-muted-foreground/90 border-y border-border/50 py-5 my-8">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 rounded-full">
          <User className="h-4 w-4 shrink-0 text-primary/80" />
          <span>{frontmatter.author}</span>
        </div>
        <div className="hidden sm:block text-border/50">•</div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 rounded-full">
          <Calendar className="h-4 w-4 shrink-0 text-primary/80" />
          <time dateTime={frontmatter.date}>
            {new Date(frontmatter.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })}
          </time>
        </div>
        <div className="hidden sm:block text-border/50">•</div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 rounded-full">
          <Clock className="h-4 w-4 shrink-0 text-primary/80" />
          <span>{readingTime}</span>
        </div>
      </div>

      {/* Tags */}
      {frontmatter.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {frontmatter.tags.map(tag => (
            <span
              key={tag}
              className="text-xs font-bold tracking-wider uppercase bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20 backdrop-blur-sm"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Featured Image */}
      {frontmatter.image && (
        <div className="relative aspect-[21/9] w-full overflow-hidden rounded-2xl mt-12 border border-border/50 shadow-2xl shadow-primary/10 ring-1 ring-white/10">
          <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent z-10 pointer-events-none" />
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
