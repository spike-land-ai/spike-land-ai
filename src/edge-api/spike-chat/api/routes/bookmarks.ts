import { Hono } from "hono";
import { Env } from "../../core-logic/env";
import { Variables } from "../middleware";

export const bookmarksRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

bookmarksRouter.get("/", async (c) => {
  return c.json([]); // TODO
});
