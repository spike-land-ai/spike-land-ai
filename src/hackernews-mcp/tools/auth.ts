/**
 * hn_login, hn_auth_status — Authentication tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { HNWriteClient } from "../clients/hn-write-client.js";
import type { SessionManager } from "../session/session-manager.js";
import { errorResult, jsonResult, tryCatch } from "../types.js";

export function registerAuthTools(
  server: McpServer,
  writeClient: HNWriteClient,
  session: SessionManager,
): void {
  server.tool(
    "hn_login",
    "Log in to HackerNews (required before submit/vote/comment)",
    {
      username: z.string().min(1).describe("HN username"),
      password: z.string().min(1).describe("HN password"),
    },
    async ({ username, password }) => {
      const result = await tryCatch(writeClient.login(username, password));
      if (!result.ok) return errorResult("NETWORK_ERROR", result.error.message, true);
      if (result.data.success) {
        return jsonResult({ status: "logged_in", username });
      }
      return errorResult(result.data.error, result.data.message);
    },
  );

  server.tool("hn_auth_status", "Check current HN authentication status", {}, async () => {
    const state = session.getState();
    return jsonResult({
      loggedIn: session.isLoggedIn(),
      username: state.username,
      loggedInAt: state.loggedInAt ? new Date(state.loggedInAt).toISOString() : null,
    });
  });
}
