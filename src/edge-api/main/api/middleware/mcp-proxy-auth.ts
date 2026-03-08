import type { Env } from "../../core-logic/env.js";

interface SessionLookupResponse {
  session?: unknown;
  user?: {
    id?: string;
  };
}

interface BuildMcpProxyHeadersOptions {
  requestId?: string;
  fetchAuth: (env: Env, request: Request) => Promise<Response>;
}

export async function buildMcpProxyHeaders(
  env: Env,
  request: Request,
  { requestId, fetchAuth }: BuildMcpProxyHeadersOptions,
): Promise<Headers> {
  const headers = new Headers(request.headers);
  const authHeader = headers.get("authorization");
  const cookie = headers.get("cookie");

  // Browser session cookies are only meaningful on spike.land/auth-mcp.
  // Never forward them to the MCP worker.
  headers.delete("cookie");

  if (authHeader || !cookie) {
    return headers;
  }

  const sessionReq = new Request("https://auth-mcp.spike.land/api/auth/get-session", {
    headers: {
      cookie,
      "X-Forwarded-Host": "spike.land",
      "X-Forwarded-Proto": "https",
      ...(requestId ? { "X-Request-Id": requestId } : {}),
    },
  });

  try {
    const sessionRes = await fetchAuth(env, sessionReq);
    if (!sessionRes.ok) {
      return headers;
    }

    const session = await sessionRes.json<SessionLookupResponse>();
    const userId = session.user?.id;
    if (!session.session || !userId) {
      return headers;
    }

    headers.set("X-Internal-Secret", env.MCP_INTERNAL_SECRET);
    headers.set("X-User-Id", userId);
    return headers;
  } catch {
    return headers;
  }
}
