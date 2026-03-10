import { useState, useEffect } from "react";
import type { BlogPost } from "../core-logic/types";
import { Calendar, Tag, ArrowRight, Clock, BookOpen } from "lucide-react";
import { cn } from "@spike-land-ai/shared";
import { apiUrl } from "../core-logic/api";
import { sanitizeBlogImageSrc } from "../core-logic/blog-image-policy";

type BlogMeta = Omit<BlogPost, "content">;

const GRADIENTS = [
  "from-blue-600/10 to-indigo-600/10 text-blue-600 dark:text-blue-400",
  "from-emerald-600/10 to-teal-600/10 text-emerald-600 dark:text-emerald-400",
  "from-amber-600/10 to-orange-600/10 text-amber-600 dark:text-amber-400",
  "from-rose-600/10 to-pink-600/10 text-rose-600 dark:text-rose-400",
  "from-violet-600/10 to-purple-600/10 text-violet-600 dark:text-violet-400",
];

function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function CardImage({
  post,
  className = "",
}: {
  post: BlogMeta;
  className?: string;
}) {
  const safeHeroImage = sanitizeBlogImageSrc(post.heroImage);

  if (safeHeroImage) {
    return (
      <div className={cn("overflow-hidden relative group", className)}>
        <img
          src={safeHeroImage}
          alt={post.title}
          width={800}
          height={500}
          loading="lazy"
          decoding="async"
          className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
    );
  }

  const gradientClass = GRADIENTS[hashSlug(post.slug) % GRADIENTS.length];
  return (
    <div
      className={cn(
        "bg-gradient-to-br flex flex-col items-center justify-center p-8 text-center relative overflow-hidden",
        gradientClass,
        className,
      )}
    >
      <div className="absolute -right-4 -bottom-4 opacity-5 rotate-12">
        <BookOpen size={120} />
      </div>
      <span className="relative z-10 text-2xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-3xl">
        {post.title}
      </span>
    </div>
  );
}

function FeaturedCard({
  post,
  LinkComp,
}: {
  post: BlogMeta;
  LinkComp:
    | React.ComponentType<{
        to: string;
        className?: string;
        children: React.ReactNode;
      }>
    | "a";
}) {
  const content = (
    <div className="flex flex-col lg:flex-row h-full">
      <CardImage
        post={post}
        className="lg:w-3/5 lg:h-full aspect-[16/9] lg:aspect-auto"
      />
      <div className="flex w-full flex-col justify-center bg-card p-8 lg:w-2/5 lg:p-12">
        <div className="mb-6 flex flex-wrap items-center gap-4 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {post.draft && (
            <span className="rubik-chip border-warning/20 bg-warning/70 px-3 py-1 text-warning-foreground">
              Draft
            </span>
          )}
          {post.category && (
            <span className="rubik-chip rubik-chip-accent px-3 py-1">
              {post.category}
            </span>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground/60">
            <Calendar className="size-3" />
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString([], {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          </div>
        </div>

        <h3 className="mb-6 text-3xl font-semibold leading-[0.95] tracking-[-0.05em] text-foreground transition-colors group-hover:text-primary sm:text-4xl lg:text-5xl">
          {post.title}
        </h3>

        {post.primer && (
          <p className="mb-8 line-clamp-3 text-lg font-medium leading-8 text-muted-foreground">
            {post.primer}
          </p>
        )}

        <div className="rubik-kicker-link mt-auto text-[0.78rem] font-semibold uppercase tracking-[0.16em]">
          Read Full Story
          <ArrowRight className="size-4" />
        </div>
      </div>
    </div>
  );

  return (
    <article className="rubik-panel group relative mb-16 overflow-hidden rounded-[var(--radius-panel-lg)] transition-[border-color,box-shadow,transform] duration-300 hover:border-primary/30 hover:shadow-[var(--panel-shadow-strong)]">
      {LinkComp === "a" ? (
        <a href={`/blog/${post.slug}`} className="block h-full w-full">
          {content}
        </a>
      ) : (
        <LinkComp to={`/blog/${post.slug}`} className="block h-full w-full">
          {content}
        </LinkComp>
      )}
    </article>
  );
}

function BlogCard({
  post,
  LinkComp,
}: {
  post: BlogMeta;
  LinkComp:
    | React.ComponentType<{
        to: string;
        className?: string;
        children: React.ReactNode;
      }>
    | "a";
}) {
  const content = (
    <>
      <CardImage post={post} className="aspect-[16/10]" />
      <div className="flex flex-1 flex-col p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {post.draft && (
            <>
              <span className="text-warning-foreground">Draft</span>
              <span className="opacity-30">&middot;</span>
            </>
          )}
          <Tag className="size-3" />
          <span>{post.category || "General"}</span>
          <span className="opacity-30">&middot;</span>
          <Clock className="size-3" />
          <span>5 min read</span>
        </div>

        <h3 className="mb-4 line-clamp-2 text-xl font-semibold leading-tight tracking-[-0.03em] text-foreground transition-colors group-hover:text-primary">
          {post.title}
        </h3>

        {post.primer && (
          <p className="mb-6 line-clamp-2 text-sm font-medium leading-7 text-muted-foreground">
            {post.primer}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-border/50 pt-6">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <div className="rubik-icon-badge size-6 rounded-full text-[10px] font-semibold text-muted-foreground">
              {post.author?.[0] || "S"}
            </div>
            <span>{post.author || "Spike Team"}</span>
          </div>
          <div className="rubik-icon-badge size-8 rounded-full text-muted-foreground transition-colors duration-300 group-hover:border-primary/30 group-hover:bg-primary group-hover:text-primary-foreground">
            <ArrowRight className="size-4" />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <article className="rubik-panel group relative flex h-full flex-col overflow-hidden transition-[border-color,box-shadow,transform] duration-300 hover:border-primary/24 hover:shadow-[var(--panel-shadow-strong)] hover:-translate-y-0.5">
      {LinkComp === "a" ? (
        <a
          href={`/blog/${post.slug}`}
          className="block h-full w-full flex flex-col flex-1"
        >
          {content}
        </a>
      ) : (
        <LinkComp
          to={`/blog/${post.slug}`}
          className="block h-full w-full flex flex-col flex-1"
        >
          {content}
        </LinkComp>
      )}
    </article>
  );
}

export function BlogListView({
  linkComponent,
  limit,
  showHeader = true,
}: {
  linkComponent?:
    | React.ComponentType<{
        to: string;
        className?: string;
        children: React.ReactNode;
      }>
    | "a"
    | undefined;
  limit?: number | undefined;
  showHeader?: boolean | undefined;
}) {
  const [posts, setPosts] = useState<BlogMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    async function load() {
      while (attempt < 2) {
        try {
          const r = await fetch(apiUrl("/blog"));
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const data = (await r.json()) as unknown;
          if (!Array.isArray(data))
            throw new Error("Unexpected response shape");
          if (cancelled) return;
          const posts = (data as BlogMeta[]).filter((post) => !post.unlisted);
          if (limit) {
            const featured = posts.filter((p) => p.featured);
            const rest = posts.filter((p) => !p.featured);
            setPosts([...featured, ...rest].slice(0, limit));
          } else {
            setPosts(posts);
          }
          setError(false);
          return;
        } catch {
          attempt++;
          if (attempt < 2) await new Promise((r) => setTimeout(r, 1000));
        }
      }
      if (!cancelled) {
        setPosts([]);
        setError(true);
      }
    }

    load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (loading) {
    return (
      <div
        className={cn("rubik-container font-sans", showHeader && "rubik-page")}
      >
        {showHeader && (
          <div className="mx-auto mb-20 max-w-2xl animate-pulse text-center">
            <div className="h-4 bg-muted rounded w-24 mx-auto mb-6" />
            <div className="h-12 bg-muted rounded w-3/4 mx-auto mb-6" />
            <div className="h-6 bg-muted rounded w-1/2 mx-auto" />
          </div>
        )}
        <div
          aria-busy="true"
          className="rubik-panel mb-12 h-[400px] animate-pulse bg-muted/30"
        />
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rubik-panel h-[350px] animate-pulse bg-muted/30"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="rubik-container rubik-page text-center">
        <div className="rubik-panel mx-auto max-w-xl p-8">
          <div className="mb-6 inline-flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Tag size={32} />
          </div>
          <h2 className="mb-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
            Failed to load stories
          </h2>
          <p className="mb-8 text-muted-foreground">
            Our edge network is having trouble reaching the blog database.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-[calc(var(--radius-control)-0.1rem)] bg-foreground px-8 py-3 text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-background transition-colors hover:bg-foreground/92 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary-light"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const LinkComp = linkComponent ?? "a";
  const [featured, ...rest] = posts;

  return (
    <div
      className={cn("rubik-container font-sans", showHeader && "rubik-page")}
    >
      {showHeader && (
        <div className="mx-auto mb-24 max-w-4xl space-y-6 text-center">
          <div className="rubik-eyebrow border-primary/14 bg-primary/10 text-primary">
            <Clock className="size-3" />
            <span>Latest Updates</span>
          </div>
          <h1 className="text-5xl font-semibold leading-[0.85] tracking-[-0.06em] text-foreground sm:text-7xl lg:text-8xl">
            The <span className="text-primary italic">Spike.land</span> Blog
          </h1>
          <p className="mx-auto max-w-2xl text-xl font-medium leading-8 text-muted-foreground sm:text-2xl">
            Deep dives into autonomous agents, edge computing, and the Model
            Context Protocol.
          </p>
        </div>
      )}

      {featured && <FeaturedCard post={featured} LinkComp={LinkComp} />}

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((post) => (
          <BlogCard key={post.slug} post={post} LinkComp={LinkComp} />
        ))}
      </div>
    </div>
  );
}
