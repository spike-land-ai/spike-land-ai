/**
 * LearnIt Wiki MCP Tools (CF Workers)
 *
 * Search topics, explore relationships, and navigate the AI wiki topic graph.
 * Ported from spike.land Prisma to Drizzle ORM + D1.
 *
 * Note: These tools use local D1 database schema now.
 */

import { z } from "zod";
import { eq, or, like, desc, and } from "drizzle-orm";
import type { ToolRegistryAdapter } from "../../lazy-imports/types";
import { freeTool } from "../../lazy-imports/procedures-index.ts";
import { safeToolCall, textResult } from "../lib/tool-helpers";
import type { DrizzleDB } from "../../db/db/db-index.ts";
import { learnItContent, learnItRelations } from "../../db/db/schema.ts";

const MAX_CONTENT_LENGTH = 4000;

export function registerLearnItTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "learnit_get_topic",
        "Get a LearnIt wiki topic by slug. Returns title, description, and content (truncated to ~4000 chars). Increments view count.",
        {
          slug: z
            .string()
            .min(1)
            .describe("Unique slug of the topic (e.g. 'javascript/closures')."),
        },
      )
      .meta({ category: "learnit", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("learnit_get_topic", async () => {
          const topicResult = await db
            .select()
            .from(learnItContent)
            .where(
              and(eq(learnItContent.slug, input.slug), eq(learnItContent.status, "published")),
            )
            .limit(1);

          const topic = topicResult[0];

          if (!topic) {
            return textResult(
              `**Error: NOT_FOUND**\nNo topic found with slug "${input.slug}".\n**Retryable:** false`,
            );
          }

          // Fetch parent
          const parentRelationResult = await db
            .select({
              parentSlug: learnItContent.slug,
            })
            .from(learnItRelations)
            .innerJoin(learnItContent, eq(learnItRelations.fromTopicId, learnItContent.id))
            .where(
              and(
                eq(learnItRelations.toTopicId, topic.id),
                eq(learnItRelations.type, "PARENT_CHILD"),
                eq(learnItContent.status, "published"),
              ),
            )
            .limit(1);

          const parentSlug =
            parentRelationResult.length > 0 ? parentRelationResult[0].parentSlug : null;

          // Increment view count
          await db
            .update(learnItContent)
            .set({ viewCount: topic.viewCount + 1 })
            .where(eq(learnItContent.id, topic.id));

          const truncatedContent =
            topic.content.length > MAX_CONTENT_LENGTH
              ? topic.content.slice(0, MAX_CONTENT_LENGTH) + "\n\n...(truncated)"
              : topic.content;

          let text = `**${topic.title}**\n\n`;
          text += `**Slug:** ${topic.slug}\n`;
          text += `**Status:** ${topic.status}\n`;
          text += `**Description:** ${topic.description}\n`;
          text += `**Views:** ${topic.viewCount + 1}\n`; // Include the incremented view
          if (parentSlug) {
            text += `**Parent:** ${parentSlug}\n`;
          }
          text += `\n---\n\n${truncatedContent}`;

          return textResult(text);
        });
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "learnit_search_topics",
        "Search published LearnIt topics by title, description, or slug. Ordered by popularity (view count).",
        {
          query: z
            .string()
            .min(1)
            .describe("Search query to match against topic title, description, or slug."),
          limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)."),
        },
      )
      .meta({ category: "learnit", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("learnit_search_topics", async () => {
          const limit = input.limit ?? 10;
          const searchPattern = `%${input.query}%`;

          const topics = await db
            .select({
              slug: learnItContent.slug,
              title: learnItContent.title,
              description: learnItContent.description,
              viewCount: learnItContent.viewCount,
            })
            .from(learnItContent)
            .where(
              and(
                eq(learnItContent.status, "published"),
                or(
                  like(learnItContent.title, searchPattern),
                  like(learnItContent.description, searchPattern),
                  like(learnItContent.slug, searchPattern),
                ),
              ),
            )
            .orderBy(desc(learnItContent.viewCount))
            .limit(limit);

          if (topics.length === 0) {
            return textResult(`No topics found matching "${input.query}".`);
          }

          let text = `**Found ${topics.length} topic(s) matching "${input.query}":**\n\n`;
          for (const topic of topics) {
            text += `- **${topic.title}** (\`${topic.slug}\`) — ${topic.viewCount} views\n`;
            text += `  ${topic.description.slice(0, 150)}\n\n`;
          }

          return textResult(text);
        });
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "learnit_get_relations",
        "Get relationships for a LearnIt topic: related topics, prerequisites, children, or parent. Filter by type or get all.",
        {
          slug: z.string().min(1).describe("Slug of the topic to get relations for."),
          type: z
            .enum(["related", "prerequisites", "children", "parent"])
            .optional()
            .describe("Filter by relation type. Omit to get all types."),
        },
      )
      .meta({ category: "learnit", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("learnit_get_relations", async () => {
          const topicResult = await db
            .select({ id: learnItContent.id, title: learnItContent.title })
            .from(learnItContent)
            .where(
              and(eq(learnItContent.slug, input.slug), eq(learnItContent.status, "published")),
            )
            .limit(1);

          if (topicResult.length === 0) {
            return textResult(`**Error: NOT_FOUND**\nNo topic found with slug "${input.slug}".`);
          }

          const topic = topicResult[0];

          // Fetch all outgoing relations (children, related, prerequisites)
          const outgoingResult = await db
            .select({
              type: learnItRelations.type,
              title: learnItContent.title,
              slug: learnItContent.slug,
            })
            .from(learnItRelations)
            .innerJoin(learnItContent, eq(learnItRelations.toTopicId, learnItContent.id))
            .where(
              and(
                eq(learnItRelations.fromTopicId, topic.id),
                eq(learnItContent.status, "published"),
              ),
            );

          // Fetch parent
          const incomingResult = await db
            .select({
              type: learnItRelations.type,
              title: learnItContent.title,
              slug: learnItContent.slug,
            })
            .from(learnItRelations)
            .innerJoin(learnItContent, eq(learnItRelations.fromTopicId, learnItContent.id))
            .where(
              and(
                eq(learnItRelations.toTopicId, topic.id),
                eq(learnItContent.status, "published"),
                or(
                  eq(learnItRelations.type, "PARENT_CHILD"),
                  eq(learnItRelations.type, "RELATED"),
                  eq(learnItRelations.type, "PREREQUISITE"),
                ),
              ),
            );

          const result = {
            title: topic.title,
            related: [] as Array<{ title: string; slug: string }>,
            prerequisites: [] as Array<{ title: string; slug: string }>,
            children: [] as Array<{ title: string; slug: string }>,
            parent: null as { title: string; slug: string } | null,
          };

          for (const rel of outgoingResult) {
            if (rel.type === "RELATED") result.related.push({ title: rel.title, slug: rel.slug });
            if (rel.type === "PREREQUISITE")
              result.prerequisites.push({ title: rel.title, slug: rel.slug });
            if (rel.type === "PARENT_CHILD")
              result.children.push({ title: rel.title, slug: rel.slug });
          }

          for (const rel of incomingResult) {
            if (rel.type === "PARENT_CHILD" && !result.parent) {
              result.parent = { title: rel.title, slug: rel.slug };
            }
            if (rel.type === "RELATED" && !result.related.some((r) => r.slug === rel.slug)) {
              result.related.push({ title: rel.title, slug: rel.slug });
            }
            // Prerequisites are directed: if A is prerequisite for B, B is not necessarily prerequisite for A.
          }

          let text = `**Relations for "${result.title}" (\`${input.slug}\`)**\n\n`;

          if (!input.type || input.type === "related") {
            text += `**Related (${result.related.length}):**\n`;
            if (result.related.length === 0) text += "  (none)\n";
            for (const r of result.related) {
              text += `- ${r.title} (\`${r.slug}\`)\n`;
            }
            text += "\n";
          }

          if (!input.type || input.type === "prerequisites") {
            text += `**Prerequisites (${result.prerequisites.length}):**\n`;
            if (result.prerequisites.length === 0) text += "  (none)\n";
            for (const p of result.prerequisites) {
              text += `- ${p.title} (\`${p.slug}\`)\n`;
            }
            text += "\n";
          }

          if (!input.type || input.type === "children") {
            text += `**Children (${result.children.length}):**\n`;
            if (result.children.length === 0) text += "  (none)\n";
            for (const c of result.children) {
              text += `- ${c.title} (\`${c.slug}\`)\n`;
            }
            text += "\n";
          }

          if (!input.type || input.type === "parent") {
            text += `**Parent:** ${
              result.parent ? `${result.parent.title} (\`${result.parent.slug}\`)` : "(none)"
            }\n`;
          }

          return textResult(text);
        });
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "learnit_list_popular",
        "List the most popular published LearnIt topics by view count.",
        {
          limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)."),
        },
      )
      .meta({ category: "learnit", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("learnit_list_popular", async () => {
          const limit = input.limit ?? 10;

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
            .limit(limit);

          if (topics.length === 0) {
            return textResult("No published topics found.");
          }

          let text = `**Top ${topics.length} Topic(s) by Views:**\n\n`;
          for (const topic of topics) {
            text += `- **${topic.title}** (\`${topic.slug}\`) — ${topic.viewCount} views\n`;
            text += `  ${topic.description.slice(0, 120)}\n\n`;
          }

          return textResult(text);
        });
      }),
  );

  registry.registerBuilt(
    t
      .tool("learnit_list_recent", "List the most recently created published LearnIt topics.", {
        limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)."),
      })
      .meta({ category: "learnit", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("learnit_list_recent", async () => {
          const limit = input.limit ?? 10;

          const topics = await db
            .select({
              slug: learnItContent.slug,
              title: learnItContent.title,
              description: learnItContent.description,
              viewCount: learnItContent.viewCount,
              createdAt: learnItContent.createdAt,
            })
            .from(learnItContent)
            .where(eq(learnItContent.status, "published"))
            .orderBy(desc(learnItContent.createdAt))
            .limit(limit);

          if (topics.length === 0) {
            return textResult("No published topics found.");
          }

          let text = `**${topics.length} Most Recent Topic(s):**\n\n`;
          for (const topic of topics) {
            text += `- **${topic.title}** (\`${topic.slug}\`)\n`;
            text += `  ${topic.description.slice(0, 120)}\n`;
            // Quick format date
            const dateStr = new Date(topic.createdAt).toISOString().split("T")[0];
            text += `  Created: ${dateStr} | Views: ${topic.viewCount}\n\n`;
          }

          return textResult(text);
        });
      }),
  );
}
