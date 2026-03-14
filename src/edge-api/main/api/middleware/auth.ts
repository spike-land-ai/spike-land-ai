import type { Context, Next } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";
import { constantTimeEquals } from "../../../common/core-logic/security-utils.js";

type AuthContext = Context<{ Bindings: Env; Variables: Variables }>;

/**
 * Writes a single auth event row to D1 via waitUntil() so it never blocks
 * the response path. All errors are swallowed — audit logging must never
 * cause a request to fail.
 */
function logAuthEvent(
  c: AuthContext,
  eventType: string,
  userId: string | null,
  metadata: Record<string, unknown> | null,
): void {
  const ip = c.req.header("cf-connecting-ip") ?? null;
  const userAgent = c.req.header("user-agent") ?? null;
  const requestId = (c.get("requestId") as string | undefined) ?? null;
  const metadataJson = metadata !== null ? JSON.stringify(metadata) : null;

  if (!c.env.DB) return;

  const write = c.env.DB.prepare(
    `INSERT INTO auth_audit_log
       (event_type, user_id, ip_address, user_agent, request_id, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(eventType, userId, ip, userAgent, requestId, metadataJson)
    .run()
    .catch(() => {
      // intentionally silent — audit failures must not surface to callers
    });

  try {
    c.executionCtx.waitUntil(write);
  } catch {
    // executionCtx is unavailable in some test environments; ignore
  }
}

/**
 * Auth middleware that validates the user session via the AUTH_MCP service binding.
 * Returns 401 if no valid session exists.
 */
export async function authMiddleware(c: AuthContext, next: Next): Promise<Response | void> {
  const cookie = c.req.header("cookie");
  const authHeader = c.req.header("authorization");
  const internalSecret = c.req.header("x-internal-secret");
  const requestedUserId = c.req.header("x-user-id");

  // Trust X-User-Id from internal services with a valid secret (skip OAuth check)
  if (
    internalSecret &&
    c.env.INTERNAL_SERVICE_SECRET &&
    constantTimeEquals(internalSecret, c.env.INTERNAL_SERVICE_SECRET) &&
    requestedUserId
  ) {
    c.set("userId", requestedUserId);
    logAuthEvent(c, "internal_auth", requestedUserId, null);
    return next();
  }

  if (!cookie && !authHeader) {
    logAuthEvent(c, "login_failure", null, { reason: "no_credentials" });
    return c.json({ error: "Authentication required" }, 401);
  }

  // Validate session via AUTH_MCP service binding (sub-1ms internal call)
  const requestId = c.get("requestId") as string | undefined;
  const sessionReq = new Request("https://auth-mcp.spike.land/api/auth/get-session", {
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(authHeader ? { authorization: authHeader } : {}),
      "X-Forwarded-Host": "spike.land",
      "X-Forwarded-Proto": "https",
      ...(requestId ? { "X-Request-Id": requestId } : {}),
    },
  });

  let sessionRes: Response;
  try {
    sessionRes = await c.env.AUTH_MCP.fetch(sessionReq);
    if (sessionRes.status === 503) {
      sessionRes = await fetch(sessionReq);
    }
  } catch {
    sessionRes = await fetch(sessionReq);
  }

  if (!sessionRes.ok) {
    logAuthEvent(c, "login_failure", null, { reason: "invalid_session" });
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  const session = await sessionRes.json<{
    session?: unknown;
    user?: { id: string; email?: string };
  }>();

  if (!session?.session || !session?.user) {
    logAuthEvent(c, "login_failure", null, { reason: "invalid_session" });
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  // Store user info for downstream handlers
  c.set("userId", session.user.id);
  if (session.user.email) {
    c.set("userEmail", session.user.email);
  }

  logAuthEvent(c, "login_success", session.user.id, null);
  return next();
}
