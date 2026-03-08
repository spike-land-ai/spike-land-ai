import { createMiddleware } from "hono/factory";
import type { Env } from "../core-logic/env";
import { createDb } from "../db/db/db-index.ts";
import type { DrizzleDB } from "../db/db/db-index.ts";
import { lookupApiKey } from "../db/auth/api-key";
import { hashToken } from "../db/auth/token";
import { oauthAccessTokens, users } from "../db/db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";

const ANONYMOUS_TOOLS = new Set([
  "search_tools",
  "list_categories",
  "get_status",
  "get_tool_info",
  "billing_list_plans",
]);

export type UserRole = "user" | "admin" | "super_admin";

export type AuthVariables = { userId: string; db: DrizzleDB; userRole: UserRole };

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: AuthVariables;
}>(async (c, next) => {
  const db = createDb(c.env.DB);
  const internalSecret = c.req.header("X-Internal-Secret");
  const internalUserId = c.req.header("X-User-Id");

  if (
    internalSecret &&
    c.env.MCP_INTERNAL_SECRET &&
    internalSecret === c.env.MCP_INTERNAL_SECRET &&
    internalUserId
  ) {
    let userRole: UserRole = "user";
    try {
      const userRow = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, internalUserId))
        .limit(1);
      if (userRow[0]?.role) {
        userRole = userRow[0].role as UserRole;
      }
    } catch {
      // Default to "user" if role lookup fails
    }

    c.set("userId", internalUserId);
    c.set("db", db);
    c.set("userRole", userRole);
    return next();
  }

  const reqClone = c.req.raw.clone();
  try {
    const body = (await reqClone.json()) as Record<string, unknown>;
    if (
      c.req.method === "POST" &&
      body &&
      typeof body === "object" &&
      body.method === "tools/call" &&
      body.params &&
      typeof body.params === "object" &&
      ANONYMOUS_TOOLS.has((body.params as Record<string, unknown>).name as string)
    ) {
      c.set("userId", "anonymous");
      c.set("db", db);
      c.set("userRole", "user" as UserRole);
      return next();
    }
  } catch (_e) {
    // Ignore parse errors, let regular auth or downstream handle it
  }

  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      {
        error: "Unauthorized",
        message: "Bearer token required. Use an API key or OAuth 2.1.",
        help: {
          api_key: "https://spike.land/settings?tab=api-keys",
          oauth_discovery: "https://mcp.spike.land/.well-known/oauth-authorization-server",
          device_authorization: "https://mcp.spike.land/oauth/device",
        },
      },
      401,
      {
        "WWW-Authenticate":
          'Bearer resource_metadata="https://mcp.spike.land/.well-known/oauth-protected-resource/mcp"',
      },
    );
  }

  const token = authHeader.slice("Bearer ".length);
  let userId: string | null = null;

  if (token.startsWith("sk_")) {
    // API key
    const result = await lookupApiKey(token, db);
    userId = result?.userId ?? null;
  } else if (token.startsWith("mcp_")) {
    // OAuth access token
    const tokenHash = await hashToken(token);
    const now = Date.now();

    const result = await db
      .select({ userId: oauthAccessTokens.userId })
      .from(oauthAccessTokens)
      .where(
        and(
          eq(oauthAccessTokens.tokenHash, tokenHash),
          gt(oauthAccessTokens.expiresAt, now),
          isNull(oauthAccessTokens.revokedAt),
        ),
      )
      .limit(1);

    userId = result[0]?.userId ?? null;
  }

  if (!userId) {
    return c.json(
      {
        error: "Unauthorized",
        message: "Invalid or expired token",
      },
      401,
    );
  }

  // Resolve user role for RBAC
  let userRole: UserRole = "user";
  try {
    const userRow = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (userRow[0]?.role) {
      userRole = userRow[0].role as UserRole;
    }
  } catch {
    // Default to "user" if role lookup fails
  }

  c.set("userId", userId);
  c.set("db", db);
  c.set("userRole", userRole);
  return next();
});
