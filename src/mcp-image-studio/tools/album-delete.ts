import { z } from "zod";
import { errorResult, jsonResult, toolEvent } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure, withResolves, withOwnership } from "../tool-builder/image-middleware.js";

export const albumDeleteTool = imageProcedure
  .use(withResolves({ album_handle: "album" }))
  .use(withOwnership(["album_handle"]))
  .tool("album_delete", "Delete an album (images are NOT deleted, only removed from album)", {
    album_handle: z.string().describe("Handle of the album to delete"),
    confirm: z.boolean().describe("Must be true to confirm permanent deletion"),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { deps } = ctx;
    const { confirm } = input;

    if (!confirm) {
      return errorResult("CONFIRMATION_REQUIRED", "Set confirm=true to delete the album");
    }

    const album = ctx.entities.album_handle;
    const handle = album.handle;

    const deleteResult = await tryCatch(deps.db.albumDelete(handle));
    if (!deleteResult.ok) {
      return errorResult("DELETE_FAILED", "Failed to delete album");
    }

    ctx.notify?.(toolEvent("album:deleted", album.handle, { name: album.name }));

    return jsonResult({
      deleted: true,
      album_handle: album.handle,
      name: album.name,
    });
  });

export const albumDelete = albumDeleteTool.handler;
export const AlbumDeleteInputSchema = z.object(albumDeleteTool.inputSchema);
export type AlbumDeleteInput = Parameters<typeof albumDelete>[0];
