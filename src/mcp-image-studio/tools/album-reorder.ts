import { z } from "zod";
import { asImageId, errorResult, jsonResult, toolEvent } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure, withResolves, withOwnership } from "../tool-builder/image-middleware.js";

export const albumReorderTool = imageProcedure
  .use(withResolves({ album_handle: "album" }))
  .use(withOwnership(["album_handle"]))
  .tool("album_reorder", "Reorder images in an album", {
    album_handle: z.string().describe("Album handle"),
    image_ids: z.array(z.string()).min(1).max(500).describe("Image IDs in desired order"),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { deps } = ctx;

    // 2. Resolve album ownership
    const album = ctx.entities.album_handle;

    // 3. Reorder images
    const imageIds = input.image_ids.map((id) => asImageId(id));
    const reorderResult = await tryCatch(deps.db.albumImageReorder(album.id, imageIds));
    if (!reorderResult.ok) {
      return errorResult("REORDER_FAILED", reorderResult.error.message, true);
    }

    ctx.notify?.(
      toolEvent("album:updated", album.handle, {
        action: "reorder",
        image_count: input.image_ids.length,
      }),
    );

    // 4. Return success
    return jsonResult({
      reordered: true,
      album_handle: album.handle,
      image_count: input.image_ids.length,
    });
  });

export const AlbumReorderInputSchema = z.object(albumReorderTool.inputSchema);
export type AlbumReorderInput = Parameters<typeof albumReorderTool.handler>[0];
