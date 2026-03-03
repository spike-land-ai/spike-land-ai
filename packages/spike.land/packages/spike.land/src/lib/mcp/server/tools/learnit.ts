/**
 * LearnIt Wiki MCP Tools
 *
 * Search topics, explore relationships, and navigate the AI wiki topic graph.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import { logger } from "@/lib/logger";

const MAX_CONTENT_LENGTH = 4000;

const GetTopicSchema = z.object({
  slug: z.string().min(1).describe(
    "Unique slug of the topic (e.g. 'javascript/closures').",
  ),
});

const SearchTopicsSchema = z.object({
  query: z.string().min(1).describe(
    "Search query to match against topic title, description, or slug.",
  ),
  limit: z.number().int().min(1).max(50).optional().describe(
    "Max results (default 10).",
  ),
});

const GetRelationsSchema = z.object({
  slug: z.string().min(1).describe("Slug of the topic to get relations for."),
  type: z
    .enum(["related", "prerequisites", "children", "parent"])
    .optional()
    .describe("Filter by relation type. Omit to get all types."),
});

const ListTopicsSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().describe(
    "Max results (default 10).",
  ),
});

const GetTopicGraphSchema = z.object({
  slug: z.string().min(1).describe("Slug of the center topic."),
  depth: z.number().int().min(1).max(2).optional().describe(
    "Graph depth: 1=immediate neighbors, 2=neighbors' neighbors (default 1).",
  ),
});

export function registerLearnItTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  registry.register({
    name: "learnit_get_topic",
    description: "Get a LearnIt wiki topic by slug. Returns title, description, and "
      + "content (truncated to ~4000 chars). Increments view count.",
    category: "learnit",
    tier: "free",
    inputSchema: GetTopicSchema.shape,
    handler: async ({
      slug,
    }: z.infer<typeof GetTopicSchema>): Promise<CallToolResult> =>
      safeToolCall("learnit_get_topic", async () => {
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
      }),
  });

  registry.register({
    name: "learnit_search_topics",
    description: "Search published LearnIt topics by title, description, or slug. "
      + "Ordered by popularity (view count).",
    category: "learnit",
    tier: "free",
    inputSchema: SearchTopicsSchema.shape,
    handler: async ({
      query,
      limit = 10,
    }: z.infer<typeof SearchTopicsSchema>): Promise<CallToolResult> =>
      safeToolCall("learnit_search_topics", async () => {
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
      }),
  });

  registry.register({
    name: "learnit_get_relations",
    description: "Get relationships for a LearnIt topic: related topics, prerequisites, "
      + "children, or parent. Filter by type or get all.",
    category: "learnit",
    tier: "free",
    inputSchema: GetRelationsSchema.shape,
    handler: async ({
      slug,
      type,
    }: z.infer<typeof GetRelationsSchema>): Promise<CallToolResult> =>
      safeToolCall("learnit_get_relations", async () => {
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
      }),
  });

  registry.register({
    name: "learnit_list_popular",
    description: "List the most popular published LearnIt topics by view count.",
    category: "learnit",
    tier: "free",
    inputSchema: ListTopicsSchema.shape,
    handler: async ({
      limit = 10,
    }: z.infer<typeof ListTopicsSchema>): Promise<CallToolResult> =>
      safeToolCall("learnit_list_popular", async () => {
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
      }),
  });

  registry.register({
    name: "learnit_list_recent",
    description: "List the most recently created published LearnIt topics.",
    category: "learnit",
    tier: "free",
    inputSchema: ListTopicsSchema.shape,
    handler: async ({
      limit = 10,
    }: z.infer<typeof ListTopicsSchema>): Promise<CallToolResult> =>
      safeToolCall("learnit_list_recent", async () => {
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
      }),
  });

  registry.register({
    name: "learnit_get_topic_graph",
    description: "Get the topic graph around a center topic: parent, children, related, and "
      + "prerequisites in a single call. depth=2 also fetches neighbors' relations (capped at 3).",
    category: "learnit",
    tier: "free",
    inputSchema: GetTopicGraphSchema.shape,
    handler: async ({
      slug,
      depth = 1,
    }: z.infer<typeof GetTopicGraphSchema>): Promise<CallToolResult> =>
      safeToolCall("learnit_get_topic_graph", async () => {
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
      }),
  });
}
