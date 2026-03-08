import { Hono } from "hono";
import type { Env } from "../../core-logic/env";
import type { Variables } from "../middleware";

export const webhooksRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

webhooksRouter.post("/inbound/:token", async (c) => {
  // TODO
  return c.json({ success: true });
});
