import { Hono } from "hono";
import { Env } from "../../core-logic/env";
import { Variables } from "../middleware";

export const reactionsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

reactionsRouter.post("/:id/reactions", async (c) => {
  return c.json({ success: true }); // TODO
});
