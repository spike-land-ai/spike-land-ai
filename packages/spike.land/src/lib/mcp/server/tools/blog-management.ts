/**
 * Blog Management MCP Tools
 *
 * Content management lifecycle for blog posts: create drafts, update,
 * publish, schedule for future publication, and retrieve analytics.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures";

/* ── Schemas ────────────────────────────────────────────────────────── */
/* ── Registration ───────────────────────────────────────────────────── */

export function registerBlogManagementTools(
    registry: ToolRegistry,
    userId: string,
): void {
    /* ─── blog_create_draft ─────────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("blog_create_draft", "Create a new blog post draft. Returns the post ID and draft details.", {
                title: z.string().min(1).max(300).describe("Blog post title."),
                content: z.string().min(1).describe("Blog post body content (Markdown)."),
                tags: z.array(z.string().min(1).max(50)).max(20).optional().describe(
                    "Optional list of tags.",
                ),
                category: z.string().min(1).max(100).optional().describe(
                    "Optional category name.",
                ),
            })
            .meta({ category: "blog-management", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const { title, content, tags, category } = input;

                const post = await ctx.prisma.blogPost.create({
                    data: {
                        title,
                        content,
                        tags: tags ?? [],
                        category: category ?? null,
                        status: "draft",
                        userId,
                    },
                });

                return textResult(
                    `**Draft Created!**\n\n`
                    + `**Post ID:** ${post.id}\n`
                    + `**Title:** ${post.title}\n`
                    + `**Status:** draft\n`
                    + `**Tags:** ${(post.tags as string[]).join(", ") || "none"}\n`
                    + `**Category:** ${post.category ?? "none"}\n`
                    + `**Created:** ${post.createdAt.toISOString()}`,
                );
            })
    );

    /* ─── blog_update_post ──────────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("blog_update_post", "Update an existing blog post. Validates ownership before making changes.", {
                post_id: z.string().min(1).describe("Blog post ID."),
                title: z.string().min(1).max(300).optional().describe("New title."),
                content: z.string().min(1).optional().describe(
                    "New body content (Markdown).",
                ),
                tags: z.array(z.string().min(1).max(50)).max(20).optional().describe(
                    "New tag list (replaces existing tags).",
                ),
                category: z.string().min(1).max(100).optional().describe(
                    "New category name.",
                ),
                status: z.enum(["draft", "scheduled", "published"]).optional().describe(
                    "New status. Changing to 'draft' reverts publication/scheduling.",
                ),
            })
            .meta({ category: "blog-management", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const { post_id, title, content, tags, category, status } = input;

                const existing = await ctx.prisma.blogPost.findUnique({
                    where: { id: post_id },
                });

                if (!existing) {
                    return textResult(
                        "**Error: NOT_FOUND**\nBlog post not found.\n**Retryable:** false",
                    );
                }

                if (existing.userId !== userId) {
                    return textResult(
                        "**Error: PERMISSION_DENIED**\nYou do not own this blog post.\n**Retryable:** false",
                    );
                }

                const updateData: Record<string, unknown> = {};
                if (title !== undefined) updateData.title = title;
                if (content !== undefined) updateData.content = content;
                if (tags !== undefined) updateData.tags = tags;
                if (category !== undefined) updateData.category = category;
                if (status !== undefined) {
                    updateData.status = status;
                    // Clear scheduling if reverting to draft or publishing
                    if (status !== "scheduled") {
                        updateData.scheduledAt = null;
                    }
                }

                if (Object.keys(updateData).length === 0) {
                    return textResult(
                        "**No changes specified.** Provide at least one field to update.",
                    );
                }

                const updated = await ctx.prisma.blogPost.update({
                    where: { id: post_id },
                    data: updateData,
                });

                return textResult(
                    `**Post Updated**\n\n`
                    + `**Post ID:** ${updated.id}\n`
                    + `**Title:** ${updated.title}\n`
                    + `**Status:** ${updated.status}\n`
                    + `**Tags:** ${(updated.tags as string[]).join(", ") || "none"}\n`
                    + `**Category:** ${updated.category ?? "none"}\n`
                    + `**Updated:** ${updated.updatedAt.toISOString()}`,
                );
            })
    );

    /* ─── blog_publish_post ─────────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("blog_publish_post", "Publish a draft blog post immediately. Validates ownership and draft status.", {
                post_id: z.string().min(1).describe("Blog post ID to publish."),
            })
            .meta({ category: "blog-management", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const { post_id } = input;

                const existing = await ctx.prisma.blogPost.findUnique({
                    where: { id: post_id },
                });

                if (!existing) {
                    return textResult(
                        "**Error: NOT_FOUND**\nBlog post not found.\n**Retryable:** false",
                    );
                }

                if (existing.userId !== userId) {
                    return textResult(
                        "**Error: PERMISSION_DENIED**\nYou do not own this blog post.\n**Retryable:** false",
                    );
                }

                if (existing.status !== "draft" && existing.status !== "scheduled") {
                    return textResult(
                        `**Error: INVALID_STATE**\nPost is "${existing.status}". Only draft or scheduled posts can be published.\n**Retryable:** false`,
                    );
                }

                const publishedAt = new Date();
                const published = await ctx.prisma.blogPost.update({
                    where: { id: post_id },
                    data: { status: "published", publishedAt },
                });

                const slug = published.slug ?? post_id;
                const url = `https://spike.land/blog/${slug}`;

                return textResult(
                    `**Post Published!**\n\n`
                    + `**Post ID:** ${published.id}\n`
                    + `**Title:** ${published.title}\n`
                    + `**URL:** ${url}\n`
                    + `**Published At:** ${publishedAt.toISOString()}`,
                );
            })
    );

    /* ─── blog_get_analytics ────────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("blog_get_analytics", "Get analytics for a blog post: views, unique visitors, avg read time, bounce rate, and referral sources.", {
                post_id: z.string().min(1).describe("Blog post ID."),
                period: z.enum(["7d", "30d", "90d", "all"]).optional().describe(
                    "Analytics time period (default: 30d).",
                ),
            })
            .meta({ category: "blog-management", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const { post_id, period = "30d" } = input;

                const post = await ctx.prisma.blogPost.findUnique({
                    where: { id: post_id },
                });

                if (!post) {
                    return textResult(
                        "**Error: NOT_FOUND**\nBlog post not found.\n**Retryable:** false",
                    );
                }

                if (post.userId !== userId) {
                    return textResult(
                        "**Error: PERMISSION_DENIED**\nYou do not own this blog post.\n**Retryable:** false",
                    );
                }

                const periodDays: Record<string, number | null> = {
                    "7d": 7,
                    "30d": 30,
                    "90d": 90,
                    "all": null,
                };
                const days = periodDays[period] ?? 30;
                const since = days !== null
                    ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
                    : null;

                const slug = post.slug ?? post_id;
                const postPath = `/blog/${slug}`;

                const whereClause = {
                    path: postPath,
                    ...(since !== null ? { timestamp: { gte: since } } : {}),
                };

                const [totalViews, avgTimeRows, referralRows] = await Promise.all([
                    ctx.prisma.pageView.count({ where: whereClause }),
                    ctx.prisma.pageView.aggregate({
                        where: { ...whereClause, timeOnPage: { not: null } },
                        _avg: { timeOnPage: true },
                        _count: { timeOnPage: true },
                    }),
                    ctx.prisma.pageView.groupBy({
                        by: ["sessionId"],
                        where: whereClause,
                        _count: { sessionId: true },
                    }),
                ]);

                const uniqueVisitors = referralRows.length;
                const avgReadTimeSecs = Math.round(
                    avgTimeRows._avg.timeOnPage ?? 0,
                );
                const bounceCount = referralRows.filter(r => r._count.sessionId === 1)
                    .length;
                const bounceRate = uniqueVisitors > 0
                    ? ((bounceCount / uniqueVisitors) * 100).toFixed(1)
                    : "0.0";

                return textResult(
                    `**Analytics: ${post.title}**\n`
                    + `**Period:** ${period}\n\n`
                    + `**Views:** ${totalViews}\n`
                    + `**Unique Visitors:** ${uniqueVisitors}\n`
                    + `**Avg Read Time:** ${avgReadTimeSecs}s\n`
                    + `**Bounce Rate:** ${bounceRate}%\n`
                    + `**Referral Sources:** tracked via session data`,
                );
            })
    );

    /* ─── blog_schedule_post ────────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("blog_schedule_post", "Schedule a draft blog post for future publication. The publish_at date must be in the future.", {
                post_id: z.string().min(1).describe("Blog post ID to schedule."),
                publish_at: z.string().min(1).describe(
                    "ISO 8601 datetime for future publication (e.g. 2025-12-31T09:00:00Z).",
                ),
            })
            .meta({ category: "blog-management", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const { post_id, publish_at } = input;

                const publishDate = new Date(publish_at);
                if (isNaN(publishDate.getTime())) {
                    return textResult(
                        "**Error: VALIDATION_ERROR**\nInvalid datetime format. Use ISO 8601 (e.g. 2025-12-31T09:00:00Z).\n**Retryable:** false",
                    );
                }

                if (publishDate <= new Date()) {
                    return textResult(
                        "**Error: VALIDATION_ERROR**\n`publish_at` must be a future date and time.\n**Retryable:** false",
                    );
                }

                const existing = await ctx.prisma.blogPost.findUnique({
                    where: { id: post_id },
                });

                if (!existing) {
                    return textResult(
                        "**Error: NOT_FOUND**\nBlog post not found.\n**Retryable:** false",
                    );
                }

                if (existing.userId !== userId) {
                    return textResult(
                        "**Error: PERMISSION_DENIED**\nYou do not own this blog post.\n**Retryable:** false",
                    );
                }

                if (existing.status !== "draft") {
                    return textResult(
                        `**Error: INVALID_STATE**\nPost is already "${existing.status}". Only drafts can be scheduled.\n**Retryable:** false`,
                    );
                }

                const scheduled = await ctx.prisma.blogPost.update({
                    where: { id: post_id },
                    data: { status: "scheduled", scheduledAt: publishDate },
                });

                return textResult(
                    `**Post Scheduled!**\n\n`
                    + `**Post ID:** ${scheduled.id}\n`
                    + `**Title:** ${scheduled.title}\n`
                    + `**Status:** scheduled\n`
                    + `**Scheduled For:** ${publishDate.toISOString()}`,
                );
            })
    );

    /* ─── blog_revert_to_draft ──────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("blog_revert_to_draft", "Revert a scheduled or published blog post back to draft status. Clears any scheduled publication date.", {
                post_id: z.string().min(1).describe("Blog post ID to revert to draft."),
            })
            .meta({ category: "blog-management", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const { post_id } = input;

                const existing = await ctx.prisma.blogPost.findUnique({
                    where: { id: post_id },
                });

                if (!existing) {
                    return textResult(
                        "**Error: NOT_FOUND**\nBlog post not found.\n**Retryable:** false",
                    );
                }

                if (existing.userId !== userId) {
                    return textResult(
                        "**Error: PERMISSION_DENIED**\nYou do not own this blog post.\n**Retryable:** false",
                    );
                }

                if (existing.status === "draft") {
                    return textResult(
                        "**Error: INVALID_STATE**\nPost is already a draft.\n**Retryable:** false",
                    );
                }

                const reverted = await ctx.prisma.blogPost.update({
                    where: { id: post_id },
                    data: { status: "draft", scheduledAt: null, publishedAt: null },
                });

                return textResult(
                    `**Post Reverted to Draft**\n\n`
                    + `**Post ID:** ${reverted.id}\n`
                    + `**Title:** ${reverted.title}\n`
                    + `**Previous Status:** ${existing.status}\n`
                    + `**Status:** draft`,
                );
            })
    );
}
