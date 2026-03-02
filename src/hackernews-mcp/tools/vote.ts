/**
 * hn_upvote — Upvote a story or comment.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { HNWriteClient } from "../clients/hn-write-client.js";
import { errorResult, jsonResult, tryCatch } from "../types.js";

export function registerVoteTools(server: McpServer, writeClient: HNWriteClient): void {
  server.tool(
    "hn_upvote",
    "Upvote a HackerNews story or comment (requires login)",
    {
      itemId: z.number().int().positive().describe("ID of the item to upvote"),
    },
    async ({ itemId }) => {
      const result = await tryCatch(writeClient.upvote(itemId));
      if (!result.ok) return errorResult("NETWORK_ERROR", result.error.message, true);
      if (result.data.success) {
        return jsonResult({ status: "upvoted", itemId });
      }
      return errorResult(result.data.error, result.data.message, result.data.error === "RATE_LIMITED");
    },
  );
}
