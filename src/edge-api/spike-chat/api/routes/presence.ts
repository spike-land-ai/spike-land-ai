import { Hono } from "hono";
import type { Env } from "../../core-logic/env";
import type { Variables } from "../middleware";

export const presenceRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

presenceRouter.get("/", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});
