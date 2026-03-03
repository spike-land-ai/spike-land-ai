"use client";

import { BlogCard } from "@/components/blog";
import type { BlogPostMeta } from "@/lib/blog/types";

interface BlogPostsGridProps {
  orderedPosts: BlogPostMeta[];
  relevantSlugs: string[];
}

/**
 * Client-side blog post grid.
 */
export function BlogPostsGrid({
  orderedPosts,
  relevantSlugs,
}: BlogPostsGridProps) {
  const relevantSet = new Set(relevantSlugs);

  if (orderedPosts.length === 0) {
    return (
      <div className="text-center py-24 glass-layers rounded-3xl border border-white/5">
        <p className="text-muted-foreground text-lg">
          No blog posts yet. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
      {orderedPosts.map((post, index) => (
        <div
          key={post.slug}
          className={[
            "relative group",
            index === 0 ? "lg:col-span-3" : "",
          ].filter(Boolean).join(" ")}
        >
          {relevantSet.has(post.slug) && (
            <span className="absolute -top-3 -right-3 z-10 bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-full shadow-glow-primary border border-white/20 transform hover:scale-105 transition-transform duration-300">
              Personalized
            </span>
          )}
          <BlogCard post={post} />
        </div>
      ))}
    </div>
  );
}
