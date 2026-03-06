/**
 * LearnIt Wiki MCP Tools (CF Workers)
 *
 * Search topics, explore relationships, and navigate the AI wiki topic graph.
 * Ported from spike.land Prisma to Drizzle ORM + D1.
 *
 * Note: learnItContent table is not in the D1 schema.
 * These tools proxy to the spike.land API.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../../lazy-imports/types";
import { freeTool } from "../../lazy-imports/procedures-index.ts";
import { apiRequest, safeToolCall, textResult } from "../lib/tool-helpers";
import type { DrizzleDB } from "../../db/db/db-index.ts";

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
          const topic = await apiRequest<{
            id: string;
            slug: string;
            title: string;
            description: string;
            content: string;
            parentSlug: string | null;
            wikiLinks: string[];
            viewCount: number;
            status: string;
          } | null>(`/api/learnit/topics/${encodeURIComponent(input.slug)}`);

          if (!topic) {
            return textResult(
              `**Error: NOT_FOUND**\nNo topic found with slug "${input.slug}".\n**Retryable:** false`,
            );
          }

          const truncatedContent =
            topic.content.length > MAX_CONTENT_LENGTH
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
          const params = new URLSearchParams({ query: input.query });
          if (input.limit !== undefined) {
            params.set("limit", String(input.limit));
          }

          const topics = await apiRequest<
            Array<{
              slug: string;
              title: string;
              description: string;
              viewCount: number;
            }>
          >(`/api/learnit/search?${params.toString()}`);

          if (topics.length === 0) {
            return textResult(`No topics found matching "${input.query}".`);
          }

          let text = `**Found ${topics.length} topic(s) matching "${input.query}":**\n\n`;
          for (const t of topics) {
            text += `- **${t.title}** (\`${t.slug}\`) — ${t.viewCount} views\n`;
            text += `  ${t.description.slice(0, 150)}\n\n`;
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
          const params = new URLSearchParams();
          if (input.type) params.set("type", input.type);

          const result = await apiRequest<{
            title: string;
            related: Array<{ title: string; slug: string }>;
            prerequisites: Array<{ title: string; slug: string }>;
            children: Array<{ title: string; slug: string }>;
            parent: { title: string; slug: string } | null;
          }>(
            `/api/learnit/topics/${encodeURIComponent(input.slug)}/relations?${params.toString()}`,
          );

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
          const params = new URLSearchParams();
          if (input.limit !== undefined) {
            params.set("limit", String(input.limit));
          }

          const topics = await apiRequest<
            Array<{
              slug: string;
              title: string;
              description: string;
              viewCount: number;
            }>
          >(`/api/learnit/popular?${params.toString()}`);

          if (topics.length === 0) {
            return textResult("No published topics found.");
          }

          let text = `**Top ${topics.length} Topic(s) by Views:**\n\n`;
          for (const t of topics) {
            text += `- **${t.title}** (\`${t.slug}\`) — ${t.viewCount} views\n`;
            text += `  ${t.description.slice(0, 120)}\n\n`;
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
          const params = new URLSearchParams();
          if (input.limit !== undefined) {
            params.set("limit", String(input.limit));
          }

          const topics = await apiRequest<
            Array<{
              slug: string;
              title: string;
              description: string;
              viewCount: number;
              createdAt: string;
            }>
          >(`/api/learnit/recent?${params.toString()}`);

          if (topics.length === 0) {
            return textResult("No published topics found.");
          }

          let text = `**${topics.length} Most Recent Topic(s):**\n\n`;
          for (const t of topics) {
            text += `- **${t.title}** (\`${t.slug}\`)\n`;
            text += `  ${t.description.slice(0, 120)}\n`;
            text += `  Created: ${t.createdAt} | Views: ${t.viewCount}\n\n`;
          }

          return textResult(text);
        });
      }),
  );
}
