import { z } from "zod";
import { createProcedure } from "@spike-land-ai/shared/tool-builder";
import { jsonResult, errorResult } from "@spike-land-ai/mcp-server-base";
import { getPosts, getPostBySlug } from "../core/reducers";

const procedure = createProcedure();

export const websiteTools = [
  procedure
    .tool("list_blog_posts", "List available blog posts on spike.land", {
      tag: z.string().optional().describe("Filter by tag"),
      category: z.string().optional().describe("Filter by category"),
      limit: z.number().optional().describe("Max number of posts to return")
    })
    .handler(async ({ input }: { input: { tag?: string; category?: string; limit?: number } }) => {
      const posts = (await getPosts(input)).map(p => ({
        slug: p.slug,
        title: p.title,
        description: p.description,
        date: p.date,
        tags: p.tags
      }));
      return jsonResult({ posts });
    }),

  procedure
    .tool("read_blog_post", "Read the full content of a specific blog post", {
      slug: z.string().describe("The slug of the blog post")
    })
    .handler(async ({ input }: { input: { slug: string } }) => {
      const post = await getPostBySlug(input.slug);
      if (!post) return errorResult("NOT_FOUND", `Post with slug ${input.slug} not found`);
      return jsonResult({ post });
    })
];
