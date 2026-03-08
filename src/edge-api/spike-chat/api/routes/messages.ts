import { Hono } from "hono";
import type { Env } from "../../core-logic/env";
import type { Variables } from "../middleware";
import { createDb } from "../../db/db-index";
import { messages } from "../../db/schema";
import { eq, desc } from "drizzle-orm";
import { generateId } from "../../core-logic/id-gen";

export const messagesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

messagesRouter.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const channelId = c.req.query("channelId");
  const limit = parseInt(c.req.query("limit") || "50", 10);
  
  if (!channelId) return c.json({ error: "Missing channelId" }, 400);

  const msgs = await db.select()
    .from(messages)
    .where(eq(messages.channelId, channelId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return c.json(msgs.reverse());
});

messagesRouter.post("/", async (c) => {
  const db = createDb(c.env.DB);
  const body = await c.req.json();
  const userId = c.get("userId");
  
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  if (!body.channelId || !body.content) return c.json({ error: "Missing fields" }, 400);

  const id = generateId();
  const now = Date.now();

  const msg = {
    id,
    channelId: body.channelId,
    userId,
    content: body.content,
    contentType: body.contentType || "text",
    threadId: body.threadId || null,
    createdAt: now,
  };

  await db.insert(messages).values(msg);

  // Trigger broadcast via DO HTTP endpoint
  const doId = c.env.CHANNEL_DO.idFromName(body.channelId);
  const stub = c.env.CHANNEL_DO.get(doId);
  
  await stub.fetch(new Request("http://internal/broadcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "message_new", message: msg }),
  }));

  return c.json(msg, 201);
});

messagesRouter.delete("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const id = c.req.param("id");
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  await db.update(messages)
    .set({ deletedAt: Date.now() })
    .where(eq(messages.id, id));

  // Retrieve message to broadcast delete to the right channel
  const [msg] = await db.select().from(messages).where(eq(messages.id, id));
  if (msg) {
    const doId = c.env.CHANNEL_DO.idFromName(msg.channelId);
    const stub = c.env.CHANNEL_DO.get(doId);
    await stub.fetch(new Request("http://internal/broadcast", {
      method: "POST",
      body: JSON.stringify({ type: "message_deleted", id }),
    }));
  }

  return c.json({ success: true });
});
