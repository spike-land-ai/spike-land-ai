import { useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BlogPostView } from "@spike-land-ai/block-website/ui";
import type { BlogPost } from "@spike-land-ai/block-website/core";
import { apiUrl } from "../../../core-logic/api";

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

function extractHeroImage(content: string, frontmatterHeroImage: string | null) {
  let heroImage = frontmatterHeroImage;
  let body = content.trim();

  if (!heroImage) {
    const lines = body.split("\n").slice(0, 5);
    for (const line of lines) {
      const match = line.match(/^!\[.*?\]\((\/blog\/[^)]+)\)$/);
      if (match?.[1] && !line.includes("placehold.co")) {
        heroImage = match[1];
        body = body.replace(`${line}\n`, "").replace(line, "").trim();
        break;
      }
    }
    return { heroImage, body };
  }

  const escapedHero = heroImage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  body = body.replace(new RegExp(`^!\\[.*?\\]\\(${escapedHero}\\)\\n?`, "m"), "").trim();
  return { heroImage, body };
}

function parseLocalBlogPost(rawContent: string, requestedSlug: string): BlogPost | null {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match?.[1]) return null;

  const frontmatter = match[1];
  const title = stripQuotes(getFrontmatterValue(frontmatter, "title") ?? "");
  if (!title) return null;

  const frontmatterHeroImage = stripQuotes(getFrontmatterValue(frontmatter, "heroImage") ?? "");
  const { heroImage, body } = extractHeroImage(
    rawContent.slice(match[0].length),
    frontmatterHeroImage || null,
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
    heroImage,
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

export function BlogPostPage() {
  const { slug } = useParams({ strict: false });
  const normalizedSlug = (slug ?? "").replace(/\.mdx$/i, "");
  const [postTitle, setPostTitle] = useState<string | null>(null);
  const [localPost, setLocalPost] = useState<BlogPost | null>(null);
  const [localLookupDone, setLocalLookupDone] = useState(!import.meta.env.DEV);

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
    <BlogPostView
      slug={normalizedSlug}
      linkComponent={Link}
      postOverride={localPost}
      skipFetch={import.meta.env.DEV && (!localLookupDone || Boolean(localPost))}
      loadingOverride={import.meta.env.DEV && !localLookupDone}
    />
  );
}
