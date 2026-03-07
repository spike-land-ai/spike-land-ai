/**
 * User Profile Endpoint
 *
 * POST /api/user/profile — update user display name.
 * Email changes are blocked to prevent privilege escalation (email is auth-provider-owned).
 * Requires auth.
 */

import { Hono } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";

const userProfile = new Hono<{ Bindings: Env; Variables: Variables }>();

userProfile.post("/api/user/profile", async (c) => {
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let body: { name?: string; email?: string };
  try {
    body = (await c.req.json()) as { name?: string; email?: string };
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  // Email changes are not permitted via this endpoint — email is owned by the
  // auth provider (Better Auth/OAuth) and requires a verified change flow.
  // Allowing unverified email changes would allow privilege escalation to admin
  // roles that rely on email-based access checks (e.g. cockpit metrics).
  if (body.email !== undefined) {
    return c.json({ error: "Email cannot be changed via this endpoint" }, 400);
  }

  const { name } = body;
  if (!name) {
    return c.json({ error: "name is required" }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE users SET name = ? WHERE id = ?`,
  )
    .bind(name, userId)
    .run();

  return c.json({ success: true });
});

export { userProfile };
