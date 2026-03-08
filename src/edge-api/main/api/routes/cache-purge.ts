import { Hono } from "hono";
import type { Env } from "../../core-logic/env.js";

const cachePurge = new Hono<{ Bindings: Env }>();

type CachePurgeRequest = {
  files?: string[];
  purge_everything?: boolean;
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
  return c.json(result, resp.ok ? 200 : 502);
});

export { cachePurge };
