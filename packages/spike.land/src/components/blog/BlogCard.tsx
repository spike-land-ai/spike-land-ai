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
      <Card className="h-full flex flex-col overflow-hidden transition-all duration-500 bg-background/40 backdrop-blur-xl border border-white/10 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-1.5 dark:bg-black/40">
        {/* Cover Image */}
        {frontmatter.image && (
          <div className="relative aspect-[16/10] overflow-hidden bg-muted/20">
            <Image
              src={frontmatter.image}
              alt={frontmatter.title}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            />
            {frontmatter.featured && (
              <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded">
                Featured
              </div>
            )}
          </div>
        )}

        <CardHeader className="pb-3 pt-6 px-6">
          {/* Category */}
          <div className="flex items-center gap-2 text-xs font-semibold text-primary/80 mb-3 tracking-wide uppercase">
            <Tag className="h-3.5 w-3.5" />
            <span>{frontmatter.category}</span>
          </div>

          {/* Title */}
          <h3 className="font-heading text-2xl font-bold leading-tight group-hover:text-primary transition-colors duration-300 line-clamp-2">
            {frontmatter.title}
          </h3>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col space-y-4 px-6 pb-6">
          {/* Description */}
          <p className="text-muted-foreground text-sm/relaxed line-clamp-3 mb-auto">
            {frontmatter.description}
          </p>

          <div className="pt-4 mt-auto border-t border-border/50">
            {/* Meta info */}
            <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground/80 mb-4">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 rounded-full">
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
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 rounded-full">
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
                    className="text-[10px] font-semibold tracking-wider uppercase bg-primary/5 text-primary/70 px-2 py-1 rounded-full border border-primary/10 transition-colors group-hover:bg-primary/10 group-hover:text-primary"
                  >
                    {tag}
                  </span>
                ))}
                {frontmatter.tags.length > 3 && (
                  <span className="text-[10px] font-semibold tracking-wider uppercase bg-muted/50 text-muted-foreground px-2 py-1 rounded-full">
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
