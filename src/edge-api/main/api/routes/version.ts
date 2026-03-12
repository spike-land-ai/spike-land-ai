import { Hono } from "hono";
import type { Env } from "../../core-logic/env.js";

const version = new Hono<{ Bindings: Env }>();

version.get("/api/version", async (c) => {
  // Read index.html to extract build metadata from meta tags
  const indexObj = await c.env.SPA_ASSETS.get("index.html");
  let sha = "unknown";
  let buildTime = "unknown";

  if (indexObj) {
    const html = await indexObj.text();
    const shaMatch = html.match(/<meta\s+name="build-sha"\s+content="([^"]+)"/);
    const timeMatch = html.match(/<meta\s+name="build-time"\s+content="([^"]+)"/);
    if (shaMatch?.[1]) sha = shaMatch[1];
    if (timeMatch?.[1]) buildTime = timeMatch[1];
  }

  // Count total deployed assets without exposing the per-asset inventory
  let totalAssets = 0;
  let cursor: string | undefined;

  do {
    const listing = await c.env.SPA_ASSETS.list({
      ...(cursor !== undefined ? { cursor } : {}),
      limit: 1000,
    });
    totalAssets += listing.objects.length;
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);

  return c.json({ sha, buildTime, totalAssets });
});

export { version };
