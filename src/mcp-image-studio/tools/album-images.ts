import { z } from "zod";
import {
  asImageId,
  errorResult,
  jsonResult,
  ALBUM_IMAGE_ACTION_VALUES,
  toolEvent,
} from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure, withResolves, withOwnership } from "../tool-builder/image-middleware.js";

export const albumImagesTool = imageProcedure
  .use(withResolves({ album_handle: "album" }))
  .use(withOwnership(["album_handle"]))
  .tool("album_images", "Add or remove images from an album", {
    album_handle: z.string().describe("Handle of the album to modify"),
    action: z.enum(ALBUM_IMAGE_ACTION_VALUES).describe("Action to perform: add or remove images"),
    image_ids: z
      .array(z.string())
      .min(1)
      .max(500)
      .describe("Image IDs to add to or remove from the album"),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { deps } = ctx;
    const album = ctx.entities.album_handle;
    const handle = album.handle;

    if (input.action === "add") {
      const imageIds = input.image_ids.map((id) => asImageId(id));
      const imgRes = await tryCatch(deps.resolvers.resolveImages(imageIds));
      if (!imgRes.ok || !imgRes.data || imgRes.data.length === 0) {
        return errorResult("IMAGES_NOT_FOUND", "One or more images not found or not owned by user");
      }
      const resolvedImages = imgRes.data;

      const maxSortResult = await tryCatch(deps.db.albumImageMaxSortOrder(album.id));
      const maxSort = maxSortResult.ok ? maxSortResult.data : 0;

      const addPromises = resolvedImages.map(async (image, index) => {
        const sortOrder = maxSort + index + 1;
        const addRes = await tryCatch(deps.db.albumImageAdd(album.id, image.id, sortOrder));
        if (!addRes.ok || addRes.data === null) {
          throw new Error("Add failed or duplicate");
        }
        return addRes.data;
      });

      const results = await Promise.allSettled(addPromises);
      const added = results.filter((r) => r.status === "fulfilled").length;

      if (added === 0) {
        return errorResult("ADD_IMAGES_FAILED", "Failed to add images to the album");
      }

      ctx.notify?.(
        toolEvent("album:images_changed", album.handle, { action: "add", count: added }),
      );

      return jsonResult({
        album_handle: album.handle,
        action: "add",
        added,
        skipped_duplicates: input.image_ids.length - added,
      });
    }

    // action === "remove"
    const imageIds = input.image_ids.map((id) => asImageId(id));
    const removedResult = await tryCatch(deps.db.albumImageRemove(album.id, imageIds));
    const removed = removedResult.ok ? removedResult.data : 0;

    // Clear cover if it was one of the removed images
    if (album.coverImageId && input.image_ids.includes(album.coverImageId)) {
      await tryCatch(deps.db.albumUpdate(handle, { coverImageId: null }));
    }

    ctx.notify?.(
      toolEvent("album:images_changed", album.handle, { action: "remove", count: removed }),
    );

    return jsonResult({
      album_handle: album.handle,
      action: "remove",
      removed,
    });
  });

export const albumImages = albumImagesTool.handler;
export const AlbumImagesInputSchema = z.object(albumImagesTool.inputSchema);
export type AlbumImagesInput = Parameters<typeof albumImages>[0];
