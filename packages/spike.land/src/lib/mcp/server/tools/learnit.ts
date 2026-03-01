/**
 * LearnIt Wiki MCP Tools
 *
 * Search topics, explore relationships, and navigate the AI wiki topic graph.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { logger } from "@/lib/logger";
import { freeTool } from "../tool-builder/procedures.js";

const MAX_CONTENT_LENGTH = 4000;

export function registerLearnItTools(
    registry: ToolRegistry,
    _userId: string,
): void {
    registry.registerBuilt(
        freeTool(_userId)
            .tool("learnit_get_topic", "Get a LearnIt wiki topic by slug. Returns title, description, and "
                + "content (truncated to ~4000 chars). Increments view count.", {
                slug: z.string().min(1).describe(
                    "Unique slug of the topic (e.g. 'javascript/closures').",
                ),
            })
            .meta({ category: "learnit", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    slug,
                } = input;

                const prisma = (await import("@/lib/prisma")).default;

                const topic = await prisma.learnItContent.findUnique({
                    where: { slug },
                    select: {
                        id: true,
                        slug: true,
                        title: true,
                        description: true,
                        content: true,
                        parentSlug: true,
                        wikiLinks: true,
                        viewCount: true,
                        status: true,
                        generatedAt: true,
                    },
                });

                if (!topic) {
                    return textResult(
                        `**Error: NOT_FOUND**\nNo topic found with slug "${slug}".\n**Retryable:** false`,
                    );
                }

                // Fire-and-forget view count increment
                prisma.learnItContent
                    .update({ where: { slug }, data: { viewCount: { increment: 1 } } })
                    .catch(err => logger.error("[learnit] Failed to increment view count:", err));

                const truncatedContent = topic.content.length > MAX_CONTENT_LENGTH
                    ? topic.content.slice(0, MAX_CONTENT_LENGTH) + "\n\n...(truncated)"
                    : topic.content;

                let text = `**${topic.title}**\n\n`;
                text += `**Slug:** ${topic.slug}\n`;
                text += `**Status:** ${topic.status}\n`;
                text += `**Description:** ${topic.description}\n`;
                text += `**Views:** ${topic.viewCount}\n`;
                if (topic.parentSlug) {
                    text += `**Parent:** ${topic.parentSlug}\n`;
                }
                if (topic.wikiLinks.length > 0) {
                    text += `**Wiki Links:** ${topic.wikiLinks.join(", ")}\n`;
                }
                text += `\n---\n\n${truncatedContent}`;

                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("learnit_search_topics", "Search published LearnIt topics by title, description, or slug. "
                + "Ordered by popularity (view count).", {
                query: z.string().min(1).describe(
                    "Search query to match against topic title, description, or slug.",
                ),
                limit: z.number().int().min(1).max(50).optional().describe(
                    "Max results (default 10).",
                ),
            })
            .meta({ category: "learnit", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    query,
                    limit = 10,
                } = input;

                const prisma = (await import("@/lib/prisma")).default;

                const topics = await prisma.learnItContent.findMany({
                    where: {
                        status: "PUBLISHED",
                        OR: [
                            { title: { contains: query, mode: "insensitive" } },
                            { description: { contains: query, mode: "insensitive" } },
                            { slug: { contains: query, mode: "insensitive" } },
                        ],
                    },
                    select: {
                        slug: true,
                        title: true,
                        description: true,
                        viewCount: true,
                    },
                    orderBy: { viewCount: "desc" },
                    take: limit,
                });

                if (topics.length === 0) {
                    return textResult(`No topics found matching "${query}".`);
                }

                let text = `**Found ${topics.length} topic(s) matching "${query}":**\n\n`;
                for (const t of topics) {
                    text += `- **${t.title}** (\`${t.slug}\`) — ${t.viewCount} views\n`;
                    text += `  ${t.description.slice(0, 150)}\n\n`;
                }

                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("learnit_get_relations", "Get relationships for a LearnIt topic: related topics, prerequisites, "
                + "children, or parent. Filter by type or get all.", {
                slug: z.string().min(1).describe("Slug of the topic to get relations for."),
                type: z
                    .enum(["related", "prerequisites", "children", "parent"])
                    .optional()
                    .describe("Filter by relation type. Omit to get all types."),
            })
            .meta({ category: "learnit", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    slug,
                    type,
                } = input;

                const prisma = (await import("@/lib/prisma")).default;
                const {
                    getRelatedTopics,
                    getPrerequisites,
                    getChildTopics,
                    getParentTopic,
                } = await import("@/lib/learnit/relation-service");

                const topic = await prisma.learnItContent.findUnique({
                    where: { slug },
                    select: { id: true, title: true },
                });

                if (!topic) {
                    return textResult(
                        `**Error: NOT_FOUND**\nNo topic found with slug "${slug}".\n**Retryable:** false`,
                    );
                }

                let text = `**Relations for "${topic.title}" (\`${slug}\`)**\n\n`;

                if (!type || type === "related") {
                    const related = await getRelatedTopics(topic.id);
                    text += `**Related (${related.length}):**\n`;
                    if (related.length === 0) text += "  (none)\n";
                    for (const r of related) {
                        text += `- ${r.title} (\`${r.slug}\`)\n`;
                    }
                    text += "\n";
                }

                if (!type || type === "prerequisites") {
                    const prereqs = await getPrerequisites(topic.id);
                    text += `**Prerequisites (${prereqs.length}):**\n`;
                    if (prereqs.length === 0) text += "  (none)\n";
                    for (const p of prereqs) {
                        text += `- ${p.title} (\`${p.slug}\`)\n`;
                    }
                    text += "\n";
                }

                if (!type || type === "children") {
                    const children = await getChildTopics(topic.id);
                    text += `**Children (${children.length}):**\n`;
                    if (children.length === 0) text += "  (none)\n";
                    for (const c of children) {
                        text += `- ${c.title} (\`${c.slug}\`)\n`;
                    }
                    text += "\n";
                }

                if (!type || type === "parent") {
                    const parent = await getParentTopic(topic.id);
                    text += `**Parent:** ${parent ? `${parent.title} (\`${parent.slug}\`)` : "(none)"}\n`;
                }

                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("learnit_list_popular", "List the most popular published LearnIt topics by view count.", {
                limit: z.number().int().min(1).max(50).optional().describe(
                    "Max results (default 10).",
                ),
            })
            .meta({ category: "learnit", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    limit = 10,
                } = input;

                const prisma = (await import("@/lib/prisma")).default;

                const topics = await prisma.learnItContent.findMany({
                    where: { status: "PUBLISHED" },
                    select: {
                        slug: true,
                        title: true,
                        description: true,
                        viewCount: true,
                    },
                    orderBy: { viewCount: "desc" },
                    take: limit,
                });

                if (topics.length === 0) {
                    return textResult("No published topics found.");
                }

                let text = `**Top ${topics.length} Topic(s) by Views:**\n\n`;
                for (const t of topics) {
                    text += `- **${t.title}** (\`${t.slug}\`) — ${t.viewCount} views\n`;
                    text += `  ${t.description.slice(0, 120)}\n\n`;
                }

                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("learnit_list_recent", "List the most recently created published LearnIt topics.", {
                limit: z.number().int().min(1).max(50).optional().describe(
                    "Max results (default 10).",
                ),
            })
            .meta({ category: "learnit", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    limit = 10,
                } = input;

                const prisma = (await import("@/lib/prisma")).default;

                const topics = await prisma.learnItContent.findMany({
                    where: { status: "PUBLISHED" },
                    select: {
                        slug: true,
                        title: true,
                        description: true,
                        viewCount: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: "desc" },
                    take: limit,
                });

                if (topics.length === 0) {
                    return textResult("No published topics found.");
                }

                let text = `**${topics.length} Most Recent Topic(s):**\n\n`;
                for (const t of topics) {
                    text += `- **${t.title}** (\`${t.slug}\`)\n`;
                    text += `  ${t.description.slice(0, 120)}\n`;
                    text += `  Created: ${t.createdAt.toISOString()} | Views: ${t.viewCount}\n\n`;
                }

                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("learnit_get_topic_graph", "Get the topic graph around a center topic: parent, children, related, and "
                + "prerequisites in a single call. depth=2 also fetches neighbors' relations (capped at 3).", {
                slug: z.string().min(1).describe("Slug of the center topic."),
                depth: z.number().int().min(1).max(2).optional().describe(
                    "Graph depth: 1=immediate neighbors, 2=neighbors' neighbors (default 1).",
                ),
            })
            .meta({ category: "learnit", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    slug,
                    depth = 1,
                } = input;

                const prisma = (await import("@/lib/prisma")).default;
                const {
                    getRelatedTopics,
                    getPrerequisites,
                    getChildTopics,
                    getParentTopic,
                } = await import("@/lib/learnit/relation-service");

                const topic = await prisma.learnItContent.findUnique({
                    where: { slug },
                    select: { id: true, title: true, slug: true },
                });

                if (!topic) {
                    return textResult(
                        `**Error: NOT_FOUND**\nNo topic found with slug "${slug}".\n**Retryable:** false`,
                    );
                }

                const [parent, children, related, prerequisites] = await Promise.all([
                    getParentTopic(topic.id),
                    getChildTopics(topic.id),
                    getRelatedTopics(topic.id),
                    getPrerequisites(topic.id),
                ]);

                let text = `**Topic Graph: "${topic.title}" (\`${topic.slug}\`)**\n\n`;

                text += `**Parent:** ${parent ? `${parent.title} (\`${parent.slug}\`)` : "(none)"}\n\n`;

                text += `**Children (${children.length}):**\n`;
                if (children.length === 0) text += "  (none)\n";
                for (const c of children) text += `- ${c.title} (\`${c.slug}\`)\n`;
                text += "\n";

                text += `**Related (${related.length}):**\n`;
                if (related.length === 0) text += "  (none)\n";
                for (const r of related) text += `- ${r.title} (\`${r.slug}\`)\n`;
                text += "\n";

                text += `**Prerequisites (${prerequisites.length}):**\n`;
                if (prerequisites.length === 0) text += "  (none)\n";
                for (const p of prerequisites) text += `- ${p.title} (\`${p.slug}\`)\n`;

                if (depth >= 2) {
                    // Expand up to 3 neighbors at depth 2
                    const neighbors = [
                        ...(parent ? [parent] : []),
                        ...children.slice(0, 1),
                        ...related.slice(0, 1),
                    ].slice(0, 3);

                    if (neighbors.length > 0) {
                        text += `\n---\n\n**Depth-2 Expansions (${neighbors.length}):**\n\n`;

                        for (const neighbor of neighbors) {
                            const [nChildren, nRelated] = await Promise.all([
                                getChildTopics(neighbor.id),
                                getRelatedTopics(neighbor.id),
                            ]);

                            text += `**"${neighbor.title}" (\`${neighbor.slug}\`):**\n`;
                            if (nChildren.length > 0) {
                                text += `  Children: ${nChildren.map(c => c.title).join(", ")}\n`;
                            }
                            if (nRelated.length > 0) {
                                text += `  Related: ${nRelated.map(r => r.title).join(", ")}\n`;
                            }
                            text += "\n";
                        }
                    }
                }

                return textResult(text);
            })
    );
}
