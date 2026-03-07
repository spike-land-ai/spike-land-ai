import { Hono } from "hono";
import type { Env } from "../../core-logic/env.js";
import { getClientId, sendGA4Events } from "../../lazy-imports/ga4.js";
import { safeCtx, withEdgeCache } from "../lib/edge-cache.js";

const blog = new Hono<{ Bindings: Env }>();

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
    cached = await withEdgeCache(c.req.raw, safeCtx(c), async () => {
      const result = await c.env.DB.prepare(
        `SELECT slug, title, description, primer, date, author, category, tags, featured, draft, hero_image
         FROM blog_posts${draftFilter} ORDER BY date DESC`,
      ).all<BlogPostRow>();

        if (!result.results?.length) return null;

      const posts = result.results.map((row) => rowToPost(row));
      return new Response(JSON.stringify(posts), {
        headers: { "Content-Type": "application/json" },
      });
    }, { ttl: showDrafts ? 0 : 300, swr: showDrafts ? 0 : 3600 });
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
  const slug = c.req.param("slug");
  const showDrafts = isLocalDev(c);

  let cached: Response | null = null;
  try {
    cached = await withEdgeCache(c.req.raw, safeCtx(c), async () => {
      const row = await c.env.DB.prepare(
        `SELECT * FROM blog_posts WHERE slug = ?`,
      ).bind(slug).first<BlogPostRow>();

        if (!row) return null;

      return new Response(JSON.stringify(rowToPost(row, true)), {
        headers: { "Content-Type": "application/json" },
      });
    }, { ttl: showDrafts ? 0 : 300, swr: showDrafts ? 0 : 3600 });
  } catch {
    // Cache API unavailable — fall back to direct D1
    const row = await c.env.DB.prepare(
      `SELECT * FROM blog_posts WHERE slug = ?`,
    ).bind(slug).first<BlogPostRow>();

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

blog.get("/api/blog-images/:slug/:filename", async (c) => {
  const { slug, filename } = c.req.param();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  const obj = await c.env.SPA_ASSETS.get(`blog-images/${slug}/${filename}`);
  if (!obj) return c.notFound();

  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  return new Response(obj.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

// Backward-compatible: serve /blog/{slug}/{filename} for inline MDX images
blog.get("/blog/:slug/:filename", async (c, next) => {
  const { slug, filename } = c.req.param();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (!IMAGE_EXTS.has(ext)) return next();

  const obj = await c.env.SPA_ASSETS.get(`blog-images/${slug}/${filename}`);
  if (!obj) return next();

  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  return new Response(obj.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

/** Fetch a single blog post row from D1 (no caching, for SSR injection). */
async function getBlogPostRow(db: D1Database, slug: string): Promise<BlogPostRow | null> {
  return db.prepare("SELECT * FROM blog_posts WHERE slug = ?").bind(slug).first<BlogPostRow>();
}

export { blog, rowToPost, getBlogPostRow };
export type { BlogPostRow };
