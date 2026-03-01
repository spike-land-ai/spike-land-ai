/**
 * Content MCP tools — pages and blocks CRUD.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpacetimePlatformClient } from "../client.js";
import { errorResult, jsonResult } from "../types.js";

export function registerContentTools(
  server: McpServer,
  client: SpacetimePlatformClient,
): void {
  // ─── stdb_create_page ───

  server.tool(
    "stdb_create_page",
    "Create a new content page",
    {
      slug: z.string().min(1).describe("URL-safe page slug"),
      title: z.string().min(1).describe("Page title"),
      description: z.string().describe("Page description"),
    },
    async ({ slug, title, description }) => {
      try {
        await client.createPage(slug, title, description);
        return jsonResult({ created: true, slug });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_get_page ───

  server.tool(
    "stdb_get_page",
    "Get a page by slug",
    {
      slug: z.string().min(1).describe("Page slug"),
    },
    async ({ slug }) => {
      try {
        const page = client.getPage(slug);
        if (!page) return errorResult("NOT_FOUND", `Page "${slug}" not found`, false);
        return jsonResult({
          id: page.id.toString(),
          slug: page.slug,
          title: page.title,
          description: page.description,
          ownerIdentity: page.ownerIdentity,
          createdAt: page.createdAt.toString(),
          updatedAt: page.updatedAt.toString(),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );

  // ─── stdb_update_page ───

  server.tool(
    "stdb_update_page",
    "Update a page's title and/or description",
    {
      slug: z.string().min(1).describe("Page slug"),
      title: z.string().min(1).optional().describe("New title"),
      description: z.string().optional().describe("New description"),
    },
    async ({ slug, title, description }) => {
      try {
        await client.updatePage(slug, { title, description });
        return jsonResult({ updated: true, slug });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_delete_page ───

  server.tool(
    "stdb_delete_page",
    "Delete a page and its blocks",
    {
      slug: z.string().min(1).describe("Page slug"),
    },
    async ({ slug }) => {
      try {
        await client.deletePage(slug);
        return jsonResult({ deleted: true, slug });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_create_block ───

  server.tool(
    "stdb_create_block",
    "Create a content block within a page",
    {
      pageId: z.string().describe("Page ID"),
      blockType: z.string().min(1).describe("Block type (text, code, image, etc.)"),
      contentJson: z.string().describe("Block content as JSON string"),
      sortOrder: z.number().int().min(0).describe("Sort order within the page"),
    },
    async ({ pageId, blockType, contentJson, sortOrder }) => {
      try {
        await client.createBlock(BigInt(pageId), blockType, contentJson, sortOrder);
        return jsonResult({ created: true, pageId, blockType });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_update_block ───

  server.tool(
    "stdb_update_block",
    "Update a content block",
    {
      blockId: z.string().describe("Block ID"),
      contentJson: z.string().optional().describe("New content JSON"),
      sortOrder: z.number().int().min(0).optional().describe("New sort order"),
    },
    async ({ blockId, contentJson, sortOrder }) => {
      try {
        await client.updateBlock(BigInt(blockId), { contentJson, sortOrder });
        return jsonResult({ updated: true, blockId });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_delete_block ───

  server.tool(
    "stdb_delete_block",
    "Delete a content block",
    {
      blockId: z.string().describe("Block ID"),
    },
    async ({ blockId }) => {
      try {
        await client.deleteBlock(BigInt(blockId));
        return jsonResult({ deleted: true, blockId });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_reorder_blocks ───

  server.tool(
    "stdb_reorder_blocks",
    "Reorder blocks within a page",
    {
      pageId: z.string().describe("Page ID"),
      blockIds: z.array(z.string()).describe("Ordered list of block IDs"),
    },
    async ({ pageId, blockIds }) => {
      try {
        await client.reorderBlocks(BigInt(pageId), blockIds.map((id) => BigInt(id)));
        return jsonResult({ reordered: true, pageId, count: blockIds.length });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );
}
