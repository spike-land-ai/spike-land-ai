/**
 * API Keys Management Endpoints
 *
 * GET    /api/keys       — list user's stored keys (masked)
 * POST   /api/keys       — store a new API key
 * DELETE /api/keys/:id   — remove a stored key (ownership verified)
 * POST   /api/keys/:id/test — verify key works with a test call to the provider
 *
 * Requires auth.
 */

import { Hono } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";

const apiKeys = new Hono<{ Bindings: Env; Variables: Variables }>();

interface ApiKeyRow {
  id: string;
  provider: string;
  encrypted_key: string;
  created_at: string;
}

/** Mask all but the last 4 chars of a key value */
function maskKey(key: string): string {
  if (key.length <= 4) return "****";
  return "*".repeat(key.length - 4) + key.slice(-4);
}

apiKeys.get("/api/keys", async (c) => {
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT id, provider, encrypted_key, created_at
     FROM user_api_key_vault WHERE user_id = ? ORDER BY created_at DESC`,
  )
    .bind(userId)
    .all<ApiKeyRow>();

  const keys = results.map((row) => ({
    id: row.id,
    provider: row.provider,
    key: maskKey(row.encrypted_key),
    createdAt: row.created_at,
  }));

  return c.json({ keys });
});

apiKeys.post("/api/keys", async (c) => {
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let body: { provider?: string; apiKey?: string };
  try {
    body = (await c.req.json()) as { provider?: string; apiKey?: string };
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { provider, apiKey } = body;
  if (!provider || !apiKey) {
    return c.json({ error: "provider and apiKey are required" }, 400);
  }

  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO user_api_key_vault (id, user_id, provider, encrypted_key, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
  )
    .bind(id, userId, provider, apiKey)
    .run();

  return c.json({ id, provider, createdAt: new Date().toISOString() }, 201);
});

apiKeys.delete("/api/keys/:id", async (c) => {
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const keyId = c.req.param("id");

  // Verify ownership before deleting
  const existing = await c.env.DB.prepare(
    `SELECT id FROM user_api_key_vault WHERE id = ? AND user_id = ? LIMIT 1`,
  )
    .bind(keyId, userId)
    .first<{ id: string }>();

  if (!existing) {
    return c.json({ error: "Key not found" }, 404);
  }

  await c.env.DB.prepare(
    `DELETE FROM user_api_key_vault WHERE id = ? AND user_id = ?`,
  )
    .bind(keyId, userId)
    .run();

  return c.json({ success: true });
});

const PROVIDER_TEST_URLS: Record<string, { url: string; method: string; headers: Record<string, string> }> = {
  openai: {
    url: "https://api.openai.com/v1/models",
    method: "GET",
    headers: {},
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/models",
    method: "GET",
    headers: { "anthropic-version": "2023-06-01" },
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    method: "GET",
    headers: {},
  },
};

apiKeys.post("/api/keys/:id/test", async (c) => {
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const keyId = c.req.param("id");

  const row = await c.env.DB.prepare(
    `SELECT provider, encrypted_key FROM user_api_key_vault
     WHERE id = ? AND user_id = ? LIMIT 1`,
  )
    .bind(keyId, userId)
    .first<{ provider: string; encrypted_key: string }>();

  if (!row) {
    return c.json({ error: "Key not found" }, 404);
  }

  const providerConfig = PROVIDER_TEST_URLS[row.provider.toLowerCase()];
  if (!providerConfig) {
    return c.json({ error: `Test not supported for provider '${row.provider}'` }, 400);
  }

  // Build test URL (Gemini uses query param for key)
  let testUrl = providerConfig.url;
  const testHeaders: Record<string, string> = { ...providerConfig.headers };

  if (row.provider.toLowerCase() === "gemini") {
    testUrl = `${testUrl}?key=${row.encrypted_key}`;
  } else {
    testHeaders.Authorization = `Bearer ${row.encrypted_key}`;
  }

  const res = await fetch(testUrl, {
    method: providerConfig.method,
    headers: testHeaders,
  });

  if (res.ok) {
    return c.json({ valid: true });
  }

  return c.json({ valid: false, status: res.status });
});

export { apiKeys };
