import { Hono } from "hono";
import type { Env } from "../../core-logic/env";
import type { Variables } from "../middleware";

export const pinsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

pinsRouter.get("/", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});
