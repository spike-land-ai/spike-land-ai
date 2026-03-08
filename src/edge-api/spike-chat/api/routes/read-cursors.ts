import { Hono } from "hono";
import { Env } from "../../core-logic/env";
import { Variables } from "../middleware";

export const readCursorsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

readCursorsRouter.post("/read", async (c) => {
  return c.json({ success: true }); // TODO
});
