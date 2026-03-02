import { z } from "zod";
import type { DetailLevel, ImageRow } from "../types.js";
import { errorResult, IMG_DEFAULTS, jsonResult, DETAIL_LEVEL_VALUES } from "../types.js";
import { tryCatch } from "./try-catch.js";
import {
  imageProcedure,
  withResolves,
  withOwnership,
  withCredits,
} from "../tool-builder/image-middleware.js";

export const analyzeTool = imageProcedure
  .use(withResolves({ image_id: "image" }))
  .use(withOwnership(["image_id"]))
  .use(
    withCredits({
      cost: (input, deps) => {
        const includePalette = (input as Record<string, unknown>).include_palette ?? true;
        return 1 + (includePalette && deps.generation.extractPalette ? 1 : 0);
      },
      source: "analyze",
      sourceIdField: "image_id",
    }),
  )
  .tool("analyze", "AI-powered image analysis returning description and optional palette.", {
    image_id: z.string().describe("ID of the image to analyze"),
    detail_level: z
      .enum(DETAIL_LEVEL_VALUES)
      .describe("Level of detail: brief, detailed, or alt_text")
      .optional(),
    include_palette: z.boolean().describe("If true, extract dominant color palette").optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;
    const detailLevel: DetailLevel = input.detail_level ?? IMG_DEFAULTS.describeDetailLevel;
    const includePalette = input.include_palette ?? true;

    // 1. Resolve image
    const image = ctx.entities.image_id;
    const imageId = image.id;

    // 2. Check AI describe availability
    if (!deps.generation.describeImage) {
      return errorResult("NOT_SUPPORTED", "AI image description not supported in this environment");
    }

    // 3. Get AI description
    const descResult = await tryCatch(deps.generation.describeImage({ userId, imageId }));
    if (!descResult.ok) {
      return errorResult("DESCRIPTION_FAILED", descResult.error.message, true);
    }
    if (!descResult.data || descResult.data.error) {
      return errorResult(
        "DESCRIPTION_FAILED",
        descResult.data?.error ?? "Description failed",
        true,
      );
    }

    // 4. Get palette if requested
    let palette: string[] | undefined;
    if (includePalette && deps.generation.extractPalette) {
      const paletteResult = await tryCatch(deps.generation.extractPalette({ userId, imageId }));
      if (paletteResult.ok && paletteResult.data && !paletteResult.data.error) {
        palette = paletteResult.data.palette;
      }
    }

    // 6. Build description
    const description = buildDescription(
      image,
      detailLevel,
      descResult.data.description,
      descResult.data.tags,
    );

    return jsonResult({
      imageId,
      description,
      palette,
      detail_level: detailLevel,
      creditsCost: ctx.billing.creditsCost,
      isAiGenerated: true,
    });
  });

function buildDescription(
  image: ImageRow,
  level: DetailLevel,
  aiDesc: string,
  aiTags: string[],
): string {
  if (level === "brief" || level === "alt_text") return aiDesc;

  return [
    `Image: "${image.name}"`,
    `Dimensions: ${image.originalWidth}x${image.originalHeight}`,
    `Format: ${image.originalFormat}`,
    `Size: ${image.originalSizeBytes} bytes`,
    `AI Tags: ${aiTags.join(", ")}`,
    `AI Description: ${aiDesc}`,
  ].join("\n");
}

export const analyze = analyzeTool.handler;
export const AnalyzeInputSchema = z.object(analyzeTool.inputSchema);
export type AnalyzeInput = Parameters<typeof analyze>[0];
