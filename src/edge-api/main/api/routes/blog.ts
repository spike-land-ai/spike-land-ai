import { Hono } from "hono";
import type { Env } from "../../core-logic/env.js";
import { getClientId, sendGA4Events } from "../../lazy-imports/ga4.js";
import { safeCtx, withEdgeCache } from "../lib/edge-cache.js";

const blog = new Hono<{ Bindings: Env }>();
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/spike-land-ai/spike-land-ai/main";
const BLOG_SLUG_RE = /^[a-z0-9-]+$/i;

interface BlogPostRow {
  slug: string;
  title: string;
  description: string;
  primer: string;
  date: string;
  author: string;
  category: string;
  tags: string;
  featured: number;
  draft: number;
  hero_image: string | null;
  content: string;
  created_at: number;
  updated_at: number;
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
        body = body.replace(line + "\n", "").replace(line, "").trim();
        break;
      }
    }
    return { heroImage, body };
  }

  const escapedHero = heroImage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  body = body.replace(new RegExp(`^!\\[.*?\\]\\(${escapedHero}\\)\\n?`, "m"), "").trim();
  return { heroImage, body };
}

function sourceToRow(rawContent: string, requestedSlug: string): BlogPostRow | null {
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
    tags: JSON.stringify(parseTagsValue(getFrontmatterValue(frontmatter, "tags"))),
    featured: getFrontmatterValue(frontmatter, "featured") === "true" ? 1 : 0,
    draft: getFrontmatterValue(frontmatter, "draft") === "true" ? 1 : 0,
    hero_image: heroImage,
    content: body,
    created_at: 0,
    updated_at: 0,
  };
}

async function fetchBlogPostSource(slug: string): Promise<BlogPostRow | null> {
  if (!BLOG_SLUG_RE.test(slug)) return null;

  try {
    const response = await fetch(`${GITHUB_RAW_BASE}/content/blog/${slug}.mdx`, {
      headers: { "User-Agent": "spike-edge/1.0" },
      cf: { cacheTtl: 300, cacheEverything: true },
    });

    if (!response.ok) return null;

    return sourceToRow(await response.text(), slug);
  } catch {
    return null;
  }
}

function rowToPost(row: BlogPostRow, includeContent = false) {
  let tags: unknown = [];
  try {
    tags = JSON.parse(row.tags);
  } catch {
    /* default to empty */
  }

  const post: Record<string, unknown> = {
    slug: row.slug,
    title: row.title,
    description: row.description,
    primer: row.primer,
    date: row.date,
    author: row.author,
    category: row.category,
    tags,
    featured: Boolean(row.featured),
    draft: Boolean(row.draft),
    heroImage: row.hero_image,
  };
  if (includeContent) {
    post.content = row.content;
  }
  return post;
}

function isLocalDev(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const origin = c.req.header("origin") ?? "";
  const referer = c.req.header("referer") ?? "";
  return origin.includes("local.spike.land") || referer.includes("local.spike.land");
}

// /api/blog/posts is a common alias — redirect before :slug catches "posts"
blog.get("/api/blog/posts", (c) => c.redirect("/api/blog", 301));

blog.get("/api/blog", async (c) => {
  const showDrafts = isLocalDev(c);
  const draftFilter = showDrafts ? "" : " WHERE draft = 0";

  let cached: Response | null = null;
  try {
    cached = await withEdgeCache(
      c.req.raw,
      safeCtx(c),
      async () => {
        const result = await c.env.DB.prepare(
          `SELECT slug, title, description, primer, date, author, category, tags, featured, draft, hero_image
         FROM blog_posts${draftFilter} ORDER BY date DESC`,
        ).all<BlogPostRow>();

        if (!result.results?.length) return null;

        const posts = result.results.map((row) => rowToPost(row));
        return new Response(JSON.stringify(posts), {
          headers: { "Content-Type": "application/json" },
        });
      },
      { ttl: showDrafts ? 0 : 300, swr: showDrafts ? 0 : 3600 },
    );
  } catch {
    // Cache API unavailable — fall back to direct D1
    const result = await c.env.DB.prepare(
      `SELECT slug, title, description, primer, date, author, category, tags, featured, draft, hero_image
       FROM blog_posts${draftFilter} ORDER BY date DESC`,
    ).all<BlogPostRow>();

    if (result.results?.length) {
      const posts = result.results.map((row) => rowToPost(row));
      cached = new Response(JSON.stringify(posts), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (!cached) return c.json({ error: "Blog index not found" }, 404);

  try {
    c.executionCtx.waitUntil(
      getClientId(c.req.raw).then((clientId) =>
        sendGA4Events(c.env, clientId, [
          {
            name: "blog_index",
            params: { page_path: "/api/blog" },
          },
        ]),
      ),
    );
  } catch {
    /* no ExecutionContext in some environments */
  }

  return cached;
});

blog.get("/api/blog/:slug", async (c) => {
  // Normalise: strip accidental .mdx suffix so old links still resolve
  const slug = c.req.param("slug").replace(/\.mdx$/i, "");
  const showDrafts = isLocalDev(c);

  let cached: Response | null = null;
  try {
    cached = await withEdgeCache(
      c.req.raw,
      safeCtx(c),
      async () => {
        const row = await getBlogPostRow(c.env.DB, slug);

        if (!row) return null;

        return new Response(JSON.stringify(rowToPost(row, true)), {
          headers: { "Content-Type": "application/json" },
        });
      },
      { ttl: showDrafts ? 0 : 300, swr: showDrafts ? 0 : 3600 },
    );
  } catch {
    // Cache API unavailable — fall back to direct D1
    const row = await getBlogPostRow(c.env.DB, slug);

    if (row) {
      cached = new Response(JSON.stringify(rowToPost(row, true)), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (!cached) return c.json({ error: "Post not found" }, 404);

  try {
    c.executionCtx.waitUntil(
      getClientId(c.req.raw).then((clientId) => {
        const ga4Promise = sendGA4Events(c.env, clientId, [
          {
            name: "blog_view",
            params: { page_path: `/api/blog/${slug}`, slug },
          },
        ]);

        const dbPromise = c.env.DB.prepare(
          "INSERT INTO analytics_events (source, event_type, metadata, client_id) VALUES (?, ?, ?, ?)",
        )
          .bind("platform-frontend", "blog_view", JSON.stringify({ slug }), clientId)
          .run();

        return Promise.all([ga4Promise, dbPromise]);
      }),
    );
  } catch {
    /* no ExecutionContext in some environments */
  }

  return cached;
});

// Serve blog images from R2 (supports both /api/blog-images/... and /blog/slug/file.ext paths)
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"]);

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
};

async function serveBlogImage(
  spaAssets: R2Bucket,
  slug: string,
  filename: string,
): Promise<Response | null> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const key = `blog-images/${slug}/${filename}`;

  const obj = await spaAssets.get(key);
  if (obj) {
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
    return new Response(obj.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  // Fallback to production for local dev (R2 bucket is empty locally)
  const prodUrl = `https://spike.land/api/blog-images/${slug}/${filename}`;
  const upstream = await fetch(prodUrl);
  if (upstream.ok) {
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  return null;
}

blog.get("/api/blog-images/:slug/:filename", async (c) => {
  const { slug, filename } = c.req.param();
  const resp = await serveBlogImage(c.env.SPA_ASSETS, slug, filename);
  return resp ?? c.notFound();
});

// Backward-compatible: serve /blog/{slug}/{filename} for inline MDX images
blog.get("/blog/:slug/:filename", async (c, next) => {
  const { slug, filename } = c.req.param();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (!IMAGE_EXTS.has(ext)) return next();

  const resp = await serveBlogImage(c.env.SPA_ASSETS, slug, filename);
  return resp ?? next();
});

/** Fetch a single blog post row from D1 (no caching, for SSR injection). */
async function getBlogPostRow(db: D1Database, slug: string): Promise<BlogPostRow | null> {
  const normalizedSlug = slug.replace(/\.mdx$/i, "");

  try {
    const row = await db
      .prepare("SELECT * FROM blog_posts WHERE slug = ?")
      .bind(normalizedSlug)
      .first<BlogPostRow>();

    if (row) return row;
  } catch {
    // Fall through to the canonical MDX source when D1 is unavailable or stale.
  }

  return fetchBlogPostSource(normalizedSlug);
}

// RSS 2.0 feed endpoint
blog.get("/blog/rss", async (c) => {
  let response: Response | null = null;

  const buildRssXml = (posts: BlogPostRow[]): string => {
    const items = posts.map((post) => {
      const pubDate = new Date(post.date).toUTCString();
      const link = `https://spike.land/blog/${post.slug}`;
      return [
        "    <item>",
        `      <title><![CDATA[${post.title}]]></title>`,
        `      <link>${link}</link>`,
        `      <description><![CDATA[${post.description}]]></description>`,
        `      <pubDate>${pubDate}</pubDate>`,
        `      <author>${post.author}</author>`,
        `      <guid isPermaLink="true">${link}</guid>`,
        `      <category>${post.category}</category>`,
        "    </item>",
      ].join("\n");
    });

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      "  <channel>",
      "    <title>spike.land Blog</title>",
      "    <link>https://spike.land/blog</link>",
      "    <description>Articles, tutorials, and engineering insights from the spike.land team about AI, MCP, and edge computing.</description>",
      "    <language>en</language>",
      '    <atom:link href="https://spike.land/blog/rss" rel="self" type="application/rss+xml" />',
      ...items,
      "  </channel>",
      "</rss>",
    ].join("\n");
  };

  try {
    response = await withEdgeCache(
      c.req.raw,
      safeCtx(c),
      async () => {
        const result = await c.env.DB.prepare(
          "SELECT * FROM blog_posts WHERE draft = 0 ORDER BY date DESC LIMIT 50",
        ).all<BlogPostRow>();

        const posts = result.results ?? [];
        const xml = buildRssXml(posts);

        return new Response(xml, {
          headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
        });
      },
      { ttl: 3600, swr: 86400 },
    );
  } catch {
    try {
      const result = await c.env.DB.prepare(
        "SELECT * FROM blog_posts WHERE draft = 0 ORDER BY date DESC LIMIT 50",
      ).all<BlogPostRow>();

      const posts = result.results ?? [];
      const xml = buildRssXml(posts);

      response = new Response(xml, {
        headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
      });
    } catch {
      // D1 unavailable
    }
  }

  if (!response) {
    const xml = buildRssXml([]);
    return c.body(xml, 200, { "Content-Type": "application/rss+xml; charset=utf-8" });
  }

  return response;
});

export { blog, rowToPost, getBlogPostRow };
export type { BlogPostRow };
