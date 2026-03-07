import type { Context, Next } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";

export async function internalAuthMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next,
): Promise<Response | void> {
  const secret = c.req.header("x-internal-secret");
  if (!secret || !c.env.INTERNAL_SERVICE_SECRET || secret !== c.env.INTERNAL_SERVICE_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
}
