import { createMiddleware } from "hono/factory";
import type { Env, Variables } from "../../core-logic/env.js";

export const requestIdMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
  const requestId = c.req.header("X-Request-Id") || crypto.randomUUID();
  c.set("requestId", requestId);
  await next();
  c.header("X-Request-Id", requestId);
});
