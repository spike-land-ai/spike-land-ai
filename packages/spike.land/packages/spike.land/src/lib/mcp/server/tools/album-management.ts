/**
 * Album Management MCP Tools
 *
 * Album CRUD, privacy, sharing, and permissions.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const AlbumCreateSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .describe("Album name (max 100 characters)."),
  description: z
    .string()
    .max(500)
    .optional()
    .describe("Optional album description."),
  privacy: z
    .enum(["PRIVATE", "UNLISTED", "PUBLIC"])
    .optional()
    .default("PRIVATE")
    .describe("Album privacy. Default: PRIVATE."),
  default_tier: z
    .enum(["TIER_1K", "TIER_2K", "TIER_4K"])
    .optional()
    .default("TIER_1K")
    .describe("Default enhancement tier. Default: TIER_1K."),
});

const AlbumListSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("Max albums to return. Default: 20."),
});

const AlbumGetSchema = z.object({
  album_id: z.string().min(1).describe("Album ID to retrieve."),
});

const AlbumUpdateSchema = z.object({
  album_id: z.string().min(1).describe("Album ID to update."),
  name: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe("New album name."),
  description: z
    .string()
    .max(500)
    .optional()
    .describe("New description (empty string to clear)."),
  privacy: z
    .enum(["PRIVATE", "UNLISTED", "PUBLIC"])
    .optional()
    .describe("New privacy setting."),
  cover_image_id: z
    .string()
    .nullable()
    .optional()
    .describe("Image ID for cover (must be in album), or null to clear."),
  pipeline_id: z
    .string()
    .nullable()
    .optional()
    .describe("Enhancement pipeline ID, or null to clear."),
  default_tier: z
    .enum(["TIER_1K", "TIER_2K", "TIER_4K"])
    .optional()
    .describe("New default enhancement tier."),
});

const AlbumDeleteSchema = z.object({
  album_id: z.string().min(1).describe("Album ID to delete."),
  confirm: z
    .boolean()
    .describe("Must be true. This action CANNOT be undone."),
});

export function registerAlbumManagementTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "album_create",
    description:
      "Create a new album. Albums organize images into collections with privacy controls.",
    category: "album-management",
    tier: "free",
    inputSchema: AlbumCreateSchema.shape,
    handler: async ({
      name,
      description,
      privacy,
      default_tier,
    }: z.infer<typeof AlbumCreateSchema>): Promise<CallToolResult> =>
      safeToolCall("album_create", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const { nanoid } = await import("nanoid");

        // Get current max sort order for user's albums
        const maxSortOrder = await prisma.album.aggregate({
          where: { userId },
          _max: { sortOrder: true },
        });

        const album = await prisma.album.create({
          data: {
            userId,
            name: name.trim(),
            description: description?.trim() || null,
            privacy,
            defaultTier: default_tier,
            sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
            shareToken: privacy !== "PRIVATE" ? nanoid(12) : null,
          },
        });

        return textResult(
          `**Album Created!**\n\n`
            + `**Name:** ${album.name}\n`
            + `**ID:** ${album.id}\n`
            + `**Privacy:** ${album.privacy}\n`
            + (album.shareToken ? `**Share Token:** ${album.shareToken}\n` : "")
            + `\nUse \`album_images_add\` to add images to this album.`,
        );
      }),
  });

  registry.register({
    name: "album_list",
    description: "List your albums. Returns album IDs needed for all other album tools.",
    category: "album-management",
    tier: "free",
    inputSchema: AlbumListSchema.shape,
    handler: async ({
      limit,
    }: z.infer<typeof AlbumListSchema>): Promise<CallToolResult> =>
      safeToolCall("album_list", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const albums = await prisma.album.findMany({
          where: { userId },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          select: {
            id: true,
            name: true,
            description: true,
            privacy: true,
            coverImageId: true,
            _count: { select: { albumImages: true } },
            createdAt: true,
            updatedAt: true,
          },
          take: limit,
        });

        if (albums.length === 0) {
          return textResult(
            `**My Albums (0)**\n\nNo albums found. Use \`album_create\` to create your first album.`,
          );
        }

        let text = `**My Albums (${albums.length})**\n\n`;
        for (const album of albums) {
          text += `- **${album.name}** (${album.privacy})`;
          text += ` — ID: \`${album.id}\``;
          text += ` | Images: ${album._count.albumImages}`;
          text += `\n`;
        }

        return textResult(text);
      }),
  });

  registry.register({
    name: "album_get",
    description:
      "Get album details with image list. Non-owners can view PUBLIC or UNLISTED albums. Owners also receive the share URL for non-PRIVATE albums.",
    category: "album-management",
    tier: "free",
    inputSchema: AlbumGetSchema.shape,
    handler: async ({
      album_id,
    }: z.infer<typeof AlbumGetSchema>): Promise<CallToolResult> =>
      safeToolCall("album_get", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const album = await prisma.album.findUnique({
          where: { id: album_id },
          include: {
            _count: { select: { albumImages: true } },
          },
        });

        if (!album) {
          return textResult(
            `**Error: ALBUM_NOT_FOUND**\nAlbum '${album_id}' not found.\n**Retryable:** false`,
          );
        }

        const isOwner = album.userId === userId;
        if (!isOwner && album.privacy === "PRIVATE") {
          return textResult(
            `**Error: ALBUM_NOT_FOUND**\nAlbum '${album_id}' not found.\n**Retryable:** false`,
          );
        }

        let text = `**Album: ${album.name}**\n\n`;
        text += `**ID:** ${album.id}\n`;
        text += `**Privacy:** ${album.privacy}\n`;
        text += `**Images:** ${album._count.albumImages}\n`;
        if (album.description) {
          text += `**Description:** ${album.description}\n`;
        }
        if (album.coverImageId) {
          text += `**Cover Image:** ${album.coverImageId}\n`;
        }
        if (isOwner && album.shareToken) {
          text += `**Share Token:** ${album.shareToken}\n`;
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL
            || "https://spike.land";
          text += `**Share URL:** ${baseUrl}/albums/shared/${album.shareToken}\n`;
        }
        text += `**Default Tier:** ${album.defaultTier}\n`;
        text += `**Owner:** ${isOwner ? "You" : "Another user"}\n`;
        text += `**Created:** ${album.createdAt.toISOString()}\n`;

        return textResult(text);
      }),
  });

  registry.register({
    name: "album_update",
    description: "Update album properties. Only the album owner can update. "
      + "Privacy changes generate or remove share tokens automatically.",
    category: "album-management",
    tier: "free",
    inputSchema: AlbumUpdateSchema.shape,
    handler: async ({
      album_id,
      name,
      description,
      privacy,
      cover_image_id,
      pipeline_id,
      default_tier,
    }: z.infer<typeof AlbumUpdateSchema>): Promise<CallToolResult> =>
      safeToolCall("album_update", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const album = await prisma.album.findUnique({
          where: { id: album_id },
          select: { userId: true, shareToken: true },
        });

        if (!album) {
          return textResult(
            `**Error: ALBUM_NOT_FOUND**\nAlbum '${album_id}' not found.\n**Retryable:** false`,
          );
        }

        if (album.userId !== userId) {
          return textResult(
            `**Error: FORBIDDEN**\nYou do not own this album.\n**Retryable:** false`,
          );
        }

        const updateData: Record<string, unknown> = {};

        if (name !== undefined) {
          updateData.name = name.trim();
        }

        if (description !== undefined) {
          updateData.description = description?.trim() || null;
        }

        if (privacy !== undefined) {
          updateData.privacy = privacy;

          // Generate share token when going non-private
          if (privacy !== "PRIVATE" && !album.shareToken) {
            const { nanoid } = await import("nanoid");
            updateData.shareToken = nanoid(12);
          }
          // Remove share token when going private
          if (privacy === "PRIVATE") {
            updateData.shareToken = null;
          }
        }

        if (cover_image_id !== undefined) {
          if (cover_image_id !== null) {
            // Verify image is in the album
            const albumImage = await prisma.albumImage.findFirst({
              where: { albumId: album_id, imageId: cover_image_id },
            });
            if (!albumImage) {
              return textResult(
                `**Error: VALIDATION_ERROR**\nCover image must be in the album.\n**Retryable:** false`,
              );
            }
          }
          updateData.coverImageId = cover_image_id;
        }

        if (pipeline_id !== undefined) {
          if (pipeline_id !== null) {
            const pipeline = await prisma.enhancementPipeline.findUnique({
              where: { id: pipeline_id },
              select: { userId: true, visibility: true },
            });

            if (!pipeline) {
              return textResult(
                `**Error: VALIDATION_ERROR**\nPipeline not found.\n**Retryable:** false`,
              );
            }

            const isOwner = pipeline.userId === userId;
            const isSystemDefault = pipeline.userId === null;
            const isPublic = pipeline.visibility === "PUBLIC";

            if (!isOwner && !isSystemDefault && !isPublic) {
              return textResult(
                `**Error: FORBIDDEN**\nYou don't have access to this pipeline.\n**Retryable:** false`,
              );
            }
          }
          updateData.pipelineId = pipeline_id;
        }

        if (default_tier !== undefined) {
          updateData.defaultTier = default_tier;
        }

        const updated = await prisma.album.update({
          where: { id: album_id },
          data: updateData,
        });

        return textResult(
          `**Album Updated!**\n\n`
            + `**Name:** ${updated.name}\n`
            + `**Privacy:** ${updated.privacy}\n`
            + `**Default Tier:** ${updated.defaultTier}\n`,
        );
      }),
  });

  registry.register({
    name: "album_delete",
    description: "Permanently delete an album. Requires confirm=true. "
      + "Images are NOT deleted, only the album container.",
    category: "album-management",
    tier: "free",
    inputSchema: AlbumDeleteSchema.shape,
    annotations: {
      destructiveHint: true,
    },
    handler: async ({
      album_id,
      confirm,
    }: z.infer<typeof AlbumDeleteSchema>): Promise<CallToolResult> =>
      safeToolCall("album_delete", async () => {
        if (!confirm) {
          return textResult(
            `**Safety Check Failed**\n\n`
              + `You must set confirm=true to delete an album. This action CANNOT be undone.`,
          );
        }

        const prisma = (await import("@/lib/prisma")).default;

        const album = await prisma.album.findUnique({
          where: { id: album_id },
          select: { userId: true, name: true },
        });

        if (!album) {
          return textResult(
            `**Error: ALBUM_NOT_FOUND**\nAlbum '${album_id}' not found.\n**Retryable:** false`,
          );
        }

        if (album.userId !== userId) {
          return textResult(
            `**Error: FORBIDDEN**\nYou do not own this album.\n**Retryable:** false`,
          );
        }

        await prisma.album.delete({ where: { id: album_id } });

        return textResult(
          `**Album Deleted!**\n\nAlbum '${album.name}' has been permanently deleted. Images are still available in your library.`,
        );
      }),
  });
}
