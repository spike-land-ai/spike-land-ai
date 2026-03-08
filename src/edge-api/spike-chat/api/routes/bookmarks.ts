import { Hono } from "hono";
import type { Env } from "../../core-logic/env";
import type { Variables } from "../middleware";

export const bookmarksRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

bookmarksRouter.get("/", async (c) => {
  return c.json([]); // TODO
});
