/**
 * User Profile Endpoint
 *
 * POST /api/user/profile — update user name/email in users table.
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

  const { name, email } = body;
  if (!name && !email) {
    return c.json({ error: "At least one of name or email is required" }, 400);
  }

  const fields: string[] = [];
  const values: string[] = [];

  if (name) {
    fields.push("name = ?");
    values.push(name);
  }
  if (email) {
    fields.push("email = ?");
    values.push(email);
  }

  values.push(userId);

  await c.env.DB.prepare(
    `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
  )
    .bind(...values)
    .run();

  return c.json({ success: true });
});

export { userProfile };
