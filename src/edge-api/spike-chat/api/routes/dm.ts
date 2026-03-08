import { Hono } from "hono";
import { Env } from "../../core-logic/env";
import { Variables } from "../middleware";
import { createDb } from "../../db/db-index";
import { channels, channelMembers } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "../../core-logic/id-gen";

export const dmRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

dmRouter.post("/workspaces/:workspaceId/dm", async (c) => {
  const db = createDb(c.env.DB);
  const workspaceId = c.req.param("workspaceId");
  const body = await c.req.json();
  const userId = c.get("userId");
  
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  
  const targetUserId = body.userId;
  if (!targetUserId) return c.json({ error: "Missing target userId" }, 400);

  // Deterministic slug based on sorted user IDs
  const sortedIds = [userId, targetUserId].sort();
  const slug = `dm-${sortedIds.join("-")}`;

  // Check if DM channel already exists
  const existingChannels = await db.select().from(channels).where(
    and(
      eq(channels.workspaceId, workspaceId),
      eq(channels.slug, slug)
    )
  );

  if (existingChannels.length > 0) {
    return c.json({ id: existingChannels[0].id });
  }

  const id = generateId();
  const now = Date.now();

  await db.insert(channels).values({
    id,
    workspaceId,
    name: "DM",
    slug,
    type: "dm",
    createdBy: userId,
    createdAt: now,
  });

  await db.insert(channelMembers).values([
    { channelId: id, userId, role: "member", joinedAt: now },
    { channelId: id, userId: targetUserId, role: "member", joinedAt: now }
  ]);

  return c.json({ id }, 201);
});
