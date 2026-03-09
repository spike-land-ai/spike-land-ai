import { Hono } from "hono";
import type { Env } from "../../core-logic/env.js";

const cachePurge = new Hono<{ Bindings: Env }>();

type CachePurgeRequest = {
  files?: string[];
  purge_everything?: boolean;
  blog?: boolean;
  blog_slugs?: string[];
};

cachePurge.post("/api/cache/purge", async (c) => {
  let body: CachePurgeRequest = {};
  const rawBody = await c.req.text();

  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody) as CachePurgeRequest;
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
  }

  if (body.files && body.files.length > 30) {
    return c.json({ error: "Maximum 30 files per request" }, 400);
  }

  const payload =
    body.purge_everything || !body.files?.length ? { purge_everything: true } : { files: body.files };

  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${c.env.CF_ZONE_ID}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.CF_CACHE_PURGE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const result = await resp.json();

  // Also purge Workers Cache API entries (caches.default is per-colo
  // and may not be covered by zone-level purge_cache)
  const workersCachePurged: string[] = [];
  try {
    const cache = (caches as unknown as { default: Cache }).default;

    // Collect URLs to purge from Workers Cache API
    const urlsToPurge: string[] = [];

    if (body.files?.length) {
      urlsToPurge.push(...body.files);
    }

    // Blog-specific purge: purge index + per-slug API cache keys
    if (body.blog || body.blog_slugs?.length) {
      urlsToPurge.push("https://spike.land/api/blog");
      urlsToPurge.push("https://spike.land/blog/rss");
    }
    if (body.blog_slugs?.length) {
      for (const slug of body.blog_slugs) {
        urlsToPurge.push(`https://spike.land/api/blog/${slug}`);
      }
    }

    if (urlsToPurge.length) {
      const results = await Promise.allSettled(
        urlsToPurge.map(async (url) => {
          const deleted = await cache.delete(new Request(url));
          if (deleted) workersCachePurged.push(url);
        }),
      );
      // Log failures silently — best-effort purge
      void results;
    }
  } catch {
    /* Cache API unavailable (e.g. local dev) */
  }

  return c.json(
    { ...result as Record<string, unknown>, workers_cache_purged: workersCachePurged },
    resp.ok ? 200 : 502,
  );
});

export { cachePurge };
