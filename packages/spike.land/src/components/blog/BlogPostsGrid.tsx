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
export function BlogPostsGrid({ orderedPosts, relevantSlugs }: BlogPostsGridProps) {
  const relevantSet = new Set(relevantSlugs);

  if (orderedPosts.length === 0) {
    return (
      <div className="text-center py-24 glass-layers rounded-3xl border border-white/5">
        <p className="text-muted-foreground text-lg">No blog posts yet. Check back soon!</p>
      </div>
    );
  }

  const [featuredPost, ...restPosts] = orderedPosts;

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Featured post — full-width hero card */}
      {featuredPost && (
        <div className="relative group">
          {relevantSet.has(featuredPost.slug) && (
            <span className="absolute -top-3 -right-3 z-10 bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-full shadow-glow-primary border border-white/20">
              Personalized
            </span>
          )}
          <BlogCard post={featuredPost} />
        </div>
      )}

      {/* Remaining posts — 2-col on md, 3-col on lg */}
      {restPosts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {restPosts.map((post) => (
            <div key={post.slug} className="relative group">
              {relevantSet.has(post.slug) && (
                <span className="absolute -top-3 -right-3 z-10 bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-full shadow-glow-primary border border-white/20">
                  Personalized
                </span>
              )}
              <BlogCard post={post} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
