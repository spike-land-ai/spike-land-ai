import type { Context, Next } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";

/**
 * Auth middleware that validates the user session via the AUTH_MCP service binding.
 * Returns 401 if no valid session exists.
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next,
): Promise<Response | void> {
  const cookie = c.req.header("cookie");
  const authHeader = c.req.header("authorization");
  const internalSecret = c.req.header("x-internal-secret");
  const requestedUserId = c.req.header("x-user-id");

  // Trust X-User-Id from internal services with a valid secret (skip OAuth check)
  if (
    internalSecret &&
    c.env.INTERNAL_SERVICE_SECRET &&
    internalSecret === c.env.INTERNAL_SERVICE_SECRET &&
    requestedUserId
  ) {
    c.set("userId", requestedUserId);
    return next();
  }

  if (!cookie && !authHeader) {
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
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  const session = await sessionRes.json<{ session?: unknown; user?: { id: string } }>();

  if (!session?.session || !session?.user) {
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  // Store user info for downstream handlers
  c.set("userId", session.user.id);

  return next();
}
