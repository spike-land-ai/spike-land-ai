import { Hono } from "hono";
import { Env } from "../../core-logic/env";
import { Variables } from "../middleware";

export const websocketRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

websocketRouter.get("/channels/:channelId/ws", async (c) => {
  const channelId = c.req.param("channelId");
  const userId = c.get("userId") || c.req.query("userId");
  
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.env.CHANNEL_DO.idFromName(channelId);
  const stub = c.env.CHANNEL_DO.get(id);

  // Forward the request to the DO
  return stub.fetch(c.req.raw);
});

websocketRouter.get("/workspaces/:workspaceId/presence/ws", async (c) => {
  const workspaceId = c.req.param("workspaceId");
  const userId = c.get("userId") || c.req.query("userId");
  
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.env.PRESENCE_DO.idFromName(workspaceId);
  const stub = c.env.PRESENCE_DO.get(id);

  return stub.fetch(c.req.raw);
});
