import { z } from "zod";
import { asAlbumHandle, errorResult, jsonResult } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure } from "../tool-builder/image-middleware.js";

export const albumTool = imageProcedure
  .tool("album", "Get album details, optionally including images", {
    album_handle: z.string().describe("Handle of the album to retrieve"),
    include_images: z.boolean().describe("If true, include all images in the album").optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;
    const handle = asAlbumHandle(input.album_handle);

    const albumResult = await tryCatch(deps.db.albumFindByHandle(handle));
    if (!albumResult.ok || !albumResult.data) {
      return errorResult("NOT_FOUND", `Album ${input.album_handle} not found`);
    }

    const a = albumResult.data;
    const isOwner = a.userId === userId;
    if (!isOwner && a.privacy === "PRIVATE") {
      return errorResult("NOT_FOUND", `Album ${input.album_handle} not found`);
    }

    const result: Record<string, unknown> = {
      album_handle: a.handle,
      name: a.name,
      description: a.description,
      privacy: a.privacy,
      default_tier: a.defaultTier,
      cover_image_id: a.coverImageId,
      pipeline_id: a.pipelineId,
      image_count: a._count?.albumImages ?? 0,
      created_at: a.createdAt,
      updated_at: a.updatedAt,
    };

    if (isOwner && a.shareToken) {
      result.share_token = a.shareToken;
      result.share_url = `https://spike.land/pixel/album/${a.shareToken}`;
    }

    if (input.include_images) {
      const imagesResult = await tryCatch(deps.db.albumImageList(a.id));
      if (!imagesResult.ok) {
        return errorResult("LIST_IMAGES_FAILED", "Failed to list images in album");
      }

      const images = imagesResult.data ?? [];
      result.images = images.map((ai) => ({
        image_id: ai.image.id,
        name: ai.image.name,
        url: ai.image.originalUrl,
        width: ai.image.originalWidth,
        height: ai.image.originalHeight,
        sort_order: ai.sortOrder,
        added_at: ai.addedAt,
      }));
    }

    return jsonResult(result);
  });

export const album = albumTool.handler;
export const AlbumInputSchema = z.object(albumTool.inputSchema);
export type AlbumInput = Parameters<typeof album>[0];
