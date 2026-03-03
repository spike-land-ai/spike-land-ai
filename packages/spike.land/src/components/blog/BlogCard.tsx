import { Link } from "@/components/ui/link";
import { Calendar, Clock, Tag } from "lucide-react";
import Image from "next/image";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ContentViewStats } from "@/components/engagement/ContentViewStats";
import type { BlogPostMeta } from "@/lib/blog/types";

interface BlogCardProps {
  post: BlogPostMeta;
}

/**
 * Blog post preview card for listing pages
 */
export function BlogCard({ post }: BlogCardProps) {
  const { frontmatter, slug, readingTime } = post;

  return (
    <Link href={`/blog/${slug}`} className="group block h-full">
      <Card className="h-full flex flex-col overflow-hidden transition-all duration-300 bg-background/50 backdrop-blur-sm border border-border/60 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 dark:bg-black/30">
        {/* Cover Image */}
        {frontmatter.image && (
          <div className="relative aspect-[16/9] overflow-hidden bg-muted/20 shrink-0">
            <Image
              src={frontmatter.image}
              alt={frontmatter.title}
              fill
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
            {frontmatter.featured && (
              <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full">
                Featured
              </div>
            )}
          </div>
        )}

        <CardHeader className="pb-2 pt-5 px-5">
          {/* Category */}
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary/70 mb-2.5 tracking-widest uppercase">
            <Tag className="h-3 w-3" />
            <span>{frontmatter.category}</span>
          </div>

          {/* Title */}
          <h3 className="font-heading text-xl font-bold leading-snug group-hover:text-primary transition-colors duration-200 line-clamp-2">
            {frontmatter.title}
          </h3>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col px-5 pb-5">
          {/* Description */}
          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 mb-4">
            {frontmatter.description}
          </p>

          <div className="mt-auto pt-4 border-t border-border/40">
            {/* Meta info */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground/70 mb-3">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <time dateTime={frontmatter.date}>
                  {new Date(frontmatter.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </time>
              </div>
              <span aria-hidden="true">·</span>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{readingTime}</span>
              </div>
              <ContentViewStats path={`/blog/${slug}`} compact />
            </div>

            {/* Tags */}
            {frontmatter.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {frontmatter.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-semibold tracking-wider uppercase bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full border border-border/50 transition-colors group-hover:bg-primary/8 group-hover:text-primary/80 group-hover:border-primary/20"
                  >
                    {tag}
                  </span>
                ))}
                {frontmatter.tags.length > 3 && (
                  <span className="text-[10px] font-semibold tracking-wider uppercase bg-muted/40 text-muted-foreground/60 px-2 py-0.5 rounded-full">
                    +{frontmatter.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
