import { Hono } from "hono";
import type { Env } from "../env";
import { createDb } from "../db/index";
import { createDeviceCode, approveDeviceCode, exchangeDeviceCode } from "../auth/oauth-device";

export const oauthRoute = new Hono<{ Bindings: Env }>();

// POST /oauth/device — initiate device authorization
oauthRoute.post("/device", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const clientId = typeof body.client_id === "string" ? body.client_id : undefined;
  const scope = typeof body.scope === "string" ? body.scope : "mcp";

  const db = createDb(c.env.DB);
  const { deviceCode, userCode, expiresIn } = await createDeviceCode(db, { clientId, scope });

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
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.grant_type !== "urn:ietf:params:oauth:grant-type:device_code") {
    return c.json({ error: "unsupported_grant_type" }, 400);
  }

  const deviceCode = typeof body.device_code === "string" ? body.device_code : null;
  if (!deviceCode) {
    return c.json({ error: "invalid_request", error_description: "device_code required" }, 400);
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

// POST /oauth/device/approve — called by Next.js spike.land after user approves
// Protected by MCP_INTERNAL_SECRET header
oauthRoute.post("/device/approve", async (c) => {
  const secret = c.req.header("X-Internal-Secret");
  if (secret !== c.env.MCP_INTERNAL_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
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
