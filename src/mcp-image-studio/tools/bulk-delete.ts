import { z } from "zod";
import { errorResult, jsonResult, toolEvent } from "../types.js";
import { processBatch } from "../define-tool.js";
import { tryCatch, DomainError } from "./try-catch.js";
import { imageProcedure, withResolves } from "../tool-builder/image-middleware.js";

export const bulkDeleteTool = imageProcedure
  .use(withResolves({ image_ids: "images" }))
  .tool("bulk_delete", "Delete multiple images from the library", {
    image_ids: z
      .array(z.string().describe("Image ID"))
      .min(1)
      .max(20)
      .describe("IDs of images to delete"),
    confirm: z.boolean().describe("Must be true to confirm permanent deletion"),
  })
  // TODO: validate -> refine
  /* .validate((input) => {
    if (!input.confirm) {
      return errorResult("INVALID_INPUT", "Set confirm=true to delete the images permanently");
    }
    return;
  }) */
  .handler(async ({ input: input, ctx: ctx }) => {
    if (!input.confirm) {
      return errorResult("INVALID_INPUT", "Set confirm=true to delete the images permanently");
    }
    const { deps } = ctx;
    const images = ctx.entities.image_ids;

    if (deps.db.imageDeleteMany && deps.storage.deleteMany) {
      // Bulk optimization
      const r2Keys = images.map((img) => img.originalR2Key);
      const ids = images.map((img) => img.id);

      const storageRes = await tryCatch(deps.storage.deleteMany(r2Keys));
      if (!storageRes.ok) throw new DomainError("STORAGE_ERROR", storageRes.error.message);

      const dbRes = await tryCatch(deps.db.imageDeleteMany(ids));
      if (!dbRes.ok) throw new DomainError("DB_ERROR", dbRes.error.message);

      for (const img of images) {
        ctx.notify?.(toolEvent("image:deleted", img.id, { name: img.name }));
      }

      return jsonResult({ deleted: ids.length, failed: 0, total: ids.length });
    }

    // Fallback to parallel processing
    const { successful, failed } = await processBatch(images, async (image) => {
      const storageResult = await tryCatch(deps.storage.delete(image.originalR2Key));
      if (!storageResult.ok) throw new DomainError("STORAGE_ERROR", "storage deletion failed");

      const dbResult = await tryCatch(deps.db.imageDelete(image.id));
      if (!dbResult.ok) throw new DomainError("DB_ERROR", "db deletion failed");

      ctx.notify?.(toolEvent("image:deleted", image.id, { name: image.name }));
      return image.id;
    });

    return jsonResult({
      deleted: successful.length,
      failed: failed.length,
      total: input.image_ids.length,
    });
  });

export const bulkDelete = bulkDeleteTool.handler;
export const BulkDeleteInputSchema = z.object(bulkDeleteTool.inputSchema);
export type BulkDeleteInput = Parameters<typeof bulkDelete>[0];
