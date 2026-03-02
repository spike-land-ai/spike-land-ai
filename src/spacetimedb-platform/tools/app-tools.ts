/**
 * App MCP tools — create, list, get, chat, versions, status, delete, restore.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpacetimePlatformClient } from "../client.js";
import { errorResult, jsonResult } from "../types.js";

export function registerAppTools(server: McpServer, client: SpacetimePlatformClient): void {
  // ─── stdb_create_app ───

  server.tool(
    "stdb_create_app",
    "Create a new app with slug, name, description, and R2 code key",
    {
      slug: z.string().min(1).describe("URL-safe app slug"),
      name: z.string().min(1).describe("App display name"),
      description: z.string().describe("App description"),
      r2CodeKey: z.string().min(1).describe("R2 object key for the app code bundle"),
    },
    async ({ slug, name, description, r2CodeKey }) => {
      try {
        await client.createApp(slug, name, description, r2CodeKey);
        return jsonResult({ created: true, slug });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_list_apps ───

  server.tool(
    "stdb_list_apps",
    "List apps with optional owner filter",
    {
      ownerIdentity: z.string().optional().describe("Filter by owner identity"),
    },
    async ({ ownerIdentity }) => {
      try {
        const apps = client.listApps(ownerIdentity);
        return jsonResult({
          count: apps.length,
          apps: apps.map((a) => ({
            id: a.id.toString(),
            slug: a.slug,
            name: a.name,
            description: a.description,
            status: a.status,
            ownerIdentity: a.ownerIdentity,
            createdAt: a.createdAt.toString(),
          })),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );

  // ─── stdb_get_app ───

  server.tool(
    "stdb_get_app",
    "Get an app by slug",
    {
      slug: z.string().min(1).describe("App slug"),
    },
    async ({ slug }) => {
      try {
        const app = client.getApp(slug);
        if (!app) return errorResult("NOT_FOUND", `App "${slug}" not found`, false);
        return jsonResult({
          id: app.id.toString(),
          slug: app.slug,
          name: app.name,
          description: app.description,
          r2CodeKey: app.r2CodeKey,
          status: app.status,
          ownerIdentity: app.ownerIdentity,
          createdAt: app.createdAt.toString(),
          updatedAt: app.updatedAt.toString(),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );

  // ─── stdb_app_chat ───

  server.tool(
    "stdb_app_chat",
    "Send a chat message in an app's conversation",
    {
      appId: z.string().describe("App ID"),
      role: z.string().min(1).describe("Message role (user, assistant, system)"),
      content: z.string().min(1).describe("Message content"),
    },
    async ({ appId, role, content }) => {
      try {
        await client.sendAppMessage(BigInt(appId), role, content);
        return jsonResult({ sent: true, appId, role });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_list_app_versions ───

  server.tool(
    "stdb_list_app_versions",
    "List all versions of an app",
    {
      appId: z.string().describe("App ID"),
    },
    async ({ appId }) => {
      try {
        const versions = client.listAppVersions(BigInt(appId));
        return jsonResult({
          count: versions.length,
          versions: versions.map((v) => ({
            id: v.id.toString(),
            version: v.version,
            codeHash: v.codeHash,
            changeDescription: v.changeDescription,
            createdAt: v.createdAt.toString(),
          })),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );

  // ─── stdb_update_app_status ───

  server.tool(
    "stdb_update_app_status",
    "Update an app's status",
    {
      appId: z.string().describe("App ID"),
      status: z.string().min(1).describe("New status (active, paused, archived)"),
    },
    async ({ appId, status }) => {
      try {
        await client.updateAppStatus(BigInt(appId), status);
        return jsonResult({ updated: true, appId, status });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_delete_app ───

  server.tool(
    "stdb_delete_app",
    "Soft-delete an app (sets status to deleted)",
    {
      appId: z.string().describe("App ID"),
    },
    async ({ appId }) => {
      try {
        await client.deleteApp(BigInt(appId));
        return jsonResult({ deleted: true, appId });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_restore_app ───

  server.tool(
    "stdb_restore_app",
    "Restore a soft-deleted app",
    {
      appId: z.string().describe("App ID"),
    },
    async ({ appId }) => {
      try {
        await client.restoreApp(BigInt(appId));
        return jsonResult({ restored: true, appId });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );
}
