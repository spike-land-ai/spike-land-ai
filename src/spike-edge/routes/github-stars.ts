import { Hono } from "hono";
import type { Env } from "../env.js";
import { safeCtx, withEdgeCache } from "../lib/edge-cache.js";

const githubStars = new Hono<{ Bindings: Env }>();

githubStars.get("/api/github/stars", async (c) => {
  let cached: Response | null = null;
  try {
    cached = await withEdgeCache(c.req.raw, safeCtx(c), async () => {
      const res = await fetch("https://api.github.com/repos/spike-land-ai/spike-land-ai", {
        headers: {
          "Authorization": `token ${c.env.GITHUB_TOKEN}`,
          "User-Agent": "spike-edge",
          "Accept": "application/vnd.github.v3+json",
        },
      });

      if (!res.ok) return null;

      const data = await res.json<{ stargazers_count?: number }>();
      const stars = data.stargazers_count ?? null;

      return new Response(JSON.stringify({ stars, cached: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }, { ttl: 3600, swr: 86400 });
  } catch {
    // Cache API unavailable — fall back to direct fetch
    try {
      const res = await fetch("https://api.github.com/repos/spike-land-ai/spike-land-ai", {
        headers: {
          "Authorization": `token ${c.env.GITHUB_TOKEN}`,
          "User-Agent": "spike-edge",
          "Accept": "application/vnd.github.v3+json",
        },
      });
      if (res.ok) {
        const data = await res.json<{ stargazers_count?: number }>();
        cached = new Response(JSON.stringify({ stars: data.stargazers_count ?? null, cached: false }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch { /* API unavailable */ }
  }

  if (!cached) {
    return c.json({ stars: null, error: "GitHub API unavailable" }, 200);
  }

  return cached;
});

export { githubStars };
