import { useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BlogPostView } from "@spike-land-ai/block-website/ui";
import type { BlogPost } from "@spike-land-ai/block-website/core";
import { extractHeroMedia } from "../../../../../core/block-website/core-logic/blog-source.js";
import { apiUrl } from "../../../core-logic/api";
import { trackAnalyticsEvent } from "../../hooks/useAnalytics";

const SITE_URL = "https://spike.land";
const localBlogModules = import.meta.env.DEV
  ? (import.meta.glob("../../../../../../content/blog/*.mdx", {
      query: "?raw",
      import: "default",
    }) as Record<string, () => Promise<string>>)
  : {};

function injectJsonLd(id: string, content: string) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = content;
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}

function getFrontmatterValue(frontmatter: string, key: string): string | null {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim() ?? null;
}

function parseTagsValue(raw: string | null): string[] {
  if (!raw?.startsWith("[") || !raw.endsWith("]")) return [];

  const inner = raw.slice(1, -1).trim();
  if (!inner) return [];

  return inner
    .split(",")
    .map((tag) => stripQuotes(tag.trim()))
    .filter(Boolean);
}

function parseLocalBlogPost(rawContent: string, requestedSlug: string): BlogPost | null {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match?.[1]) return null;

  const frontmatter = match[1];
  const title = stripQuotes(getFrontmatterValue(frontmatter, "title") ?? "");
  if (!title) return null;

  const frontmatterHeroImage = stripQuotes(getFrontmatterValue(frontmatter, "heroImage") ?? "");
  const frontmatterHeroPrompt = stripQuotes(getFrontmatterValue(frontmatter, "heroPrompt") ?? "");
  const { heroImage, heroPrompt, body } = extractHeroMedia(
    rawContent.slice(match[0].length),
    frontmatterHeroImage || null,
    frontmatterHeroPrompt || null,
  );

  return {
    slug: stripQuotes(getFrontmatterValue(frontmatter, "slug") ?? requestedSlug),
    title,
    description: stripQuotes(getFrontmatterValue(frontmatter, "description") ?? ""),
    primer: stripQuotes(getFrontmatterValue(frontmatter, "primer") ?? ""),
    date: stripQuotes(getFrontmatterValue(frontmatter, "date") ?? ""),
    author: stripQuotes(getFrontmatterValue(frontmatter, "author") ?? ""),
    category: stripQuotes(getFrontmatterValue(frontmatter, "category") ?? ""),
    tags: parseTagsValue(getFrontmatterValue(frontmatter, "tags")),
    featured: getFrontmatterValue(frontmatter, "featured") === "true",
    draft: getFrontmatterValue(frontmatter, "draft") === "true",
    unlisted: getFrontmatterValue(frontmatter, "unlisted") === "true",
    heroImage,
    heroPrompt,
    content: body,
  };
}

function findLocalBlogLoader(slug: string) {
  const normalizedSlug = slug.replace(/\.mdx$/i, "");

  for (const [path, loader] of Object.entries(localBlogModules)) {
    if (path.endsWith(`/${normalizedSlug}.mdx`)) {
      return loader;
    }
  }

  return null;
}

interface BlogMeta {
  slug: string;
  title: string;
  unlisted?: boolean;
}

interface SiblingPosts {
  prev: BlogMeta | null;
  next: BlogMeta | null;
}

function useSiblingPosts(currentSlug: string): SiblingPosts {
  const [siblings, setSiblings] = useState<SiblingPosts>({ prev: null, next: null });

  useEffect(() => {
    if (!currentSlug) return;

    fetch(apiUrl("/blog"))
      .then((r) => (r.ok ? (r.json() as Promise<BlogMeta[]>) : Promise.reject()))
      .then((posts) => {
        const visible = posts.filter((p) => !p.unlisted);
        const idx = visible.findIndex((p) => p.slug === currentSlug);
        if (idx === -1) return;
        setSiblings({
          prev: idx > 0 ? (visible[idx - 1] ?? null) : null,
          next: idx < visible.length - 1 ? (visible[idx + 1] ?? null) : null,
        });
      })
      .catch(() => {});
  }, [currentSlug]);

  return siblings;
}

function PostBreadcrumb({ postTitle }: { postTitle: string | null }) {
  return (
    <nav className="rubik-container pt-6 pb-2" aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--muted-fg)]">
        <li>
          <Link to="/" className="transition-colors hover:text-[var(--fg)]">
            Home
          </Link>
        </li>
        <li aria-hidden="true" className="opacity-40 select-none">
          /
        </li>
        <li>
          <Link to="/blog" className="transition-colors hover:text-[var(--fg)]">
            Blog
          </Link>
        </li>
        {postTitle && (
          <>
            <li aria-hidden="true" className="opacity-40 select-none">
              /
            </li>
            <li>
              <span
                className="text-[var(--fg)] font-medium line-clamp-1 max-w-[22rem]"
                title={postTitle}
              >
                {postTitle}
              </span>
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}

function PostNavigation({ siblings }: { siblings: SiblingPosts }) {
  const { prev, next } = siblings;
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Post navigation"
      className="rubik-container border-t border-[var(--border-color)] py-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
        {prev ? (
          <Link
            to="/blog/$slug"
            params={{ slug: prev.slug }}
            className="group flex flex-col gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-5 py-4 transition-colors hover:border-[var(--primary-color)] hover:bg-[var(--accent-bg)] sm:max-w-[48%]"
          >
            <span className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--muted-fg)]">
              ← Previous
            </span>
            <span className="line-clamp-2 text-sm font-semibold text-[var(--fg)] transition-colors group-hover:text-[var(--primary-color)]">
              {prev.title}
            </span>
          </Link>
        ) : (
          <div />
        )}

        {next ? (
          <Link
            to="/blog/$slug"
            params={{ slug: next.slug }}
            className="group flex flex-col gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-5 py-4 text-right transition-colors hover:border-[var(--primary-color)] hover:bg-[var(--accent-bg)] sm:max-w-[48%]"
          >
            <span className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--muted-fg)]">
              Next →
            </span>
            <span className="line-clamp-2 text-sm font-semibold text-[var(--fg)] transition-colors group-hover:text-[var(--primary-color)]">
              {next.title}
            </span>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </nav>
  );
}

export function BlogPostPage() {
  const { slug } = useParams({ strict: false });
  const normalizedSlug = (slug ?? "").replace(/\.mdx$/i, "");
  const [postTitle, setPostTitle] = useState<string | null>(null);
  const [localPost, setLocalPost] = useState<BlogPost | null>(null);
  const [localLookupDone, setLocalLookupDone] = useState(!import.meta.env.DEV);
  const siblings = useSiblingPosts(normalizedSlug);

  useEffect(() => {
    let cancelled = false;

    if (!import.meta.env.DEV || !normalizedSlug) {
      setLocalPost(null);
      setLocalLookupDone(true);
      return;
    }

    setLocalLookupDone(false);
    const loader = findLocalBlogLoader(normalizedSlug);

    if (!loader) {
      setLocalPost(null);
      setLocalLookupDone(true);
      return;
    }

    loader()
      .then((rawSource) => {
        if (cancelled) return;
        setLocalPost(parseLocalBlogPost(rawSource, normalizedSlug));
        setLocalLookupDone(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLocalPost(null);
        setLocalLookupDone(true);
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedSlug]);

  useEffect(() => {
    if (!normalizedSlug) return;

    if (localPost) {
      setPostTitle(localPost.title);
      return;
    }

    if (!localLookupDone) return;

    fetch(apiUrl(`/blog/${normalizedSlug}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { title?: string } | null) => {
        setPostTitle(data?.title ?? null);
      })
      .catch(() => {});
  }, [localLookupDone, localPost, normalizedSlug]);

  // Track blog post view once we have a resolved title (or fall back to slug)
  useEffect(() => {
    if (!normalizedSlug) return;
    trackAnalyticsEvent("blog_view", {
      slug: normalizedSlug,
      title: postTitle ?? normalizedSlug,
    });
  }, [normalizedSlug, postTitle]);

  useEffect(() => {
    if (!normalizedSlug) return;

    const name =
      postTitle ??
      normalizedSlug.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

    injectJsonLd(
      "jsonld-breadcrumbs",
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 3, name, item: `${SITE_URL}/blog/${normalizedSlug}` },
        ],
      }),
    );
  }, [normalizedSlug, postTitle]);

  return (
    <div className="min-h-screen font-sans antialiased">
      <PostBreadcrumb postTitle={postTitle} />
      <main>
        <BlogPostView
          slug={normalizedSlug}
          linkComponent={Link}
          postOverride={localPost}
          skipFetch={import.meta.env.DEV && (!localLookupDone || Boolean(localPost))}
          loadingOverride={import.meta.env.DEV && !localLookupDone}
        />
      </main>
      <PostNavigation siblings={siblings} />
    </div>
  );
}
