import { Hono } from "hono";
import type { Env } from "../../core-logic/env.js";
import { getClientId, sendGA4Events } from "../../lazy-imports/ga4.js";
import { safeCtx, withEdgeCache } from "../lib/edge-cache.js";

const live = new Hono<{ Bindings: Env }>();

live.get("/live/:appId", async (c) => {
  const appId = c.req.param("appId");

  const cached = await withEdgeCache(
    c.req.raw,
    safeCtx(c),
    async () => {
      const key = `apps/${appId}/bundle.js`;
      const object = await c.env.R2.get(key);
      if (!object) return null;

      return new Response(object.body, {
        headers: { "content-type": "application/javascript; charset=utf-8" },
      });
    },
    { ttl: 60 },
  );

  if (!cached) return c.json({ error: "App not found" }, 404);

  try {
    c.executionCtx.waitUntil(
      getClientId(c.req.raw).then((clientId) =>
        sendGA4Events(c.env, clientId, [
          {
            name: "live_app_view",
            params: { app_id: appId },
          },
        ]),
      ),
    );
  } catch {
    /* no ExecutionContext in test environment */
  }

  return cached;
});

live.get("/live/:appId/index.html", async (c) => {
  const appId = c.req.param("appId");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App Preview — ${appId}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/live/${appId}"></script>
</body>
</html>`;

  return c.html(html);
});

export { live };
