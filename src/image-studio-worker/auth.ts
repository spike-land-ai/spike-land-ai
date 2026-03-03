import type { Env } from "./env.d.ts";

interface AuthSession {
  user: { id: string; email?: string; name?: string };
  session: { id: string; expiresAt: string };
}

/**
 * Validate a session by forwarding cookies/headers to the central auth service
 * at auth-mcp.spike.land. Returns { user, session } if valid, null otherwise.
 */
export async function validateSession(
  headers: Headers,
  env: Env,
): Promise<AuthSession | null> {
  const authUrl = env.AUTH_SERVICE_URL || "https://auth-mcp.spike.land";

  // Forward cookies and authorization header to the auth service
  const forwardHeaders = new Headers();
  const cookie = headers.get("Cookie");
  if (cookie) forwardHeaders.set("Cookie", cookie);
  const auth = headers.get("Authorization");
  if (auth) forwardHeaders.set("Authorization", auth);

  try {
    const res = await fetch(`${authUrl}/api/auth/get-session`, {
      headers: forwardHeaders,
    });

    if (!res.ok) return null;

    const data = (await res.json()) as AuthSession | null;
    if (!data?.user?.id) return null;

    return data;
  } catch {
    return null;
  }
}
