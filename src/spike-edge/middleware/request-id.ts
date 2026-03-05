import { createMiddleware } from "hono/factory";
import type { Env } from "../env.js";

export const requestIdMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const requestId = c.req.header("X-Request-Id") || crypto.randomUUID();
  c.set("requestId" as never, requestId as never);
  await next();
  c.header("X-Request-Id", requestId);
});
