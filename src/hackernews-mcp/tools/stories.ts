/**
 * hn_get_stories — Browse stories by category.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { HNReadClient } from "../clients/hn-read-client.js";
import { errorResult, jsonResult, tryCatch } from "../types.js";

const StoriesSchema = {
  category: z.enum(["top", "new", "best", "ask", "show", "job"]).describe("Story category"),
  limit: z.number().int().min(1).max(100).default(30).describe("Number of stories to fetch"),
};

export function registerStoriesTools(server: McpServer, readClient: HNReadClient): void {
  server.tool(
    "hn_get_stories",
    "Browse HackerNews stories by category (top, new, best, ask, show, job)",
    StoriesSchema,
    async ({ category, limit }) => {
      const result = await tryCatch(readClient.getStories(category, limit));
      if (!result.ok) return errorResult("NETWORK_ERROR", result.error.message, true);

      const stories = result.data;
      return jsonResult({
        category,
        count: stories.length,
        stories: stories.map((s) => ({
          id: s.id,
          title: s.title,
          url: s.url,
          by: s.by,
          score: s.score,
          descendants: s.descendants,
          time: s.time,
        })),
      });
    },
  );
}
