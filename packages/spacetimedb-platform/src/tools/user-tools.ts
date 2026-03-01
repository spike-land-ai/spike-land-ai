/**
 * User MCP tools — register, get, list, update profile.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpacetimePlatformClient } from "../client.js";
import { errorResult, jsonResult } from "../types.js";

export function registerUserTools(
  server: McpServer,
  client: SpacetimePlatformClient,
): void {
  // ─── stdb_register_user ───

  server.tool(
    "stdb_register_user",
    "Register a new user with handle, display name, and email",
    {
      handle: z.string().min(1).describe("Unique user handle"),
      displayName: z.string().min(1).describe("Display name"),
      email: z.string().email().describe("Email address"),
    },
    async ({ handle, displayName, email }) => {
      try {
        await client.registerUser(handle, displayName, email);
        return jsonResult({ success: true, handle });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) {
          return errorResult("NOT_CONNECTED", message, false);
        }
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_get_user ───

  server.tool(
    "stdb_get_user",
    "Get a user by identity",
    {
      identity: z.string().min(1).describe("User identity (hex string)"),
    },
    async ({ identity }) => {
      try {
        const user = client.getUser(identity);
        if (!user) {
          return errorResult("NOT_FOUND", `User "${identity}" not found`, false);
        }
        return jsonResult({
          identity: user.identity,
          handle: user.handle,
          displayName: user.displayName,
          email: user.email,
          online: user.online,
          createdAt: user.createdAt.toString(),
          lastSeen: user.lastSeen.toString(),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) {
          return errorResult("NOT_CONNECTED", message, false);
        }
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );

  // ─── stdb_list_users ───

  server.tool(
    "stdb_list_users",
    "List all registered users",
    {
      onlineOnly: z.boolean().optional().default(false).describe("Only show online users"),
    },
    async ({ onlineOnly }) => {
      try {
        const users = client.listUsers(onlineOnly);
        return jsonResult({
          count: users.length,
          users: users.map((u) => ({
            identity: u.identity,
            handle: u.handle,
            displayName: u.displayName,
            online: u.online,
            lastSeen: u.lastSeen.toString(),
          })),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) {
          return errorResult("NOT_CONNECTED", message, false);
        }
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );

  // ─── stdb_update_profile ───

  server.tool(
    "stdb_update_profile",
    "Update the current user's profile",
    {
      displayName: z.string().min(1).optional().describe("New display name"),
      email: z.string().email().optional().describe("New email address"),
    },
    async ({ displayName, email }) => {
      try {
        await client.updateProfile({ displayName, email });
        return jsonResult({ updated: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) {
          return errorResult("NOT_CONNECTED", message, false);
        }
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );
}
