import { Hono } from "hono";
import type { Env } from "../env.js";
import { safeCtx, withEdgeCache } from "../lib/edge-cache.js";

const sitemap = new Hono<{ Bindings: Env }>();

const STATIC_ROUTES = [
  "/",
  "/tools",
  "/store",
  "/apps",
  "/pricing",
  "/about",
  "/blog",
  "/learn",
  "/privacy",
  "/terms",
  "/login",
  "/docs",
  "/bugbook",
  "/version",
];

function buildSitemapXml(
  staticRoutes: string[],
  blogPosts: Array<{ slug: string; date: string }>,
): string {
  const now = new Date().toISOString().split("T")[0];

  const staticEntries = staticRoutes.map(
    (route) =>
      `  <url>\n    <loc>https://spike.land${route}</loc>\n    <lastmod>${now}</lastmod>\n  </url>`,
  );

  const blogEntries = blogPosts.map(
    (post) =>
      `  <url>\n    <loc>https://spike.land/blog/${post.slug}</loc>\n    <lastmod>${post.date}</lastmod>\n  </url>`,
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...staticEntries,
    ...blogEntries,
    `</urlset>`,
  ].join("\n");
}

sitemap.get("/sitemap.xml", async (c) => {
  let response: Response | null = null;

  try {
    response = await withEdgeCache(c.req.raw, safeCtx(c), async () => {
      const result = await c.env.DB.prepare(
        "SELECT slug, date FROM blog_posts ORDER BY date DESC",
      ).all<{ slug: string; date: string }>();

      const posts = result.results ?? [];
      const xml = buildSitemapXml(STATIC_ROUTES, posts);

      return new Response(xml, {
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      });
    }, { ttl: 3600, swr: 86400 });
  } catch {
    // Cache API unavailable — fall back to direct D1
    try {
      const result = await c.env.DB.prepare(
        "SELECT slug, date FROM blog_posts ORDER BY date DESC",
      ).all<{ slug: string; date: string }>();

      const posts = result.results ?? [];
      const xml = buildSitemapXml(STATIC_ROUTES, posts);

      response = new Response(xml, {
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      });
    } catch {
      // D1 query failed, response remains null
    }
  }

  if (!response) {
    // Fallback if everything failed
    const xml = buildSitemapXml(STATIC_ROUTES, []);
    return c.body(xml, 200, { "Content-Type": "application/xml; charset=utf-8" });
  }

  return response;
});

sitemap.get("/robots.txt", (c) => {
  const body = [
    "User-agent: *",
    "Allow: /",
    "Sitemap: https://spike.land/sitemap.xml",
    "",
  ].join("\n");

  return c.text(body, 200, {
    "Cache-Control": "public, max-age=86400",
  });
});

export { sitemap };
