import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import type { Env } from "../core-logic/env";
import { createDb } from "../db/db/db-index";
import { learnItContent } from "../db/db/schema";
import { acceptsMarkdown, markdownResponse } from "../../common/core-logic/content-negotiation";

export const learnitRoute = new Hono<{ Bindings: Env }>();

// List published topics (JSON only)
learnitRoute.get("/api/learnit", async (c) => {
  const db = createDb(c.env.DB);

  const topics = await db
    .select({
      slug: learnItContent.slug,
      title: learnItContent.title,
      description: learnItContent.description,
      viewCount: learnItContent.viewCount,
    })
    .from(learnItContent)
    .where(eq(learnItContent.status, "published"))
    .orderBy(desc(learnItContent.viewCount))
    .limit(100);

  c.header("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  return c.json({ topics, total: topics.length });
});

// Get individual topic
learnitRoute.get("/api/learnit/:slug", async (c) => {
  const slug = c.req.param("slug");
  const db = createDb(c.env.DB);

  const results = await db
    .select()
    .from(learnItContent)
    .where(eq(learnItContent.slug, slug))
    .limit(1);

  const topic = results[0];

  if (!topic || topic.status !== "published") {
    return c.json({ error: "Topic not found" }, 404);
  }

  // Increment view count in the background
  try {
    c.executionCtx.waitUntil(
      db
        .update(learnItContent)
        .set({ viewCount: topic.viewCount + 1 })
        .where(eq(learnItContent.id, topic.id)),
    );
  } catch {
    /* no ExecutionContext in some environments */
  }

  // Content negotiation: return raw content for agents
  if (acceptsMarkdown(c)) {
    return markdownResponse(topic.content, "public, max-age=300");
  }

  c.header("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  return c.json({
    slug: topic.slug,
    title: topic.title,
    description: topic.description,
    content: topic.content,
    viewCount: topic.viewCount + 1,
  });
});
