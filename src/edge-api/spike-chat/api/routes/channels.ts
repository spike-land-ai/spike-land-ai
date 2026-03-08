import { Hono } from "hono";
import { Env } from "../../core-logic/env";
import { Variables } from "../middleware";
import { createDb } from "../../db/db-index";
import { channels, channelMembers } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "../../core-logic/id-gen";

export const channelsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

channelsRouter.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "Missing workspaceId" }, 400);

  const allChannels = await db.select()
    .from(channels)
    .where(eq(channels.workspaceId, workspaceId));

  return c.json(allChannels);
});

channelsRouter.post("/", async (c) => {
  const db = createDb(c.env.DB);
  const body = await c.req.json();
  const userId = c.get("userId");
  
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = generateId();
  const now = Date.now();

  await db.insert(channels).values({
    id,
    workspaceId: body.workspaceId,
    name: body.name,
    slug: body.slug,
    type: body.type || "public",
    createdBy: userId,
    createdAt: now,
  });

  await db.insert(channelMembers).values({
    channelId: id,
    userId,
    role: "owner",
    joinedAt: now,
  });

  return c.json({ id }, 201);
});

channelsRouter.get("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const id = c.req.param("id");
  
  const [channel] = await db.select().from(channels).where(eq(channels.id, id));
  if (!channel) return c.json({ error: "Not found" }, 404);
  
  return c.json(channel);
});

channelsRouter.post("/:id/join", async (c) => {
  const db = createDb(c.env.DB);
  const id = c.req.param("id");
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  try {
    await db.insert(channelMembers).values({
      channelId: id,
      userId,
      role: "member",
      joinedAt: Date.now(),
    });
  } catch (e) {
    // ignore duplicate
  }
  
  return c.json({ success: true });
});
