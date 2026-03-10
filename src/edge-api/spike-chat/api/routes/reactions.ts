import { Hono } from "hono";
import type { Env } from "../../core-logic/env";
import type { Variables } from "../middleware";

export const reactionsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

reactionsRouter.post("/:id/reactions", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});
