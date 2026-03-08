import { Hono } from "hono";
import { Env } from "../../core-logic/env";
import { Variables } from "../middleware";

export const pinsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

pinsRouter.get("/", async (c) => {
  return c.json([]); // TODO
});
