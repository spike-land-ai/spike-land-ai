/**
 * Calendar MCP Tools
 *
 * Schedule posts, manage calendar, detect gaps, and find best posting times.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { resolveWorkspace, safeToolCall, textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures";

export function registerCalendarTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        freeTool(userId)
            .tool("calendar_schedule_post", "Schedule a social media post for a specific date and time.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                content: z.string().min(1).describe("Post content text."),
                account_ids: z.array(z.string().min(1)).min(1).describe(
                    "Array of social account IDs.",
                ),
                scheduled_at: z.string().min(1).describe("ISO 8601 date for scheduling."),
            })
            .meta({ category: "calendar", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("calendar_schedule_post", async () => {
                    await resolveWorkspace(userId, args.workspace_slug);
                    const post = await ctx.prisma.socialPost.create({
                        data: {
                            createdById: userId,
                            content: args.content,
                            status: "SCHEDULED",
                            scheduledAt: new Date(args.scheduled_at),
                        },
                    });
                    await ctx.prisma.scheduledPostAccount.createMany({
                        data: args.account_ids.map(accountId => ({
                            postId: post.id,
                            accountId,
                        })),
                    });
                    return textResult(
                        `**Post Scheduled**\n\n`
                        + `**Post ID:** \`${post.id}\`\n`
                        + `**Scheduled for:** ${args.scheduled_at}\n`
                        + `**Linked accounts:** ${args.account_ids.length}\n`
                        + `**Content preview:** ${args.content.slice(0, 100)}${args.content.length > 100 ? "..." : ""
                        }`,
                    );
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("calendar_list_scheduled", "List scheduled posts in a workspace with optional date range filter.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                from_date: z.string().optional().describe("Start date filter (ISO 8601)."),
                to_date: z.string().optional().describe("End date filter (ISO 8601)."),
                limit: z.number().optional().default(30).describe(
                    "Max posts to return (default 30).",
                ),
            })
            .meta({ category: "calendar", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("calendar_list_scheduled", async () => {
                    const workspace = await resolveWorkspace(userId, args.workspace_slug);
                    const where: Record<string, unknown> = {
                        workspaceId: workspace.id,
                        status: "SCHEDULED",
                    };
                    if (args.from_date || args.to_date) {
                        const scheduledAt: Record<string, Date> = {};
                        if (args.from_date) scheduledAt.gte = new Date(args.from_date);
                        if (args.to_date) scheduledAt.lte = new Date(args.to_date);
                        where.scheduledAt = scheduledAt;
                    }
                    const posts = await ctx.prisma.scheduledPost.findMany({
                        where,
                        orderBy: { scheduledAt: "asc" },
                        take: args.limit,
                    });
                    if (posts.length === 0) {
                        return textResult("**Scheduled Posts**\n\nNo scheduled posts found.");
                    }
                    let text = `**Scheduled Posts** (${posts.length})\n\n`;
                    for (const p of posts) {
                        const pRecord = p as unknown as Record<string, unknown>;
                        const content = String(pRecord.content ?? "");
                        const preview = content.slice(0, 80)
                            + (content.length > 80 ? "..." : "");
                        const scheduledAt = pRecord.scheduledAt;
                        const date = scheduledAt instanceof Date
                            ? scheduledAt.toISOString()
                            : String(scheduledAt ?? "N/A");
                        const status = String(pRecord.status ?? "SCHEDULED");
                        text += `- **${date}** — ${status}\n`;
                        text += `  ${preview}\n`;
                        text += `  ID: \`${String(pRecord.id)}\`\n`;
                    }
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("calendar_cancel_post", "Cancel a scheduled post.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                post_id: z.string().min(1).describe("Scheduled post ID to cancel."),
            })
            .meta({ category: "calendar", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("calendar_cancel_post", async () => {
                    await resolveWorkspace(userId, args.workspace_slug);
                    const post = await ctx.prisma.scheduledPost.findFirst({
                        where: { id: args.post_id, status: "SCHEDULED" },
                    });
                    if (!post) {
                        return textResult(
                            "**Error: NOT_FOUND**\nScheduled post not found or already cancelled.\n**Retryable:** false",
                        );
                    }
                    await ctx.prisma.scheduledPost.update({
                        where: { id: args.post_id },
                        data: { status: "CANCELLED" },
                    });
                    return textResult(
                        `**Post Cancelled**\n\n`
                        + `**Post ID:** \`${args.post_id}\`\n`
                        + `**Status:** CANCELLED`,
                    );
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("calendar_get_best_times", "Get recommended best posting times for a social account.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                account_id: z.string().min(1).describe("Social account ID."),
            })
            .meta({ category: "calendar", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("calendar_get_best_times", async () => {
                    await resolveWorkspace(userId, args.workspace_slug);
                    const recommendations = await ctx.prisma.postingTimeRecommendation.findMany(
                        {
                            where: { accountId: args.account_id },
                            orderBy: { score: "desc" },
                        },
                    );
                    if (recommendations.length === 0) {
                        return textResult(
                            "**Best Times**\n\nNo posting time recommendations available.",
                        );
                    }
                    let text = `**Best Posting Times** (${recommendations.length})\n\n`;
                    text += `| Day | Hour | Score | Reason |\n`;
                    text += `|-----|------|-------|--------|\n`;
                    for (const r of recommendations) {
                        const rRecord = r as unknown as Record<string, unknown>;
                        const day = String(rRecord.day ?? "N/A");
                        const hour = String(rRecord.hour ?? "N/A");
                        const score = String(rRecord.score ?? 0);
                        const reason = String(rRecord.reason ?? "");
                        text += `| ${day} | ${hour} | ${score} | ${reason} |\n`;
                    }
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("calendar_detect_gaps", "Detect days with no scheduled content in the upcoming period.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                days_ahead: z.number().optional().default(7).describe(
                    "Number of days to look ahead (default 7).",
                ),
            })
            .meta({ category: "calendar", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("calendar_detect_gaps", async () => {
                    const workspace = await resolveWorkspace(userId, args.workspace_slug);
                    const now = new Date();
                    const endDate = new Date(now);
                    endDate.setDate(endDate.getDate() + args.days_ahead);
                    const posts = await ctx.prisma.scheduledPost.findMany({
                        where: {
                            workspaceId: workspace.id,
                            status: "SCHEDULED",
                            scheduledAt: { gte: now, lte: endDate },
                        },
                    });
                    const scheduledDates = new Set<string>();
                    for (const p of posts) {
                        const pRecord = p as unknown as Record<string, unknown>;
                        const scheduledAt = pRecord.scheduledAt;
                        if (scheduledAt instanceof Date) {
                            scheduledDates.add(scheduledAt.toISOString().split("T")[0]!);
                        }
                    }
                    const gaps: string[] = [];
                    for (let i = 0; i < args.days_ahead; i++) {
                        const day = new Date(now);
                        day.setDate(day.getDate() + i);
                        const dateStr = day.toISOString().split("T")[0]!;
                        if (!scheduledDates.has(dateStr)) {
                            gaps.push(dateStr);
                        }
                    }
                    if (gaps.length === 0) {
                        return textResult(
                            `**Content Calendar Gap Analysis**\n\n`
                            + `No gaps found in the next ${args.days_ahead} days. All days have scheduled content.`,
                        );
                    }
                    let text = `**Content Calendar Gap Analysis**\n\n`;
                    text += `**${gaps.length} gap(s)** found in the next ${args.days_ahead} days:\n\n`;
                    for (const gap of gaps) {
                        text += `- ${gap} — No content scheduled\n`;
                    }
                    text +=
                        `\n**Recommendation:** Create content for gap dates to maintain posting consistency.`;
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );
}
