import { useState, useEffect } from "react";
import type { BlogPost } from "../../core/types";

type BlogMeta = Omit<BlogPost, "content">;

const GRADIENTS = [
  "from-blue-600/20 to-indigo-600/20",
  "from-emerald-600/20 to-teal-600/20",
  "from-amber-600/20 to-orange-600/20",
  "from-rose-600/20 to-pink-600/20",
  "from-violet-600/20 to-purple-600/20",
];

function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function CardImage({ post, className = "" }: { post: BlogMeta; className?: string }) {
  if (post.heroImage) {
    return (
      <div className={`overflow-hidden ${className}`}>
        <img
          src={post.heroImage}
          alt={post.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
    );
  }

  const gradient = GRADIENTS[hashSlug(post.slug) % GRADIENTS.length];
  return (
    <div className={`bg-gradient-to-br ${gradient} flex items-center justify-center p-6 ${className}`}>
      <span className="text-xl sm:text-2xl font-display font-extrabold text-foreground/80 text-center leading-tight line-clamp-3">
        {post.title}
      </span>
    </div>
  );
}

function FeaturedCard({ post, LinkComp }: { post: BlogMeta; LinkComp: React.ComponentType<{ to: string; className?: string; children?: React.ReactNode }> | "a" }) {
  return (
    <article className="group relative bg-card rounded-2xl border border-border shadow-sm hover:border-primary/40 hover:shadow-lg transition-all duration-200 overflow-hidden mb-6">
      <CardImage post={post} className="aspect-[21/9] rounded-t-2xl" />
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-x-3 text-xs font-medium tracking-wider uppercase mb-2">
          {post.category && <span className="text-primary">{post.category}</span>}
          {post.category && <span className="text-muted-foreground/40">&middot;</span>}
          <time dateTime={post.date} className="text-muted-foreground/80">
            {new Date(post.date).toLocaleDateString()}
          </time>
        </div>
        <h3 className="text-xl sm:text-2xl font-display font-bold leading-snug text-foreground group-hover:text-primary transition-colors mb-2">
          {LinkComp === "a" ? (
            <a href={`/blog/${post.slug}`}>
              <span className="absolute inset-0" />
              {post.title}
            </a>
          ) : (
            <LinkComp to={`/blog/${post.slug}`}>
              <span className="absolute inset-0" />
              {post.title}
            </LinkComp>
          )}
        </h3>
        {post.primer && (
          <p className="text-sm text-muted-foreground italic">{post.primer}</p>
        )}
      </div>
    </article>
  );
}

function BlogCard({ post, LinkComp }: { post: BlogMeta; LinkComp: React.ComponentType<{ to: string; className?: string; children?: React.ReactNode }> | "a" }) {
  return (
    <article className="group relative bg-card rounded-2xl border border-border shadow-sm hover:border-primary/40 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col">
      <CardImage post={post} className="aspect-[16/9] rounded-t-2xl" />
      <div className="p-4 sm:p-5 flex flex-col flex-1">
        <div className="flex items-center gap-x-3 text-xs font-medium tracking-wider uppercase mb-2">
          {post.category && <span className="text-primary">{post.category}</span>}
          {post.category && <span className="text-muted-foreground/40">&middot;</span>}
          <time dateTime={post.date} className="text-muted-foreground/80">
            {new Date(post.date).toLocaleDateString()}
          </time>
        </div>
        <h3 className="text-lg font-display font-bold leading-snug text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2">
          {LinkComp === "a" ? (
            <a href={`/blog/${post.slug}`}>
              <span className="absolute inset-0" />
              {post.title}
            </a>
          ) : (
            <LinkComp to={`/blog/${post.slug}`}>
              <span className="absolute inset-0" />
              {post.title}
            </LinkComp>
          )}
        </h3>
        {post.primer && (
          <p className="text-sm text-muted-foreground italic line-clamp-2">{post.primer}</p>
        )}
      </div>
    </article>
  );
}

export function BlogListView({ linkComponent, limit, showHeader = true }: { linkComponent?: React.ComponentType<{ to: string; className?: string; children?: React.ReactNode }>; limit?: number; showHeader?: boolean }) {
  const [posts, setPosts] = useState<BlogMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/blog")
      .then((r) => r.json() as Promise<BlogMeta[]>)
      .then((data) => {
        if (limit) {
          const featured = data.filter((p) => p.featured);
          const rest = data.filter((p) => !p.featured);
          setPosts([...featured, ...rest].slice(0, limit));
        } else {
          setPosts(data);
        }
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading) {
    return (
      <div className={showHeader ? "max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 font-sans" : "font-sans"}>
        {showHeader && (
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight sm:text-3xl mb-3">
              The Spike.land Blog
            </h1>
            <p className="text-base text-muted-foreground font-light">
              Thoughts on AI agents, Cloudflare Workers, and the future of coding.
            </p>
          </div>
        )}
        {/* Skeleton: featured card */}
        <div className="animate-pulse bg-card rounded-2xl border border-border overflow-hidden mb-6">
          <div className="aspect-[21/9] bg-muted" />
          <div className="p-5">
            <div className="h-3 bg-muted rounded w-1/4 mb-3" />
            <div className="h-7 bg-muted rounded w-3/4 mb-3" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </div>
        {/* Skeleton: grid cards */}
        <div className="grid gap-6 sm:grid-cols-2">
          {Array.from({ length: (limit ?? 4) - 1 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-card rounded-2xl border border-border overflow-hidden">
              <div className="aspect-[16/9] bg-muted" />
              <div className="p-4">
                <div className="h-3 bg-muted rounded w-1/4 mb-3" />
                <div className="h-6 bg-muted rounded w-3/4 mb-3" />
                <div className="h-4 bg-muted rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const LinkComp = linkComponent ?? "a";
  const [featured, ...rest] = posts;

  return (
    <div className={showHeader ? "max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 font-sans" : "font-sans"}>
      {showHeader && (
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight sm:text-3xl mb-3">
            The Spike.land Blog
          </h1>
          <p className="text-base text-muted-foreground font-light">
            Thoughts on AI agents, Cloudflare Workers, and the future of coding.
          </p>
        </div>
      )}

      {featured && <FeaturedCard post={featured} LinkComp={LinkComp} />}

      <div className="grid gap-6 sm:grid-cols-2">
        {rest.map((post) => (
          <BlogCard key={post.slug} post={post} LinkComp={LinkComp} />
        ))}
      </div>
    </div>
  );
}
