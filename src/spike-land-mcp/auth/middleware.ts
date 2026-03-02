import { createMiddleware } from "hono/factory";
import type { Env } from "../env";
import { createDb } from "../db/index";
import { lookupApiKey } from "./api-key";
import { oauthAccessTokens } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";

async function hashToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

import type { DrizzleDB } from "../db/index";

export type AuthVariables = { userId: string; db: DrizzleDB };

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: AuthVariables;
}>(async (c, next) => {
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
  const db = createDb(c.env.DB);

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
      .where(and(eq(oauthAccessTokens.tokenHash, tokenHash), gt(oauthAccessTokens.expiresAt, now)))
      .limit(1);

    userId = result[0]?.userId ?? null;
  }

  if (!userId) {
    return c.json({ error: "Unauthorized", message: "Invalid or expired token" }, 401);
  }

  c.set("userId", userId);
  c.set("db", db);
  return next();
});
