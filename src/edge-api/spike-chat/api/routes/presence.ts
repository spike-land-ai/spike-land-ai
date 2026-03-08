import { Hono } from "hono";
import { Env } from "../../core-logic/env";
import { Variables } from "../middleware";

export const presenceRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

presenceRouter.get("/", async (c) => {
  return c.json({}); // TODO
});
