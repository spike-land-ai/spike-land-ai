import { z } from "zod";
import type { ImageRow } from "../types.js";
import { errorResult, jsonResult, toolEvent } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure, withResolves, withOwnership } from "../tool-builder/image-middleware.js";

export const duplicateTool = imageProcedure
  .use(withResolves({ image_id: "image" }))
  .use(withOwnership(["image_id"]))
  .tool("duplicate", "Clone an image in the library", {
    image_id: z.string().describe("Image ID to duplicate"),
    name: z
      .string()
      .describe('Name for the copy (defaults to "Copy of {original name}")')
      .optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;

    // If ctx doesn't supply _image_id for some reason, standard fails properly
    const image = ctx.entities.image_id as ImageRow;

    // Download original from storage
    const downloadResult = await tryCatch(deps.storage.download(image.originalR2Key));
    if (!downloadResult.ok) {
      return errorResult("DOWNLOAD_FAILED", "Failed to download original image from storage", true);
    }

    const newName = input.name ?? `Copy of ${image.name}`;

    // Upload copy
    const uploadResult = await tryCatch(
      deps.storage.upload(userId, downloadResult.data, {
        filename: newName,
        contentType: image.originalFormat,
      }),
    );
    if (!uploadResult.ok) {
      return errorResult("UPLOAD_FAILED", "Failed to upload duplicated image to storage", true);
    }

    // Create new image record
    const createResult = await tryCatch(
      deps.db.imageCreate({
        userId,
        name: newName,
        description: image.description,
        originalUrl: uploadResult.data.url,
        originalR2Key: uploadResult.data.r2Key,
        originalWidth: image.originalWidth,
        originalHeight: image.originalHeight,
        originalSizeBytes: uploadResult.data.sizeBytes,
        originalFormat: image.originalFormat,
        isPublic: false,
        tags: [...image.tags],
        shareToken: null,
      }),
    );
    if (!createResult.ok) {
      await tryCatch(deps.storage.delete(uploadResult.data.r2Key));
      return errorResult("CREATE_FAILED", "Failed to create image record in database", true);
    }

    const newImage = createResult.data as ImageRow;

    ctx.notify?.(toolEvent("image:created", newImage.id, { name: newImage.name }));

    return jsonResult({
      duplicated: true,
      original_id: image.id,
      new_image: {
        id: newImage.id,
        name: newImage.name,
        url: newImage.originalUrl,
      },
    });
  });

export const duplicate = duplicateTool.handler;
export const DuplicateInputSchema = z.object(duplicateTool.inputSchema);
export type DuplicateInput = Parameters<typeof duplicate>[0];
