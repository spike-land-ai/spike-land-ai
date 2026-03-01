/**
 * Blog MCP Tools
 *
 * Read-only access to published blog posts (file-based MDX content).
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures.js";

export function registerBlogTools(
    registry: ToolRegistry,
    _userId: string,
): void {
    registry.registerBuilt(
        freeTool(_userId)
            .tool("blog_list_posts", "List published blog posts with optional filters.", {
                category: z.string().optional().describe("Filter by category."),
                tag: z.string().optional().describe("Filter by tag."),
                featured: z.boolean().optional().describe("Filter featured posts only."),
                limit: z.number().int().min(1).max(100).optional().describe(
                    "Max results (default 20).",
                ),
                offset: z.number().int().min(0).optional().describe(
                    "Offset for pagination (default 0).",
                ),
            })
            .meta({ category: "blog", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    category,
                    tag,
                    featured,
                    limit = 20,
                    offset = 0,
                } = input;

                const {
                    getAllPosts,
                    getPostsByCategory,
                    getPostsByTag,
                    getFeaturedPosts,
                } = await import("@/lib/blog/get-posts");

                let posts;
                if (category) {
                    posts = getPostsByCategory(category);
                } else if (tag) {
                    posts = getPostsByTag(tag);
                } else if (featured) {
                    posts = getFeaturedPosts();
                } else {
                    posts = getAllPosts();
                }

                const paginated = posts.slice(offset, offset + limit);
                if (paginated.length === 0) return textResult("No blog posts found.");

                let text = `**Blog Posts (${paginated.length} of ${posts.length}):**\n\n`;
                for (const post of paginated) {
                    text += `- **${post.frontmatter.title}** (${post.slug})\n`
                        + `  ${post.frontmatter.description}\n`
                        + `  Category: ${post.frontmatter.category} | Tags: ${post.frontmatter.tags.join(", ")
                        } | ${post.readingTime}\n`
                        + `  Date: ${post.frontmatter.date}${post.frontmatter.featured ? " | Featured" : ""
                        }\n\n`;
                }
                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("blog_get_post", "Get a blog post by slug with full content.", {
                slug: z.string().min(1).describe("Blog post slug."),
            })
            .meta({ category: "blog", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { slug } = input;

                const { getPostBySlug } = await import("@/lib/blog/get-posts");
                const post = getPostBySlug(slug);
                if (!post) {
                    return textResult(
                        "**Error: NOT_FOUND**\nBlog post not found.\n**Retryable:** false",
                    );
                }

                return textResult(
                    `**${post.frontmatter.title}**\n\n`
                    + `**Slug:** ${post.slug}\n`
                    + `**Author:** ${post.frontmatter.author}\n`
                    + `**Date:** ${post.frontmatter.date}\n`
                    + `**Category:** ${post.frontmatter.category}\n`
                    + `**Tags:** ${post.frontmatter.tags.join(", ")}\n`
                    + `**Reading Time:** ${post.readingTime}\n`
                    + `**Featured:** ${post.frontmatter.featured ? "Yes" : "No"}\n`
                    + `**Excerpt:** ${post.frontmatter.description}\n\n`
                    + `---\n\n${post.content}`,
                );
            })
    );
}
