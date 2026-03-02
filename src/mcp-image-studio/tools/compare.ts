import { z } from "zod";
import { ADVANCED_FEATURE_COSTS, asImageId, errorResult, jsonResult } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure, withCredits } from "../tool-builder/image-middleware.js";

export const compareTool = imageProcedure
  .use(withCredits({ cost: () => ADVANCED_FEATURE_COSTS.compare, source: "compare" }))
  .tool("compare", "AI-powered comparison of two images (use either IDs or URLs for each slot).", {
    image1_id: z.string().describe("First image ID (from library)").optional(),
    image2_id: z.string().describe("Second image ID (from library)").optional(),
    image1_url: z.string().describe("First image URL (external)").optional(),
    image2_url: z.string().describe("Second image URL (external)").optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;

    if (!deps.generation.compareImages) {
      return errorResult("NOT_SUPPORTED", "Image comparison not supported in this environment");
    }

    const img1Src = input.image1_id ? "id" : input.image1_url ? "url" : null;
    const img2Src = input.image2_id ? "id" : input.image2_url ? "url" : null;

    if (!img1Src || !img2Src) {
      return errorResult("INVALID_INPUT", "Must provide an ID or URL for both image 1 and image 2");
    }

    const cost = ctx.billing.creditsCost;

    if (input.image1_id) {
      const res = await tryCatch(deps.resolvers.resolveImage(asImageId(input.image1_id)));
      if (!res.ok || !res.data) {
        return errorResult(
          "IMAGE_NOT_FOUND",
          `Image 1 (${input.image1_id}) not found or not owned by user`,
        );
      }
    }

    if (input.image2_id) {
      const res = await tryCatch(deps.resolvers.resolveImage(asImageId(input.image2_id)));
      if (!res.ok || !res.data) {
        return errorResult(
          "IMAGE_NOT_FOUND",
          `Image 2 (${input.image2_id}) not found or not owned by user`,
        );
      }
    }

    const result = await tryCatch(
      deps.generation.compareImages({
        userId,
        image1Id: input.image1_id ? asImageId(input.image1_id) : undefined,
        image2Id: input.image2_id ? asImageId(input.image2_id) : undefined,
        image1Url: input.image1_url,
        image2Url: input.image2_url,
      }),
    );

    if (!result.ok) {
      return errorResult("COMPARISON_FAILED", result.error.message, true);
    }
    if (!result.data || result.data.error) {
      return errorResult("COMPARISON_FAILED", result.data?.error ?? "Comparison failed", true);
    }

    return jsonResult({
      comparison: result.data.comparison,
      creditsCost: cost,
    });
  });

export const compare = compareTool.handler;
export const CompareInputSchema = z.object(compareTool.inputSchema);
export type CompareInput = Parameters<typeof compare>[0];
