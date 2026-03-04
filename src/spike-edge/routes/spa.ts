import { Hono } from "hono";
import type { Env } from "../env.js";
import { getClientId, sendGA4Events } from "../lib/ga4.js";
import { safeCtx, withEdgeCache } from "../lib/edge-cache.js";

const spa = new Hono<{ Bindings: Env }>();

const IMMUTABLE_EXTENSIONS = new Set([".js", ".css", ".wasm", ".woff2", ".woff", ".ttf"]);

function isHashedAsset(path: string): boolean {
  // Match patterns like filename.abc123.js or filename-abc123.css
  return /\.[a-f0-9]{8,}\.\w+$/.test(path);
}

spa.get("/*", async (c) => {
  const path = new URL(c.req.url).pathname;

  // Strip leading slash for R2 key
  let key = path.startsWith("/") ? path.slice(1) : path;

  // Default to index.html for root
  if (!key) {
    key = "index.html";
  }

  // For static assets (not index.html), use edge cache to avoid R2 reads
  const hasExtension = key.includes(".") && key !== "index.html";
  if (hasExtension) {
    const ext = key.substring(key.lastIndexOf("."));
    const isImmutable = IMMUTABLE_EXTENSIONS.has(ext) && isHashedAsset(key);
    const ttl = isImmutable ? 31536000 : 3600;

    const cacheKey = `${c.req.url}?_cv=${c.env.CACHE_VERSION ?? "v1"}`;
    const cached = await withEdgeCache(c.req.raw, safeCtx(c), async () => {
      const object = await c.env.SPA_ASSETS.get(key);
      if (!object) return null;

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      return new Response(object.body, { headers });
    }, { ttl, swr: isImmutable ? undefined : 3600, immutable: isImmutable, cacheKey });

    if (cached) return cached;

    // Static asset not in cache and not in R2 — return 404, never serve index.html
    return c.text("Not Found", 404);
  }

  const object = await c.env.SPA_ASSETS.get(key);

  if (!object) {
    // SPA fallback: serve index.html for non-file paths (navigation routes only)
    const fallback = await c.env.SPA_ASSETS.get("index.html");
    if (!fallback) {
      return c.text("Not Found", 404);
    }

    let html = await fallback.text();

    // Inject dynamic metadata for /apps/:appId routes
    const appId = path.startsWith("/apps/") && path !== "/apps/new"
      ? path.split("/")[2]
      : undefined;
    if (appId) {
      const url = new URL(c.req.url);
      const tab = url.searchParams.get("tab") || "App";

      // Better capitalization for known apps
      let appName = appId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
      if (appId === "qa-studio") appName = "QA Studio";
      if (appId === "mcp-auth") appName = "MCP Auth";

      const title = `${appName} (${tab}) — spike.land`;
      const description = `Explore ${appName} on spike.land — the AI multi-agent operating system.`;

      // Replace title and inject meta tags
      html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
      html = html.replace(
        /<meta name="description" content="[^"]*" \/>/,
        `<meta name="description" content="${description}" />`,
      );

      // Inject OG and Twitter tags if not present or update them
      const metaTags = `
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        <link rel="canonical" href="https://spike.land${path}${url.search}" />
      `;
      html = html.replace("</head>", `${metaTags}</head>`);
    }

    const response = new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-cache",
      },
    });

    const clientId = await getClientId(c.req.raw);
    const existingCookie = c.req.header("cookie") ?? "";
    if (!existingCookie.includes("spike_client_id=")) {
      // Set a persistent cookie for 1 year
      response.headers.append(
        "set-cookie",
        `spike_client_id=${clientId}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`,
      );
    }

    try {
      c.executionCtx.waitUntil(
        Promise.resolve(clientId).then((cid) =>
          sendGA4Events(c.env, cid, [{
            name: "page_view",
            params: {
              page_path: path,
              referrer: (c.req.header("referer") ?? "").slice(0, 500),
              user_agent: (c.req.header("user-agent") ?? "").slice(0, 200),
            },
          }])
        ),
      );
    } catch { /* no ExecutionContext in test environment */ }

    return response;
  }

  // Non-extension path that matched an R2 object directly (rare)
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=3600");

  return new Response(object.body, { headers });
});

export { spa };
