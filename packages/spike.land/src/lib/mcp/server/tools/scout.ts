/**
 * Scout MCP Tools
 *
 * Competitor tracking, benchmarking, topic monitoring, and insights.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { resolveWorkspace, safeToolCall, textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures";

export function registerScoutTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        freeTool(userId)
            .tool("scout_list_competitors", "List tracked competitors in a workspace.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
            })
            .meta({ category: "scout", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("scout_list_competitors", async () => {
                    const workspace = await resolveWorkspace(userId, args.workspace_slug);
                    const competitors = await ctx.prisma.scoutCompetitor.findMany({
                        where: { workspaceId: workspace.id },
                        select: {
                            id: true,
                            name: true,
                            platform: true,
                            handle: true,
                            isActive: true,
                            updatedAt: true,
                        },
                    });
                    if (competitors.length === 0) {
                        return textResult("**Competitors**\n\nNo competitors tracked yet.");
                    }
                    let text = `**Competitors** (${competitors.length})\n\n`;
                    for (const c of competitors) {
                        text += `- **${c.name ?? c.handle}** (${c.platform}) — @${c.handle}\n`;
                        text += `  Active: ${c.isActive} | Updated: ${c.updatedAt.toISOString()}\n`;
                        text += `  ID: \`${c.id}\`\n`;
                    }
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("scout_add_competitor", "Add a new competitor to track in a workspace.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                name: z.string().min(1).describe("Competitor display name."),
                platform: z.string().min(1).describe("Platform (e.g., INSTAGRAM, TWITTER)."),
                handle: z.string().min(1).describe("Competitor handle on the platform."),
            })
            .meta({ category: "scout", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("scout_add_competitor", async () => {
                    const workspace = await resolveWorkspace(userId, args.workspace_slug);
                    const competitor = await ctx.prisma.scoutCompetitor.create({
                        data: {
                            workspaceId: workspace.id,
                            name: args.name,
                            platform: args.platform as
                                | "TWITTER"
                                | "LINKEDIN"
                                | "FACEBOOK"
                                | "INSTAGRAM"
                                | "TIKTOK"
                                | "YOUTUBE"
                                | "DISCORD"
                                | "SNAPCHAT"
                                | "PINTEREST",
                            handle: args.handle,
                        },
                    });
                    return textResult(
                        `**Competitor Added**\n\n`
                        + `**Name:** ${competitor.name}\n`
                        + `**Platform:** ${competitor.platform}\n`
                        + `**Handle:** @${competitor.handle}\n`
                        + `**ID:** \`${competitor.id}\``,
                    );
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("scout_get_benchmark", "Get benchmark comparisons for a workspace, optionally filtered by competitor.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                competitor_id: z.string().optional().describe(
                    "Optional competitor ID to filter benchmarks.",
                ),
            })
            .meta({ category: "scout", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("scout_get_benchmark", async () => {
                    const workspace = await resolveWorkspace(userId, args.workspace_slug);
                    const where: Record<string, unknown> = { workspaceId: workspace.id };
                    if (args.competitor_id) where.competitorId = args.competitor_id;
                    const benchmarks = await ctx.prisma.scoutBenchmark.findMany({
                        where,
                        orderBy: { generatedAt: "desc" },
                        take: 20,
                    });
                    if (benchmarks.length === 0) {
                        return textResult(
                            "**Benchmarks**\n\nNo benchmark data available yet.",
                        );
                    }
                    let text = `**Benchmarks** (${benchmarks.length})\n\n`;
                    text += `| Metric | Your Value | Competitor Value | Difference |\n`;
                    text += `|--------|-----------|-----------------|------------|\n`;
                    for (const b of benchmarks) {
                        const bRecord = b as unknown as Record<string, unknown>;
                        const metric = String(bRecord.metric ?? "unknown");
                        const yours = String(bRecord.yourValue ?? "N/A");
                        const theirs = String(bRecord.competitorValue ?? "N/A");
                        const diff = String(bRecord.difference ?? "N/A");
                        text += `| ${metric} | ${yours} | ${theirs} | ${diff} |\n`;
                    }
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("scout_list_topics", "List trending topics in a workspace ordered by trend score.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                limit: z.number().optional().default(20).describe(
                    "Max topics to return (default 20).",
                ),
            })
            .meta({ category: "scout", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("scout_list_topics", async () => {
                    const workspace = await resolveWorkspace(userId, args.workspace_slug);
                    const topics = await ctx.prisma.scoutTopic.findMany({
                        where: { workspaceId: workspace.id },
                        orderBy: { createdAt: "desc" },
                        take: args.limit,
                        include: { _count: { select: { results: true } } },
                    });
                    if (topics.length === 0) {
                        return textResult("**Topics**\n\nNo topics found.");
                    }
                    let text = `**Topics** (${topics.length})\n\n`;
                    for (const t of topics) {
                        text += `- **${t.name}** — Results: ${t._count.results} | Active: ${t.isActive}\n`;
                    }
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("scout_get_insights", "Get competitive insights for a workspace, optionally filtered by competitor.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                competitor_id: z.string().optional().describe(
                    "Optional competitor ID to filter insights.",
                ),
            })
            .meta({ category: "scout", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("scout_get_insights", async () => {
                    const workspace = await resolveWorkspace(userId, args.workspace_slug);
                    // Get topics for this workspace, optionally filtered
                    const topicWhere: Record<string, unknown> = {
                        workspaceId: workspace.id,
                    };
                    const topics = await ctx.prisma.scoutTopic.findMany({
                        where: topicWhere,
                        select: { id: true },
                    });
                    const topicIds = topics.map(t => t.id);

                    if (topicIds.length === 0) {
                        return textResult(
                            "**Insights**\n\nNo topics found for this workspace.",
                        );
                    }

                    const results = await ctx.prisma.scoutResult.findMany({
                        where: { topicId: { in: topicIds } },
                        orderBy: { foundAt: "desc" },
                        take: 10,
                        include: { topic: { select: { name: true } } },
                    });
                    if (results.length === 0) {
                        return textResult("**Insights**\n\nNo insights available yet.");
                    }
                    let text = `**Scout Results** (${results.length})\n\n`;
                    for (const r of results) {
                        text += `### ${r.topic.name} (${r.platform})\n`;
                        text += `**Author:** ${r.author} | **Found:** ${r.foundAt.toISOString()}\n`;
                        text += `${r.content.slice(0, 200)}${r.content.length > 200 ? "..." : ""}\n`;
                        text += `**Engagement:** ${JSON.stringify(r.engagement)}\n\n`;
                    }
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );
}
