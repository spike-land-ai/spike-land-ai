import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../core-logic/env";
import { createDb } from "../db/db/db-index.ts";
import { hashToken } from "../db/auth/token";
import { oauthAccessTokens } from "../db/db/schema";
import { eq } from "drizzle-orm";
import { approveDeviceCode, createDeviceCode, exchangeDeviceCode } from "../db/auth/oauth-device";
import { checkRateLimit } from "../core-logic/kv/rate-limit";

/** Parse request body from either form-encoded or JSON, per OAuth RFC 6749 §2.3. */
async function parseOAuthBody(c: Context): Promise<Record<string, unknown>> {
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return (await c.req.parseBody()) as Record<string, unknown>;
  }
  return (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
}

export const oauthRoute = new Hono<{ Bindings: Env }>();

// POST /oauth/device — initiate device authorization
oauthRoute.post("/device", async (c) => {
  const clientIp = c.req.header("cf-connecting-ip") ?? "unknown";
  const { isLimited, resetAt } = await checkRateLimit(`device:${clientIp}`, c.env.KV, 10, 300_000);
  if (isLimited) {
    c.header("Retry-After", String(Math.ceil((resetAt - Date.now()) / 1000)));
    return c.json({ error: "slow_down", error_description: "Too many requests" }, 429);
  }

  const body = await parseOAuthBody(c);
  const clientId = typeof body.client_id === "string" ? body.client_id : undefined;
  const scope = typeof body.scope === "string" ? body.scope : "mcp";

  const db = createDb(c.env.DB);
  const { deviceCode, userCode, expiresIn } = await createDeviceCode(db, {
    ...(clientId !== undefined ? { clientId } : {}),
    scope,
  });

  const baseUrl = c.env.SPIKE_LAND_URL || "https://spike.land";

  return c.json({
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: `${baseUrl}/mcp/authorize`,
    verification_uri_complete: `${baseUrl}/mcp/authorize?user_code=${userCode}`,
    expires_in: expiresIn,
    interval: 5,
  });
});

// POST /oauth/token — poll for access token (device grant)
oauthRoute.post("/token", async (c) => {
  const clientIp = c.req.header("cf-connecting-ip") ?? "unknown";
  const { isLimited, resetAt } = await checkRateLimit(`token:${clientIp}`, c.env.KV, 60, 300_000);
  if (isLimited) {
    c.header("Retry-After", String(Math.ceil((resetAt - Date.now()) / 1000)));
    return c.json({ error: "slow_down", error_description: "Too many requests" }, 429);
  }

  const body = await parseOAuthBody(c);

  if (body.grant_type !== "urn:ietf:params:oauth:grant-type:device_code") {
    return c.json({ error: "unsupported_grant_type" }, 400);
  }

  const deviceCode = typeof body.device_code === "string" ? body.device_code : null;
  if (!deviceCode) {
    return c.json(
      {
        error: "invalid_request",
        error_description: "device_code required",
      },
      400,
    );
  }

  const db = createDb(c.env.DB);
  const result = await exchangeDeviceCode(db, deviceCode);

  if ("error" in result) {
    return c.json(result, 400);
  }

  return c.json({
    access_token: result.accessToken,
    token_type: result.tokenType,
    scope: result.scope,
  });
});

// POST /oauth/device/approve — called by spike-app after user approves
// Protected by MCP_INTERNAL_SECRET header
oauthRoute.post("/device/approve", async (c) => {
  const secret = c.req.header("X-Internal-Secret");
  if (secret !== c.env.MCP_INTERNAL_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await parseOAuthBody(c);
  const userCode = typeof body.user_code === "string" ? body.user_code : null;
  const userId = typeof body.user_id === "string" ? body.user_id : null;

  if (!userCode || !userId) {
    return c.json({ error: "user_code and user_id required" }, 400);
  }

  const db = createDb(c.env.DB);
  const result = await approveDeviceCode(db, userCode, userId);

  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ ok: true });
});

// POST /oauth/device/test-approve — auto-approve for non-production environments
oauthRoute.post("/device/test-approve", async (c) => {
  if (c.env.APP_ENV === "production") {
    return c.json({ error: "Not available in production" }, 403);
  }

  const body = await parseOAuthBody(c);
  const userCode = typeof body.user_code === "string" ? body.user_code : null;
  if (!userCode) {
    return c.json({ error: "user_code required" }, 400);
  }

  const db = createDb(c.env.DB);
  const result = await approveDeviceCode(db, userCode, "test-user-system");
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }
  return c.json({ ok: true });
});

// POST /oauth/revoke — revoke an access token (RFC 7009)
oauthRoute.post("/revoke", async (c) => {
  const body = await parseOAuthBody(c);
  const token = typeof body.token === "string" ? body.token : null;

  if (!token) {
    // RFC 7009: always return 200 even for invalid requests
    return c.json({ active: false });
  }

  const tokenHash = await hashToken(token);
  const db = createDb(c.env.DB);

  await db
    .update(oauthAccessTokens)
    .set({ revokedAt: Date.now() })
    .where(eq(oauthAccessTokens.tokenHash, tokenHash));

  // RFC 7009: always return 200 regardless of whether token existed
  return c.json({ active: false });
});
