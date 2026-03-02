/**
 * hn_post_comment — Post a comment or reply on HN.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { HNWriteClient } from "../clients/hn-write-client.js";
import { errorResult, jsonResult, tryCatch } from "../types.js";

export function registerCommentTools(server: McpServer, writeClient: HNWriteClient): void {
  server.tool(
    "hn_post_comment",
    "Post a comment or reply on HackerNews (requires login)",
    {
      parentId: z.number().int().positive().describe("ID of the item to reply to"),
      text: z.string().min(1).describe("Comment text"),
    },
    async ({ parentId, text }) => {
      const result = await tryCatch(writeClient.postComment(parentId, text));
      if (!result.ok) return errorResult("NETWORK_ERROR", result.error.message, true);
      if (result.data.success) {
        return jsonResult({ status: "commented", parentId });
      }
      return errorResult(
        result.data.error,
        result.data.message,
        result.data.error === "RATE_LIMITED" || result.data.error === "CSRF_EXPIRED",
      );
    },
  );
}
