/**
 * hn_search — Algolia-powered HN search.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { HNReadClient } from "../clients/hn-read-client.js";
import { errorResult, jsonResult, tryCatch } from "../types.js";

export function registerSearchTools(server: McpServer, readClient: HNReadClient): void {
  server.tool(
    "hn_search",
    "Search HackerNews stories and comments via Algolia",
    {
      query: z.string().min(1).describe("Search query"),
      sortBy: z.enum(["relevance", "date"]).default("relevance").describe("Sort order"),
      tags: z.string().optional().describe('Filter tags (e.g. "story", "comment", "author_pg")'),
      page: z.number().int().min(0).default(0).describe("Page number"),
      hitsPerPage: z.number().int().min(1).max(100).default(20).describe("Results per page"),
      numericFilters: z
        .string()
        .optional()
        .describe('Numeric filters (e.g. "points>100,num_comments>10")'),
    },
    async (params) => {
      const result = await tryCatch(readClient.search(params));
      if (!result.ok) return errorResult("NETWORK_ERROR", result.error.message, true);

      return jsonResult({
        query: params.query,
        totalHits: result.data.nbHits,
        page: result.data.page,
        totalPages: result.data.nbPages,
        hits: result.data.hits.map((h) => ({
          id: h.objectID,
          title: h.title,
          url: h.url,
          author: h.author,
          points: h.points,
          numComments: h.num_comments,
          createdAt: h.created_at,
          tags: h._tags,
          storyText: h.story_text,
          commentText: h.comment_text,
        })),
      });
    },
  );

  server.tool("hn_get_updates", "Get recently changed HN items and profiles", {}, async () => {
    const result = await tryCatch(readClient.getUpdates());
    if (!result.ok) return errorResult("NETWORK_ERROR", result.error.message, true);
    return jsonResult(result.data);
  });
}
