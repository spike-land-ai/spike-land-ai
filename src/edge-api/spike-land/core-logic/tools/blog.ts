/**
 * Blog MCP Tools (CF Workers)
 *
 * Read-only access to published blog posts.
 * Blog content lives on spike.land filesystem (MDX files),
 * so these tools proxy to the spike.land API.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../../lazy-imports/types";
import { freeTool } from "../../lazy-imports/procedures-index.ts";
import { apiRequest, safeToolCall, textResult } from "../lib/tool-helpers";
import type { DrizzleDB } from "../../db/db/db-index.ts";

export function registerBlogTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool("blog_list_posts", "List published blog posts with optional filters.", {
        category: z.string().optional().describe("Filter by category."),
        tag: z.string().optional().describe("Filter by tag."),
        featured: z.boolean().optional().describe("Filter featured posts only."),
        limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)."),
        offset: z.number().int().min(0).optional().describe("Offset for pagination (default 0)."),
      })
      .meta({ category: "blog", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("blog_list_posts", async () => {
          const params = new URLSearchParams();
          if (input.category) params.set("category", input.category);
          if (input.tag) params.set("tag", input.tag);
          if (input.featured) params.set("featured", "true");
          if (input.limit !== undefined) {
            params.set("limit", String(input.limit));
          }
          if (input.offset !== undefined) {
            params.set("offset", String(input.offset));
          }

          const posts = await apiRequest<
            Array<{
              slug: string;
              frontmatter: {
                title: string;
                description: string;
                category: string;
                tags: string[];
                date: string;
                featured: boolean;
              };
              readingTime: string;
            }>
          >(`/api/blog/posts?${params.toString()}`);

          if (posts.length === 0) return textResult("No blog posts found.");

          let text = `**Blog Posts (${posts.length}):**\n\n`;
          for (const post of posts) {
            text +=
              `- **${post.frontmatter.title}** (${post.slug})\n` +
              `  ${post.frontmatter.description}\n` +
              `  Category: ${post.frontmatter.category} | Tags: ${post.frontmatter.tags.join(
                ", ",
              )} | ${post.readingTime}\n` +
              `  Date: ${post.frontmatter.date}${
                post.frontmatter.featured ? " | Featured" : ""
              }\n\n`;
          }
          return textResult(text);
        });
      }),
  );

  registry.registerBuilt(
    t
      .tool("blog_get_post", "Get a blog post by slug with full content.", {
        slug: z.string().min(1).describe("Blog post slug."),
      })
      .meta({ category: "blog", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("blog_get_post", async () => {
          const post = await apiRequest<{
            slug: string;
            content: string;
            readingTime: string;
            frontmatter: {
              title: string;
              author: string;
              date: string;
              category: string;
              tags: string[];
              featured: boolean;
              description: string;
            };
          } | null>(`/api/blog/posts/${input.slug}`);

          if (!post) {
            return textResult("**Error: NOT_FOUND**\nBlog post not found.\n**Retryable:** false");
          }

          return textResult(
            `**${post.frontmatter.title}**\n\n` +
              `**Slug:** ${post.slug}\n` +
              `**Author:** ${post.frontmatter.author}\n` +
              `**Date:** ${post.frontmatter.date}\n` +
              `**Category:** ${post.frontmatter.category}\n` +
              `**Tags:** ${post.frontmatter.tags.join(", ")}\n` +
              `**Reading Time:** ${post.readingTime}\n` +
              `**Featured:** ${post.frontmatter.featured ? "Yes" : "No"}\n` +
              `**Excerpt:** ${post.frontmatter.description}\n\n` +
              `---\n\n${post.content}`,
          );
        });
      }),
  );
}
