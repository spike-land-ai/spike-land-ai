import { z } from "zod";

import { errorResult, IMG_DEFAULTS, jsonResult, EXPORT_FORMAT_VALUES } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure, withResolves } from "../tool-builder/image-middleware.js";

export const exportTool = imageProcedure
  .use(withResolves({ image_id: "image" }))
  .tool("export", "Export an image in a specific format and quality", {
    image_id: z.string().describe("ID of the image to export"),
    format: z
      .enum(EXPORT_FORMAT_VALUES)
      .describe("Output format: jpeg, png, webp, or pdf")
      .optional(),
    quality: z.number().describe("Quality level 1-100 (for lossy formats)").optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { deps } = ctx;
    const { format = IMG_DEFAULTS.exportFormat as "jpeg", quality = IMG_DEFAULTS.exportQuality } =
      input;

    const image = ctx.entities.image_id;

    // Verify storage access
    const downloadResult = await tryCatch(deps.storage.download(image.originalR2Key));
    if (!downloadResult.ok) {
      return errorResult("EXPORT_FAILED", "Could not access original image file");
    }

    // For png, quality is not applicable
    const effectiveQuality = format === "png" ? undefined : quality;

    return jsonResult({
      image_id: image.id,
      name: image.name,
      url: image.originalUrl,
      format,
      quality: effectiveQuality,
      originalWidth: image.originalWidth,
      originalHeight: image.originalHeight,
    });
  });

export const exportImage = exportTool.handler;
export const ExportInputSchema = z.object(exportTool.inputSchema);
export type ExportInput = Parameters<typeof exportImage>[0];
