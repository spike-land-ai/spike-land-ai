/**
 * Album Images MCP Tools
 *
 * Image management within albums: add, remove, reorder, list, move between albums.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const AlbumImagesAddSchema = z.object({
  album_id: z.string().min(1).describe("Album ID to add images to."),
  image_ids: z
    .array(z.string().min(1))
    .min(1)
    .max(50)
    .describe("Image IDs to add to the album."),
});

const AlbumImagesRemoveSchema = z.object({
  album_id: z.string().min(1).describe("Album ID to remove images from."),
  image_ids: z
    .array(z.string().min(1))
    .min(1)
    .max(50)
    .describe("Image IDs to remove from the album."),
});

const AlbumImagesReorderSchema = z.object({
  album_id: z.string().min(1).describe("Album ID to reorder images in."),
  image_order: z
    .array(z.string().min(1))
    .min(1)
    .describe("Ordered array of image IDs representing the new sort order."),
});

const AlbumImagesListSchema = z.object({
  album_id: z.string().min(1).describe("Album ID to list images from."),
});

const AlbumImagesMoveSchema = z.object({
  source_album_id: z.string().min(1).describe("Album to move images from."),
  target_album_id: z.string().min(1).describe("Album to move images to."),
  image_ids: z
    .array(z.string().min(1))
    .min(1)
    .max(50)
    .describe("Image IDs to move between albums."),
});

export function registerAlbumImagesTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "album_images_add",
    description: "Add images to an album. Images are appended after the current last image. "
      + "Duplicates are silently skipped.",
    category: "album-images",
    tier: "free",
    inputSchema: AlbumImagesAddSchema.shape,
    handler: async ({
      album_id,
      image_ids,
    }: z.infer<typeof AlbumImagesAddSchema>): Promise<CallToolResult> =>
      safeToolCall("album_images_add", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        // Check album ownership
        const album = await prisma.album.findUnique({
          where: { id: album_id },
          select: { userId: true },
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

        // Verify all images belong to the user
        const images = await prisma.enhancedImage.findMany({
          where: { id: { in: image_ids }, userId },
          select: { id: true },
        });

        if (images.length !== image_ids.length) {
          return textResult(
            `**Error: VALIDATION_ERROR**\nSome images were not found or do not belong to you.\n**Retryable:** false`,
          );
        }

        // Get current max sort order
        const maxSortOrder = await prisma.albumImage.aggregate({
          where: { albumId: album_id },
          _max: { sortOrder: true },
        });

        const baseSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

        // Add images, skipping duplicates (P2002)
        const results: Array<
          { imageId: string; success: boolean; reason?: string; }
        > = [];

        for (let i = 0; i < image_ids.length; i++) {
          const imageId = image_ids[i]!;
          try {
            await prisma.albumImage.create({
              data: {
                albumId: album_id,
                imageId,
                sortOrder: baseSortOrder + i,
              },
            });
            results.push({ imageId, success: true });
          } catch (error: unknown) {
            if (
              error
              && typeof error === "object"
              && "code" in error
              && (error as { code: string; }).code === "P2002"
            ) {
              results.push({
                imageId,
                success: false,
                reason: "already_in_album",
              });
            } else {
              throw error;
            }
          }
        }

        const added = results.filter(r => r.success).length;
        const skipped = results.filter(r => !r.success).length;

        let text = `**Images Added to Album**\n\n`;
        text += `**Added:** ${added}\n`;
        if (skipped > 0) text += `**Skipped (already in album):** ${skipped}\n`;

        return textResult(text);
      }),
  });

  registry.register({
    name: "album_images_remove",
    description:
      "Remove images from an album. If the removed image was the cover, the cover is cleared.",
    category: "album-images",
    tier: "free",
    inputSchema: AlbumImagesRemoveSchema.shape,
    handler: async ({
      album_id,
      image_ids,
    }: z.infer<typeof AlbumImagesRemoveSchema>): Promise<CallToolResult> =>
      safeToolCall("album_images_remove", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const album = await prisma.album.findUnique({
          where: { id: album_id },
          select: { userId: true, coverImageId: true },
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

        const result = await prisma.albumImage.deleteMany({
          where: { albumId: album_id, imageId: { in: image_ids } },
        });

        // Clear cover if removed image was the cover
        if (album.coverImageId && image_ids.includes(album.coverImageId)) {
          await prisma.album.update({
            where: { id: album_id },
            data: { coverImageId: null },
          });
        }

        return textResult(
          `**Images Removed**\n\n**Removed:** ${result.count} image(s) from album.`,
        );
      }),
  });

  registry.register({
    name: "album_images_reorder",
    description:
      "Reorder images in an album. Provide the complete list of image IDs in the desired order.",
    category: "album-images",
    tier: "free",
    inputSchema: AlbumImagesReorderSchema.shape,
    handler: async ({
      album_id,
      image_order,
    }: z.infer<typeof AlbumImagesReorderSchema>): Promise<CallToolResult> =>
      safeToolCall("album_images_reorder", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const album = await prisma.album.findUnique({
          where: { id: album_id },
          select: { userId: true },
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

        // Verify all images are in the album
        const existingCount = await prisma.albumImage.count({
          where: { albumId: album_id, imageId: { in: image_order } },
        });

        if (existingCount !== image_order.length) {
          const missing = image_order.length - existingCount;
          return textResult(
            `**Error: VALIDATION_ERROR**\n${missing} of ${image_order.length} images not found in album.\n**Retryable:** false`,
          );
        }

        await prisma.$transaction(
          image_order.map((imageId: string, index: number) =>
            prisma.albumImage.updateMany({
              where: { albumId: album_id, imageId },
              data: { sortOrder: index },
            })
          ),
        );

        return textResult(
          `**Images Reordered**\n\nSuccessfully reordered ${image_order.length} image(s).`,
        );
      }),
  });

  registry.register({
    name: "album_images_list",
    description: "List all images in an album, sorted by their current order. "
      + "Non-owners can view PUBLIC or UNLISTED albums.",
    category: "album-images",
    tier: "free",
    inputSchema: AlbumImagesListSchema.shape,
    handler: async ({
      album_id,
    }: z.infer<typeof AlbumImagesListSchema>): Promise<CallToolResult> =>
      safeToolCall("album_images_list", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const album = await prisma.album.findUnique({
          where: { id: album_id },
          select: { userId: true, privacy: true, name: true },
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

        const albumImages = await prisma.albumImage.findMany({
          where: { albumId: album_id },
          orderBy: { sortOrder: "asc" },
          include: {
            image: {
              select: {
                id: true,
                name: true,
                originalUrl: true,
                originalWidth: true,
                originalHeight: true,
              },
            },
          },
        });

        if (albumImages.length === 0) {
          return textResult(
            `**Album: ${album.name}** (0 images)\n\nNo images in this album. Use \`album_images_add\` to add images.`,
          );
        }

        let text = `**Album: ${album.name}** (${albumImages.length} images)\n\n`;
        for (const ai of albumImages) {
          text += `- **${ai.image.name}** (${ai.image.originalWidth}x${ai.image.originalHeight})`;
          text += ` — ID: \`${ai.image.id}\`\n`;
        }

        return textResult(text);
      }),
  });

  registry.register({
    name: "album_images_move",
    description: "Move images from one album to another. Removes from source and adds to target. "
      + "Both albums must be owned by you.",
    category: "album-images",
    tier: "free",
    inputSchema: AlbumImagesMoveSchema.shape,
    handler: async ({
      source_album_id,
      target_album_id,
      image_ids,
    }: z.infer<typeof AlbumImagesMoveSchema>): Promise<CallToolResult> =>
      safeToolCall("album_images_move", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        // Verify ownership of both albums
        const [sourceAlbum, targetAlbum] = await Promise.all([
          prisma.album.findUnique({
            where: { id: source_album_id },
            select: { userId: true, coverImageId: true },
          }),
          prisma.album.findUnique({
            where: { id: target_album_id },
            select: { userId: true },
          }),
        ]);

        if (!sourceAlbum) {
          return textResult(
            `**Error: ALBUM_NOT_FOUND**\nSource album '${source_album_id}' not found.\n**Retryable:** false`,
          );
        }

        if (!targetAlbum) {
          return textResult(
            `**Error: ALBUM_NOT_FOUND**\nTarget album '${target_album_id}' not found.\n**Retryable:** false`,
          );
        }

        if (sourceAlbum.userId !== userId || targetAlbum.userId !== userId) {
          return textResult(
            `**Error: FORBIDDEN**\nYou must own both albums.\n**Retryable:** false`,
          );
        }

        // Verify all images belong to the user and are in the source album
        const sourceImages = await prisma.albumImage.findMany({
          where: {
            albumId: source_album_id,
            imageId: { in: image_ids },
            image: { userId }, // Join check for ownership
          },
          select: { imageId: true },
        });

        if (sourceImages.length !== image_ids.length) {
          return textResult(
            `**Error: VALIDATION_ERROR**\nSome images were not found in the source album or do not belong to you.\n**Retryable:** false`,
          );
        }

        // Remove from source
        const removed = await prisma.albumImage.deleteMany({
          where: { albumId: source_album_id, imageId: { in: image_ids } },
        });

        // Clear cover if needed
        if (
          sourceAlbum.coverImageId
          && image_ids.includes(sourceAlbum.coverImageId)
        ) {
          await prisma.album.update({
            where: { id: source_album_id },
            data: { coverImageId: null },
          });
        }

        // Get max sort order in target
        const maxSortOrder = await prisma.albumImage.aggregate({
          where: { albumId: target_album_id },
          _max: { sortOrder: true },
        });

        const baseSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

        // Add to target, skipping duplicates
        let added = 0;
        for (let i = 0; i < image_ids.length; i++) {
          const imageId = image_ids[i]!;
          try {
            await prisma.albumImage.create({
              data: {
                albumId: target_album_id,
                imageId,
                sortOrder: baseSortOrder + i,
              },
            });
            added++;
          } catch (error: unknown) {
            if (
              error
              && typeof error === "object"
              && "code" in error
              && (error as { code: string; }).code === "P2002"
            ) {
              // Already in target album — skip
            } else {
              throw error;
            }
          }
        }

        return textResult(
          `**Images Moved**\n\n`
            + `**Removed from source:** ${removed.count}\n`
            + `**Added to target:** ${added}\n`,
        );
      }),
  });
}
