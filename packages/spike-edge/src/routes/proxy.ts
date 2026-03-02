import { Hono } from "hono";
import type { Env } from "../env.js";

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

proxy.post("/proxy/stripe", async (c) => {
  const body = await c.req.json<unknown>();
  if (!validateProxyBody(body)) {
    return c.json({ error: "Invalid request body: url is required" }, 400);
  }

  if (!body.url.startsWith("https://api.stripe.com/")) {
    return c.json({ error: "Invalid Stripe API URL" }, 400);
  }

  const response = await fetch(body.url, {
    method: body.method ?? "POST",
    headers: {
      Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...body.headers,
    },
    body: body.body ? JSON.stringify(body.body) : undefined,
  });

  return new Response(response.body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
});

proxy.post("/proxy/ai", async (c) => {
  const body = await c.req.json<unknown>();
  if (!validateProxyBody(body)) {
    return c.json({ error: "Invalid request body: url is required" }, 400);
  }

  const response = await fetch(body.url, {
    method: body.method ?? "POST",
    headers: {
      Authorization: `Bearer ${c.env.AI_API_KEY}`,
      "Content-Type": "application/json",
      ...body.headers,
    },
    body: body.body ? JSON.stringify(body.body) : undefined,
  });

  return new Response(response.body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
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

  const response = await fetch(body.url, {
    method: body.method ?? "GET",
    headers: {
      Authorization: `Bearer ${c.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "spike-edge",
      ...body.headers,
    },
    body: body.body ? JSON.stringify(body.body) : undefined,
  });

  return new Response(response.body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
});

export { proxy };
