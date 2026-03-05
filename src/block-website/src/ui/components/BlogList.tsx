import { useState, useEffect } from "react";
import type { BlogPost } from "../../core/types";
import { Calendar, User, Tag, ArrowRight, Clock, BookOpen } from "lucide-react";
import { cn } from "@/shared/utils/cn";

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

function CardImage({ post, className = "" }: { post: BlogMeta; className?: string }) {
  if (post.heroImage) {
    return (
      <div className={cn("overflow-hidden relative group", className)}>
        <img
          src={post.heroImage}
          alt={post.title}
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
    <div className={cn("bg-gradient-to-br flex flex-col items-center justify-center p-8 text-center relative overflow-hidden", gradientClass, className)}>
      <div className="absolute -right-4 -bottom-4 opacity-5 rotate-12">
        <BookOpen size={120} />
      </div>
      <span className="text-2xl sm:text-3xl font-black tracking-tight leading-[1.1] relative z-10">
        {post.title}
      </span>
    </div>
  );
}

function FeaturedCard({ post, LinkComp }: { post: BlogMeta; LinkComp: React.ComponentType<{ to: string; className?: string; children: React.ReactNode }> | "a" }) {
  const content = (
    <div className="flex flex-col lg:flex-row h-full">
      <CardImage post={post} className="lg:w-3/5 lg:h-full aspect-[16/9] lg:aspect-auto" />
      <div className="p-8 lg:p-12 lg:w-2/5 flex flex-col justify-center bg-card">
        <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] mb-6">
          {post.category && (
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/10">
              {post.category}
            </span>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground/60">
            <Calendar className="size-3" />
            <time dateTime={post.date}>{new Date(post.date).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</time>
          </div>
        </div>
        
        <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-[0.95] text-foreground mb-6 group-hover:text-primary transition-colors tracking-tighter">
          {post.title}
        </h3>
        
        {post.primer && (
          <p className="text-lg text-muted-foreground leading-relaxed mb-8 line-clamp-3 font-medium">
            {post.primer}
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 text-sm font-black text-primary uppercase tracking-widest group-hover:gap-4 transition-all">
          Read Full Story
          <ArrowRight className="size-4" />
        </div>
      </div>
    </div>
  );

  return (
    <article className="group relative bg-card rounded-[2.5rem] border border-border/50 shadow-2xl hover:border-primary/30 transition-all duration-500 overflow-hidden mb-16 ring-1 ring-border/5">
      {LinkComp === "a" ? (
        <a href={`/blog/${post.slug}`} className="block h-full w-full">{content}</a>
      ) : (
        <LinkComp to={`/blog/${post.slug}`} className="block h-full w-full">{content}</LinkComp>
      )}
    </article>
  );
}

function BlogCard({ post, LinkComp }: { post: BlogMeta; LinkComp: React.ComponentType<{ to: string; className?: string; children: React.ReactNode }> | "a" }) {
  const content = (
    <>
      <CardImage post={post} className="aspect-[16/10]" />
      <div className="p-6 sm:p-8 flex flex-col flex-1">
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">
          <Tag className="size-3" />
          <span>{post.category || "General"}</span>
          <span className="opacity-30">&middot;</span>
          <Clock className="size-3" />
          <span>5 min read</span>
        </div>
        
        <h3 className="text-xl font-black leading-tight text-foreground group-hover:text-primary transition-colors mb-4 line-clamp-2 tracking-tight">
          {post.title}
        </h3>
        
        {post.primer && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-6 line-clamp-2 font-medium opacity-80">
            {post.primer}
          </p>
        )}

        <div className="mt-auto pt-6 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground/70">
            <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground">
              {post.author?.[0] || "S"}
            </div>
            <span>{post.author || "Spike Team"}</span>
          </div>
          <div className="size-8 rounded-full bg-muted group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center transition-all duration-300">
            <ArrowRight className="size-4" />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <article className="group relative bg-card rounded-[2rem] border border-border/50 shadow-sm hover:border-primary/20 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 overflow-hidden flex flex-col">
      {LinkComp === "a" ? (
        <a href={`/blog/${post.slug}`} className="block h-full w-full flex flex-col flex-1">{content}</a>
      ) : (
        <LinkComp to={`/blog/${post.slug}`} className="block h-full w-full flex flex-col flex-1">{content}</LinkComp>
      )}
    </article>
  );
}

export function BlogListView({ linkComponent, limit, showHeader = true }: { linkComponent?: React.ComponentType<{ to: string; className?: string; children: React.ReactNode }> | "a"; limit?: number; showHeader?: boolean }) {
  const [posts, setPosts] = useState<BlogMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
      .catch(() => { setPosts([]); setError(true); })
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading) {
    return (
      <div className={cn("max-w-7xl mx-auto px-6 font-sans", showHeader && "py-20")}>
        {showHeader && (
          <div className="text-center max-w-2xl mx-auto mb-20 animate-pulse">
            <div className="h-4 bg-muted rounded w-24 mx-auto mb-6" />
            <div className="h-12 bg-muted rounded w-3/4 mx-auto mb-6" />
            <div className="h-6 bg-muted rounded w-1/2 mx-auto" />
          </div>
        )}
        <div aria-busy="true" className="animate-pulse bg-muted/30 rounded-[2.5rem] h-[400px] mb-12" />
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-muted/30 rounded-[2rem] h-[350px]" />
          ))}
        </div>
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="max-w-7xl mx-auto py-20 px-6 text-center">
        <div className="inline-flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-6">
          <Tag size={32} />
        </div>
        <h2 className="text-2xl font-black tracking-tight mb-2">Failed to load stories</h2>
        <p className="text-muted-foreground mb-8">Our edge network is having trouble reaching the blog database.</p>
        <button onClick={() => window.location.reload()} className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:shadow-lg transition-all">
          Try again
        </button>
      </div>
    );
  }

  const LinkComp = linkComponent ?? "a";
  const [featured, ...rest] = posts;

  return (
    <div className={cn("max-w-7xl mx-auto px-6 font-sans", showHeader && "py-20")}>
      {showHeader && (
        <div className="text-center max-w-4xl mx-auto mb-24 space-y-6">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-primary/10">
            <Clock className="size-3" />
            <span>Latest Updates</span>
          </div>
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black text-foreground tracking-tighter leading-[0.85]">
            The <span className="text-primary italic">Spike.land</span> Blog
          </h1>
          <p className="text-xl sm:text-2xl text-muted-foreground font-medium leading-relaxed max-w-2xl mx-auto">
            Deep dives into autonomous agents, edge computing, and the Model Context Protocol.
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
