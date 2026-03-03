/**
 * Blocks MCP Tools
 *
 * CRUD operations for page blocks (PageBlock model).
 * Validates block content against type-specific Zod schemas.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import type { Prisma } from "@/generated/prisma";

const BLOCK_TYPES = [
  "HERO",
  "FEATURE_GRID",
  "FEATURE_LIST",
  "CTA",
  "TESTIMONIALS",
  "PRICING",
  "STATS",
  "GALLERY",
  "FAQ",
  "FOOTER",
  "COMPARISON_TABLE",
  "APP_GRID",
  "MARKDOWN",
  "CUSTOM_REACT",
] as const;

const AddBlockSchema = z.object({
  pageId: z.string().min(1).describe(
    "ID of the DynamicPage to add the block to.",
  ),
  blockType: z.enum(BLOCK_TYPES).describe("Type of block to add."),
  content: z.record(z.string(), z.unknown()).describe(
    "Block content (validated against the block type schema).",
  ),
  variant: z.string().optional().describe(
    "Optional visual variant for the block.",
  ),
  sortOrder: z.number().int().optional().describe(
    "Position in the page. Auto-assigned if omitted.",
  ),
  isVisible: z.boolean().optional().default(true).describe(
    "Whether the block is visible on the page.",
  ),
});

const UpdateBlockSchema = z.object({
  blockId: z.string().min(1).describe("ID of the PageBlock to update."),
  content: z.record(z.string(), z.unknown()).optional().describe(
    "Updated block content (validated against block type schema).",
  ),
  variant: z.string().optional().describe("Updated visual variant."),
  isVisible: z.boolean().optional().describe("Updated visibility."),
});

const DeleteBlockSchema = z.object({
  blockId: z.string().min(1).describe("ID of the PageBlock to delete."),
});

const ReorderBlocksSchema = z.object({
  pageId: z.string().min(1).describe("ID of the DynamicPage."),
  blockIds: z.array(z.string().min(1)).min(1).describe(
    "Ordered array of block IDs defining the new sort order.",
  ),
});

const ListBlockTypesSchema = z.object({});

const GetBlockSchema = z.object({
  blockId: z.string().min(1).describe("ID of the PageBlock to retrieve."),
});

export function registerBlocksTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  // ── Tool 1: blocks_add ──────────────────────────────────────────────────────

  registry.register({
    name: "blocks_add",
    description:
      "Add a new block to a dynamic page. Content is validated against the block type schema.",
    category: "blocks",
    tier: "free",
    inputSchema: AddBlockSchema.shape,
    handler: async ({
      pageId,
      blockType,
      content,
      variant,
      sortOrder,
      isVisible,
    }: z.infer<typeof AddBlockSchema>): Promise<CallToolResult> =>
      safeToolCall("blocks_add", async () => {
        const { validateBlockContent } = await import(
          "@/lib/dynamic-pages/block-schemas"
        );

        const validation = validateBlockContent(blockType, content);
        if (!validation.success) {
          return textResult(
            `**Error: VALIDATION_ERROR**\nInvalid content for block type ${blockType}: ${validation.error}\n**Retryable:** false`,
          );
        }

        const prisma = (await import("@/lib/prisma")).default;

        let resolvedSortOrder = sortOrder;
        if (resolvedSortOrder === undefined) {
          const maxBlock = await prisma.pageBlock.findFirst({
            where: { pageId },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
          });
          resolvedSortOrder = maxBlock ? maxBlock.sortOrder + 1 : 0;
        }

        const block = await prisma.pageBlock.create({
          data: {
            pageId,
            blockType,
            content: validation.data as Prisma.InputJsonValue,
            variant: variant ?? null,
            sortOrder: resolvedSortOrder,
            isVisible: isVisible ?? true,
          },
        });

        return textResult(
          `**Block Created**\n\n`
            + `**ID:** ${block.id}\n`
            + `**Page ID:** ${block.pageId}\n`
            + `**Type:** ${block.blockType}\n`
            + `**Variant:** ${block.variant ?? "none"}\n`
            + `**Sort Order:** ${block.sortOrder}\n`
            + `**Visible:** ${block.isVisible ? "Yes" : "No"}\n`
            + `**Created:** ${block.createdAt.toISOString()}`,
        );
      }),
  });

  // ── Tool 2: blocks_update ───────────────────────────────────────────────────

  registry.register({
    name: "blocks_update",
    description:
      "Update an existing page block. If content is provided, it is validated against the block's type schema.",
    category: "blocks",
    tier: "free",
    inputSchema: UpdateBlockSchema.shape,
    handler: async ({
      blockId,
      content,
      variant,
      isVisible,
    }: z.infer<typeof UpdateBlockSchema>): Promise<CallToolResult> =>
      safeToolCall("blocks_update", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const existing = await prisma.pageBlock.findUnique({
          where: { id: blockId },
        });

        if (!existing) {
          return textResult(
            `**Error: NOT_FOUND**\nBlock with ID "${blockId}" not found.\n**Retryable:** false`,
          );
        }

        if (content !== undefined) {
          const { validateBlockContent } = await import(
            "@/lib/dynamic-pages/block-schemas"
          );
          const validation = validateBlockContent(existing.blockType, content);
          if (!validation.success) {
            return textResult(
              `**Error: VALIDATION_ERROR**\nInvalid content for block type ${existing.blockType}: ${validation.error}\n**Retryable:** false`,
            );
          }
        }

        const updateData: Prisma.PageBlockUpdateInput = {};
        if (content !== undefined) {
          updateData.content = content as Prisma.InputJsonValue;
        }
        if (variant !== undefined) {
          updateData.variant = variant;
        }
        if (isVisible !== undefined) {
          updateData.isVisible = isVisible;
        }

        const updated = await prisma.pageBlock.update({
          where: { id: blockId },
          data: updateData,
        });

        return textResult(
          `**Block Updated**\n\n`
            + `**ID:** ${updated.id}\n`
            + `**Page ID:** ${updated.pageId}\n`
            + `**Type:** ${updated.blockType}\n`
            + `**Variant:** ${updated.variant ?? "none"}\n`
            + `**Sort Order:** ${updated.sortOrder}\n`
            + `**Visible:** ${updated.isVisible ? "Yes" : "No"}\n`
            + `**Updated:** ${updated.updatedAt.toISOString()}`,
        );
      }),
  });

  // ── Tool 3: blocks_delete ───────────────────────────────────────────────────

  registry.register({
    name: "blocks_delete",
    description: "Delete a page block by ID.",
    category: "blocks",
    tier: "free",
    inputSchema: DeleteBlockSchema.shape,
    handler: async ({
      blockId,
    }: z.infer<typeof DeleteBlockSchema>): Promise<CallToolResult> =>
      safeToolCall("blocks_delete", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        await prisma.pageBlock.delete({
          where: { id: blockId },
        });

        return textResult(
          `**Block Deleted**\n\nBlock "${blockId}" has been permanently removed.`,
        );
      }),
  });

  // ── Tool 4: blocks_reorder ──────────────────────────────────────────────────

  registry.register({
    name: "blocks_reorder",
    description: "Reorder blocks on a page by providing an ordered array of block IDs.",
    category: "blocks",
    tier: "free",
    inputSchema: ReorderBlocksSchema.shape,
    handler: async ({
      pageId,
      blockIds,
    }: z.infer<typeof ReorderBlocksSchema>): Promise<CallToolResult> =>
      safeToolCall("blocks_reorder", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        await prisma.$transaction(
          blockIds.map((id, index) =>
            prisma.pageBlock.update({
              where: { id },
              data: { sortOrder: index },
            })
          ),
        );

        return textResult(
          `**Blocks Reordered**\n\n`
            + `**Page ID:** ${pageId}\n`
            + `**New Order:**\n`
            + blockIds.map((id, i) => `  ${i}: ${id}`).join("\n"),
        );
      }),
  });

  // ── Tool 5: blocks_list_types ───────────────────────────────────────────────

  registry.register({
    name: "blocks_list_types",
    description: "List all available block types with descriptions.",
    category: "blocks",
    tier: "free",
    inputSchema: ListBlockTypesSchema.shape,
    handler: async (
      _params: z.infer<typeof ListBlockTypesSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("blocks_list_types", async () => {
        const { getBlockTypeDescriptions } = await import(
          "@/lib/dynamic-pages/block-schemas"
        );
        const descriptions = getBlockTypeDescriptions();

        let text = "**Available Block Types:**\n\n";
        for (const [type, description] of Object.entries(descriptions)) {
          text += `- **${type}**: ${description}\n`;
        }

        return textResult(text);
      }),
  });

  // ── Tool 6: blocks_get ──────────────────────────────────────────────────────

  registry.register({
    name: "blocks_get",
    description: "Get a page block by ID with full details.",
    category: "blocks",
    tier: "free",
    inputSchema: GetBlockSchema.shape,
    handler: async ({
      blockId,
    }: z.infer<typeof GetBlockSchema>): Promise<CallToolResult> =>
      safeToolCall("blocks_get", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const block = await prisma.pageBlock.findUnique({
          where: { id: blockId },
        });

        if (!block) {
          return textResult(
            `**Error: NOT_FOUND**\nBlock with ID "${blockId}" not found.\n**Retryable:** false`,
          );
        }

        return textResult(
          `**Block Details**\n\n`
            + `**ID:** ${block.id}\n`
            + `**Page ID:** ${block.pageId}\n`
            + `**Type:** ${block.blockType}\n`
            + `**Variant:** ${block.variant ?? "none"}\n`
            + `**Sort Order:** ${block.sortOrder}\n`
            + `**Visible:** ${block.isVisible ? "Yes" : "No"}\n`
            + `**Created:** ${block.createdAt.toISOString()}\n`
            + `**Updated:** ${block.updatedAt.toISOString()}\n\n`
            + `**Content:**\n\`\`\`json\n${JSON.stringify(block.content, null, 2)}\n\`\`\``,
        );
      }),
  });
}
