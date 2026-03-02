import { z } from "zod";
import { errorResult, jsonResult, toolEvent } from "../types.js";
import type { ImageRow, ImageStudioDeps, ToolEvent } from "../types.js";
import { tryCatch } from "./try-catch.js";
import {
  imageProcedure,
  createImageProcedure,
  withResolves,
  withOwnership,
} from "../tool-builder/image-middleware.js";

function createHandler() {
  return async ({
    ctx,
  }: {
    input: { image_id: string; confirm: boolean };
    ctx: {
      deps: ImageStudioDeps;
      entities: { image_id: ImageRow };
      notify?: (event: ToolEvent) => void;
    };
  }) => {
    const image = ctx.entities.image_id;
    const imageId = image.id;

    const storageResult = await tryCatch(ctx.deps.storage.delete(image.originalR2Key));
    if (!storageResult.ok) {
      return errorResult("STORAGE_ERROR", "Failed to delete image from storage");
    }

    const dbResult = await tryCatch(ctx.deps.db.imageDelete(imageId));
    if (!dbResult.ok) {
      return errorResult("DELETE_FAILED", "Failed to delete image from database");
    }

    ctx.notify?.(toolEvent("image:deleted", image.id, { name: image.name }));

    return jsonResult({ deleted: true, image_id: image.id });
  };
}

export const deleteTool = imageProcedure
  .use(withResolves({ image_id: "image" }))
  .use(withOwnership(["image_id"]))
  .tool("delete", "Delete an image from the library", {
    image_id: z.string().describe("ID of the image to delete"),
    confirm: z
      .boolean()
      .refine((val) => val === true, "Set confirm=true to delete the image permanently")
      .describe("Must be true to confirm permanent deletion"),
  })
  .output(z.object({ deleted: z.boolean(), image_id: z.string() }))
  .handler(createHandler());

export const deleteImage = deleteTool.handler;
export const DeleteInputSchema = z.object(deleteTool.inputSchema);
export type DeleteInput = Parameters<typeof deleteImage>[0];

export function createDeleteTool(
  userId: string,
  deps: ImageStudioDeps,
  notify?: (event: ToolEvent) => void,
) {
  return createImageProcedure(userId, deps, notify)
    .use(withResolves({ image_id: "image" }))
    .use(withOwnership(["image_id"]))
    .tool("delete", "Delete an image from the library", {
      image_id: z.string().describe("ID of the image to delete"),
      confirm: z
        .boolean()
        .refine((val) => val === true, "Set confirm=true to delete the image permanently")
        .describe("Must be true to confirm permanent deletion"),
    })
    .output(z.object({ deleted: z.boolean(), image_id: z.string() }))
    .handler(createHandler());
}
