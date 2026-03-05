import { Hono } from "hono";
import type { Env } from "../env.js";
import { getClientId, sendGA4Events } from "../lib/ga4.js";
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
  hero_image: string | null;
  content: string;
  created_at: number;
  updated_at: number;
}

function rowToPost(row: BlogPostRow, includeContent = false) {
  const post: Record<string, unknown> = {
    slug: row.slug,
    title: row.title,
    description: row.description,
    primer: row.primer,
    date: row.date,
    author: row.author,
    category: row.category,
    tags: JSON.parse(row.tags),
    featured: Boolean(row.featured),
    heroImage: row.hero_image,
  };
  if (includeContent) {
    post.content = row.content;
  }
  return post;
}

blog.get("/api/blog", async (c) => {
  let cached: Response | null = null;
  try {
    cached = await withEdgeCache(c.req.raw, safeCtx(c), async () => {
      const result = await c.env.DB.prepare(
        `SELECT slug, title, description, primer, date, author, category, tags, featured, hero_image
         FROM blog_posts ORDER BY date DESC`,
      ).all<BlogPostRow>();

      if (!result.results?.length) return null;

      const posts = result.results.map((row) => rowToPost(row));
      return new Response(JSON.stringify(posts), {
        headers: { "Content-Type": "application/json" },
      });
    }, { ttl: 300, swr: 3600 });
  } catch {
    // Cache API unavailable — fall back to direct D1
    const result = await c.env.DB.prepare(
      `SELECT slug, title, description, primer, date, author, category, tags, featured, hero_image
       FROM blog_posts ORDER BY date DESC`,
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
        sendGA4Events(c.env, clientId, [{
          name: "blog_index",
          params: { page_path: "/api/blog" },
        }])
      ),
    );
  } catch { /* no ExecutionContext in some environments */ }

  return cached;
});

blog.get("/api/blog/:slug", async (c) => {
  const slug = c.req.param("slug");

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
    }, { ttl: 300, swr: 3600 });
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
      getClientId(c.req.raw).then((clientId) =>
        sendGA4Events(c.env, clientId, [{
          name: "blog_view",
          params: { page_path: `/api/blog/${slug}`, slug },
        }])
      ),
    );
  } catch { /* no ExecutionContext in some environments */ }

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
