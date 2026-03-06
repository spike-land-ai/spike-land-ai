import { Hono } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";
import { authMiddleware } from "../middleware/auth.js";
import { recordEloEvent } from "../../core-logic/elo-service.js";

const blogComments = new Hono<{ Bindings: Env; Variables: Variables }>();

const DOWNVOTE_THRESHOLD = -10; // Net score threshold for ELO penalty

/** GET /blog/:slug/comments — list comments for an article. */
blogComments.get("/blog/:slug/comments", async (c) => {
  const slug = c.req.param("slug");

  const result = await c.env.DB.prepare(
    `SELECT id, user_id, user_name, content, anchor_text, position_selector,
            parent_id, upvotes, downvotes, score, created_at, updated_at
     FROM blog_comments WHERE article_slug = ? ORDER BY created_at ASC`,
  ).bind(slug).all();

  return c.json(result.results);
});

/** POST /blog/:slug/comments — add a comment to an article. */
blogComments.post("/blog/:slug/comments", authMiddleware, async (c) => {
  const slug = c.req.param("slug");
  const userId = c.get("userId");

  const body = await c.req.json<{
    content: string;
    user_name: string;
    anchor_text?: string;
    position_selector?: string;
    parent_id?: string;
  }>();

  if (!body.content?.trim() || !body.user_name?.trim()) {
    return c.json({ error: "content and user_name are required" }, 400);
  }

  if (body.content.length > 5000) {
    return c.json({ error: "Comment too long (max 5000 chars)" }, 400);
  }

  // Validate parent_id if provided
  if (body.parent_id) {
    const parent = await c.env.DB.prepare(
      "SELECT id FROM blog_comments WHERE id = ? AND article_slug = ?",
    ).bind(body.parent_id, slug).first();
    if (!parent) {
      return c.json({ error: "Parent comment not found" }, 404);
    }
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO blog_comments (article_slug, user_id, user_name, content, anchor_text, position_selector, parent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, created_at`,
  ).bind(
    slug,
    userId,
    body.user_name.trim(),
    body.content.trim(),
    body.anchor_text ?? null,
    body.position_selector ?? null,
    body.parent_id ?? null,
  ).first<{ id: string; created_at: number }>();

  return c.json(result, 201);
});

/** POST /blog/comments/:commentId/vote — upvote or downvote a comment. */
blogComments.post("/blog/comments/:commentId/vote", authMiddleware, async (c) => {
  const commentId = c.req.param("commentId");
  const userId = c.get("userId");

  const body = await c.req.json<{ vote: number }>();
  if (body.vote !== 1 && body.vote !== -1) {
    return c.json({ error: "vote must be 1 (upvote) or -1 (downvote)" }, 400);
  }

  const comment = await c.env.DB.prepare(
    "SELECT id, user_id, score FROM blog_comments WHERE id = ?",
  ).bind(commentId).first<{ id: string; user_id: string; score: number }>();

  if (!comment) {
    return c.json({ error: "Comment not found" }, 404);
  }

  // Can't vote on own comment
  if (comment.user_id === userId) {
    return c.json({ error: "Cannot vote on your own comment" }, 403);
  }

  // Check for existing vote
  const existingVote = await c.env.DB.prepare(
    "SELECT id, vote FROM blog_comment_votes WHERE comment_id = ? AND user_id = ?",
  ).bind(commentId, userId).first<{ id: string; vote: number }>();

  if (existingVote) {
    if (existingVote.vote === body.vote) {
      return c.json({ error: "Already voted" }, 409);
    }

    // Change vote direction
    const upDelta = body.vote === 1 ? 2 : -2; // Swinging from -1 to +1 or vice versa
    // Calculate delta for downvotes: upDelta means +1 upvote, so downvote delta is opposite
    // Not currently tracked in stats but included for completeness of the calculation.

    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE blog_comment_votes SET vote = ? WHERE id = ?",
      ).bind(body.vote, existingVote.id),
      c.env.DB.prepare(
        "UPDATE blog_comments SET upvotes = upvotes + ?, downvotes = downvotes + ?, score = score + ?, updated_at = ? WHERE id = ?",
      ).bind(
        body.vote === 1 ? 1 : -1,
        body.vote === -1 ? 1 : -1,
        upDelta,
        Date.now(),
        commentId,
      ),
    ]);
  } else {
    // New vote
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO blog_comment_votes (comment_id, user_id, vote) VALUES (?, ?, ?)",
      ).bind(commentId, userId, body.vote),
      c.env.DB.prepare(
        `UPDATE blog_comments SET
          upvotes = upvotes + ?,
          downvotes = downvotes + ?,
          score = score + ?,
          updated_at = ?
        WHERE id = ?`,
      ).bind(
        body.vote === 1 ? 1 : 0,
        body.vote === -1 ? 1 : 0,
        body.vote,
        Date.now(),
        commentId,
      ),
    ]);
  }

  // Check if comment is now overwhelmingly downvoted → ELO penalty for comment author
  const updatedComment = await c.env.DB.prepare(
    "SELECT score FROM blog_comments WHERE id = ?",
  ).bind(commentId).first<{ score: number }>();

  let elopenalty = false;
  if (updatedComment && updatedComment.score <= DOWNVOTE_THRESHOLD) {
    // Only penalize once at the threshold crossing
    const previousScore = updatedComment.score - body.vote;
    if (previousScore > DOWNVOTE_THRESHOLD) {
      await recordEloEvent(c.env.DB, comment.user_id, "abuse_flag", commentId);
      elopenalty = true;
    }
  }

  return c.json({
    score: updatedComment?.score ?? comment.score + body.vote,
    eloPenaltyApplied: elopenalty,
  });
});

/** DELETE /blog/comments/:commentId — delete own comment. */
blogComments.delete("/blog/comments/:commentId", authMiddleware, async (c) => {
  const commentId = c.req.param("commentId");
  const userId = c.get("userId");

  const comment = await c.env.DB.prepare(
    "SELECT user_id FROM blog_comments WHERE id = ?",
  ).bind(commentId).first<{ user_id: string }>();

  if (!comment) {
    return c.json({ error: "Comment not found" }, 404);
  }

  if (comment.user_id !== userId) {
    return c.json({ error: "Can only delete your own comments" }, 403);
  }

  await c.env.DB.prepare("DELETE FROM blog_comments WHERE id = ?").bind(commentId).run();
  return c.json({ deleted: true });
});

export { blogComments };
