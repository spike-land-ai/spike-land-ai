import { Hono } from "hono";
import type { Env } from "../../core-logic/env.js";
import { safeCtx, withEdgeCache } from "../lib/edge-cache.js";

const sitemap = new Hono<{ Bindings: Env }>();

interface SitemapRoute {
  path: string;
  changefreq: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
}

const STATIC_ROUTES: SitemapRoute[] = [
  { path: "/", changefreq: "daily", priority: 1.0 },
  { path: "/tools", changefreq: "weekly", priority: 0.9 },
  { path: "/store", changefreq: "weekly", priority: 0.9 },
  { path: "/apps", changefreq: "weekly", priority: 0.9 },
  { path: "/mcp", changefreq: "weekly", priority: 0.9 },
  { path: "/pricing", changefreq: "monthly", priority: 0.8 },
  { path: "/about", changefreq: "monthly", priority: 0.7 },
  { path: "/blog", changefreq: "weekly", priority: 0.8 },
  { path: "/learn", changefreq: "weekly", priority: 0.7 },
  { path: "/docs", changefreq: "weekly", priority: 0.8 },
  { path: "/bugbook", changefreq: "weekly", priority: 0.6 },
  { path: "/security", changefreq: "monthly", priority: 0.4 },
  { path: "/what-we-do", changefreq: "monthly", priority: 0.7 },
  { path: "/vibe-code", changefreq: "weekly", priority: 0.8 },
  { path: "/build", changefreq: "weekly", priority: 0.7 },
  { path: "/analytics", changefreq: "weekly", priority: 0.5 },
  { path: "/version", changefreq: "monthly", priority: 0.3 },
  { path: "/privacy", changefreq: "monthly", priority: 0.3 },
  { path: "/terms", changefreq: "monthly", priority: 0.3 },
];

function buildSitemapXml(
  staticRoutes: SitemapRoute[],
  blogPosts: Array<{ slug: string; date: string }>,
): string {
  const now = new Date().toISOString().split("T")[0];

  const staticEntries = staticRoutes.map(
    (route) =>
      `  <url>\n    <loc>https://spike.land${route.path}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${route.changefreq}</changefreq>\n    <priority>${route.priority.toFixed(1)}</priority>\n  </url>`,
  );

  const blogEntries = blogPosts.map(
    (post) =>
      `  <url>\n    <loc>https://spike.land/blog/${post.slug}</loc>\n    <lastmod>${post.date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
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
    response = await withEdgeCache(
      c.req.raw,
      safeCtx(c),
      async () => {
        const result = await c.env.DB.prepare(
          "SELECT slug, date FROM blog_posts WHERE draft = 0 AND unlisted = 0 ORDER BY date DESC",
        ).all<{ slug: string; date: string }>();

        const posts = result.results ?? [];
        const xml = buildSitemapXml(STATIC_ROUTES, posts);

        return new Response(xml, {
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        });
      },
      { ttl: 3600, swr: 86400 },
    );
  } catch {
    // Cache API unavailable — fall back to direct D1
    try {
      const result = await c.env.DB.prepare(
        "SELECT slug, date FROM blog_posts WHERE draft = 0 AND unlisted = 0 ORDER BY date DESC",
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
    "User-agent: Googlebot",
    "Allow: /",
    "",
    "User-agent: *",
    "Allow: /",
    "Disallow: /callback",
    "Disallow: /cockpit",
    "Disallow: /dashboard",
    "Disallow: /messages",
    "Disallow: /settings",
    "Disallow: /api/",
    "Disallow: /oauth/",
    "Disallow: /mcp/",
    "Crawl-delay: 1",
    "",
    "Sitemap: https://spike.land/sitemap.xml",
    "",
  ].join("\n");

  return c.text(body, 200, {
    "Cache-Control": "public, max-age=86400",
  });
});

export { sitemap };
