import { Hono } from "hono";
import type { Env } from "../env.js";
import { getClientId, sendGA4Events } from "../lib/ga4.js";

const proxy = new Hono<{ Bindings: Env }>();

interface ProxyRequestBody {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

function validateProxyBody(body: unknown): body is ProxyRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.url === "string" && b.url.length > 0;
}

// S4: Explicit allowlist of headers callers may set. Never let callers override
// security-sensitive headers like Authorization, Host, or Cookie.
const ALLOWED_CALLER_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-type",
  "x-request-id",
]);

function sanitizeCallerHeaders(
  raw: Record<string, string> | undefined,
): Record<string, string> {
  if (!raw) return {};
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (ALLOWED_CALLER_HEADERS.has(key.toLowerCase())) {
      safe[key] = value;
    }
  }
  return safe;
}

const AI_PROVIDERS: Array<{ prefix: string; envKey: keyof Env; headerName: string; byokProvider: string }> = [
  { prefix: "https://api.anthropic.com/", envKey: "CLAUDE_OAUTH_TOKEN", headerName: "x-api-key", byokProvider: "anthropic" },
  { prefix: "https://generativelanguage.googleapis.com/", envKey: "GEMINI_API_KEY", headerName: "Authorization", byokProvider: "google" },
];

/**
 * Attempt to resolve a BYOK key for the given user and provider via MCP_SERVICE.
 * Returns the decrypted API key or null if none stored.
 */
async function resolveByokKey(
  mcpService: Fetcher,
  userId: string,
  provider: string,
): Promise<string | null> {
  try {
    const res = await mcpService.fetch(
      new Request("https://mcp/internal/byok/get", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, provider }),
      }),
    );
    if (!res.ok) return null;
    const data = await res.json<{ key?: string }>();
    return data.key ?? null;
  } catch {
    return null;
  }
}

proxy.post("/proxy/stripe", async (c) => {
  const body = await c.req.json<unknown>();
  if (!validateProxyBody(body)) {
    return c.json({ error: "Invalid request body: url is required" }, 400);
  }

  if (!body.url.startsWith("https://api.stripe.com/")) {
    return c.json({ error: "Invalid Stripe API URL" }, 400);
  }

  const start = Date.now();
  const response = await fetch(body.url, {
    method: body.method ?? "POST",
    headers: {
      ...sanitizeCallerHeaders(body.headers),
      Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.body ? JSON.stringify(body.body) : undefined,
  });

  try {
    c.executionCtx.waitUntil(
      getClientId(c.req.raw).then((clientId) =>
        sendGA4Events(c.env, clientId, [{
          name: "proxy_api_call",
          params: { provider: "stripe", status: response.status, duration_ms: Date.now() - start },
        }])
      ),
    );
  } catch { /* no ExecutionContext in test environment */ }

  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
});

proxy.post("/proxy/ai", async (c) => {
  const body = await c.req.json<unknown>();
  if (!validateProxyBody(body)) {
    return c.json({ error: "Invalid request body: url is required" }, 400);
  }

  const provider = AI_PROVIDERS.find((p) => body.url.startsWith(p.prefix));
  if (!provider) {
    return c.json({ error: "Invalid AI API URL" }, 400);
  }

  // Try BYOK key first, fall back to platform key
  const userId = c.get("userId" as never) as string | undefined;
  let apiKey: string | null = null;
  let usingByok = false;

  if (userId) {
    apiKey = await resolveByokKey(c.env.MCP_SERVICE, userId, provider.byokProvider);
    if (apiKey) usingByok = true;
  }

  if (!apiKey) {
    apiKey = c.env[provider.envKey] as string;
  }
  if (!apiKey) {
    return c.json({ error: "AI provider not configured" }, 503);
  }

  // Anthropic uses x-api-key header; Gemini uses Bearer token
  const authHeaders: Record<string, string> =
    provider.headerName === "x-api-key"
      ? { "x-api-key": apiKey }
      : { Authorization: `Bearer ${apiKey}` };

  const providerName = provider.byokProvider;
  const start = Date.now();
  const response = await fetch(body.url, {
    method: body.method ?? "POST",
    headers: {
      ...sanitizeCallerHeaders(body.headers),
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: body.body ? JSON.stringify(body.body) : undefined,
  });

  try {
    c.executionCtx.waitUntil(
      getClientId(c.req.raw).then((clientId) =>
        sendGA4Events(c.env, clientId, [{
          name: "proxy_api_call",
          params: { provider: providerName, status: response.status, duration_ms: Date.now() - start, byok: usingByok },
        }])
      ),
    );
  } catch { /* no ExecutionContext in test environment */ }

  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
});

proxy.post("/proxy/github", async (c) => {
  const body = await c.req.json<unknown>();
  if (!validateProxyBody(body)) {
    return c.json({ error: "Invalid request body: url is required" }, 400);
  }

  if (!body.url.startsWith("https://api.github.com/")) {
    return c.json({ error: "Invalid GitHub API URL" }, 400);
  }

  const start = Date.now();
  const response = await fetch(body.url, {
    method: body.method ?? "GET",
    headers: {
      ...sanitizeCallerHeaders(body.headers),
      Authorization: `Bearer ${c.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "spike-edge",
    },
    body: body.body ? JSON.stringify(body.body) : undefined,
  });

  try {
    c.executionCtx.waitUntil(
      getClientId(c.req.raw).then((clientId) =>
        sendGA4Events(c.env, clientId, [{
          name: "proxy_api_call",
          params: { provider: "github", status: response.status, duration_ms: Date.now() - start },
        }])
      ),
    );
  } catch { /* no ExecutionContext in test environment */ }

  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
});

export { proxy };
