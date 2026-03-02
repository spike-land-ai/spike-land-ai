import { z } from "zod";
import type { EnhancementTier } from "../types.js";
import {
  errorResult,
  IMG_DEFAULTS,
  jsonResult,
  toolEvent,
  ICON_TARGET_VALUES,
  ICON_STYLE_VALUES,
} from "../types.js";
import { tryCatch } from "./try-catch.js";
import {
  imageProcedure,
  withResolves,
  withOwnership,
  withCredits,
} from "../tool-builder/image-middleware.js";

const PLATFORM_SIZES = {
  ios: [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024],
  android: [48, 72, 96, 144, 192, 512],
  favicon: [16, 32, 48],
} as const;

export const iconTool = imageProcedure
  .use(withResolves({ source_image_id: "image" }))
  .use(withOwnership(["source_image_id"]))
  .use(
    withCredits({
      cost: (input, deps) =>
        deps.credits.calculateGenerationCost({
          tier: ((input as Record<string, unknown>).tier as EnhancementTier) ?? "TIER_1K",
        }),
      source: "icon",
    }),
  )
  .tool(
    "icon",
    "Generates an app icon or favicon based on a prompt, target platform, and visual style.",
    {
      prompt: z.string().describe("Description of the desired icon").optional(),
      source_image_id: z.string().describe("Source image to use").optional(),
      target: z
        .enum(ICON_TARGET_VALUES)
        .describe("Target platform: favicon, ios, android, or both")
        .optional(),
      tier: z
        .enum(["FREE", "TIER_0_5K", "TIER_1K", "TIER_2K", "TIER_4K"])
        .describe("Enhancement tier for generation quality")
        .optional(),
      style: z
        .enum(ICON_STYLE_VALUES)
        .describe("Icon style: flat, gradient, outlined, 3d, or pixel")
        .optional(),
    },
  )
  // TODO: validate -> refine
  /* .validate((data) => {
    if (!data.prompt && !data.source_image_id) {
      return errorResult("INVALID_INPUT", "Either prompt or source_image_id is required");
    }
    return;
  }) */
  .handler(async ({ input, ctx }) => {
    if (!input.prompt && !input.source_image_id) {
      return errorResult("INVALID_INPUT", "Either prompt or source_image_id is required");
    }
    const { userId, deps } = ctx;
    const tier = input.tier ?? "TIER_1K";
    const target = input.target ?? "both";
    const style = input.style ?? "flat";

    const isFavicon = target === "favicon";
    const promptPrefix = isFavicon ? IMG_DEFAULTS.promptIconFavicon : IMG_DEFAULTS.promptIconApp;
    const fullPrompt = `${promptPrefix} Style: ${style}. ${input.prompt ?? ""}`.trim();

    // Reference image path
    if (input.source_image_id && deps.generation.createReferenceGenerationJob) {
      const jobRes = await tryCatch(
        deps.generation.createReferenceGenerationJob({
          userId,
          prompt: fullPrompt,
          tier,
          referenceImages: [{ imageId: input.source_image_id, role: "subject" }],
        }),
      );

      if (!jobRes.ok) {
        return errorResult("GENERATION_FAILED", jobRes.error.message, true);
      }
      if (!jobRes.data?.success) {
        return errorResult(
          "GENERATION_FAILED",
          jobRes.data?.error ?? "Failed to create icon job",
          true,
        );
      }

      ctx.notify?.(
        toolEvent("job:created", jobRes.data.jobId!, { tier, target, status: "PENDING" }),
      );
      return jsonResult({
        jobId: jobRes.data.jobId,
        creditsCost: jobRes.data.creditsCost ?? ctx.billing.creditsCost,
        aspect_ratio: "1:1",
        target,
        output_sizes: buildOutputSizes(target),
      });
    }

    // Prompt-only path
    const jobRes = await tryCatch(
      deps.generation.createGenerationJob({
        userId,
        prompt: fullPrompt,
        tier,
        aspectRatio: "1:1",
      }),
    );

    if (!jobRes.ok) {
      return errorResult("GENERATION_FAILED", jobRes.error.message, true);
    }
    if (!jobRes.data?.success) {
      return errorResult(
        "GENERATION_FAILED",
        jobRes.data?.error ?? "Failed to create icon job",
        true,
      );
    }

    ctx.notify?.(toolEvent("job:created", jobRes.data.jobId!, { tier, target, status: "PENDING" }));
    return jsonResult({
      jobId: jobRes.data.jobId,
      creditsCost: jobRes.data.creditsCost ?? ctx.billing.creditsCost,
      aspect_ratio: "1:1",
      target,
      output_sizes: buildOutputSizes(target),
    });
  });

function buildOutputSizes(
  target: "favicon" | "ios" | "android" | "both",
): Record<string, readonly number[]> {
  if (target === "favicon") {
    return { favicon: PLATFORM_SIZES.favicon };
  }
  if (target === "both") {
    return { ios: PLATFORM_SIZES.ios, android: PLATFORM_SIZES.android };
  }
  return { [target]: PLATFORM_SIZES[target] };
}

export const icon = iconTool.handler;
export const IconInputSchema = z.object(iconTool.inputSchema);
export type IconInput = Parameters<typeof icon>[0];
