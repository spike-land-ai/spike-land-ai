import { Hono } from "hono";
import { Env } from "../../core-logic/env";
import { Variables } from "../middleware";

export const threadsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

threadsRouter.get("/:id/replies", async (c) => {
  return c.json([]); // TODO
});
