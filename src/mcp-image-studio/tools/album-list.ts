import { z } from "zod";
import { errorResult, jsonResult, IMG_DEFAULTS } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure } from "../tool-builder/image-middleware.js";

export const albumListTool = imageProcedure
  .tool("album_list", "List your albums with image counts", {
    limit: z.number().max(100).describe("Maximum number of albums to return (max 100)").optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;
    const limit = input.limit ?? IMG_DEFAULTS.listLimit;

    const albumsResult = await tryCatch(deps.db.albumFindMany({ userId, limit }));
    if (!albumsResult.ok) {
      return errorResult("LIST_ALBUMS_FAILED", "Failed to list albums");
    }

    const list = (albumsResult.data ?? []).map((a) => ({
      album_handle: a.handle,
      name: a.name,
      privacy: a.privacy,
      default_tier: a.defaultTier,
      image_count: a._count?.albumImages ?? 0,
      created_at: a.createdAt,
    }));

    return jsonResult({ albums: list, count: list.length });
  });

export const albumList = albumListTool.handler;
export const AlbumListInputSchema = z.object(albumListTool.inputSchema);
export type AlbumListInput = Parameters<typeof albumList>[0];
