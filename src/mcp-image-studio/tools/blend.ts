import { z } from "zod";
import type { BlendMode, EnhancementTier } from "../types.js";
import { IMG_DEFAULTS, jsonResult, BLEND_MODE_VALUES } from "../types.js";
import {
  imageProcedure,
  withResolves,
  withCredits,
  withJob,
} from "../tool-builder/image-middleware.js";

export const blendTool = imageProcedure
  .use(withResolves({ source_image_id: "image", target_image_id: "image" }))
  .use(
    withCredits({
      cost: (input, deps) =>
        deps.credits.calculateGenerationCost({
          tier: ((input as Record<string, unknown>).tier as EnhancementTier) ?? "FREE",
        }),
      source: "blend",
    }),
  )
  .use(withJob({ imageIdField: "source_image_id" }))
  .tool("blend", "Blend two images together.", {
    source_image_id: z.string().describe("Base image ID"),
    target_image_id: z.string().describe("Image ID to blend on top"),
    blend_mode: z
      .enum(BLEND_MODE_VALUES)
      .describe("Blend mode: overlay, multiply, screen, or dissolve")
      .optional(),
    blend_strength: z.number().describe("Blend strength from 0-100. Defaults to 50").optional(),
    tier: z
      .enum(["FREE", "TIER_0_5K", "TIER_1K", "TIER_2K", "TIER_4K"])
      .describe("Enhancement tier for output quality")
      .optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const {
      blend_mode = IMG_DEFAULTS.blendMode as BlendMode,
      blend_strength = IMG_DEFAULTS.blendStrength,
      tier = IMG_DEFAULTS.tier as EnhancementTier,
    } = input;

    return jsonResult({
      jobId: ctx.jobs.currentJob.id,
      blendMode: blend_mode,
      blendStrength: blend_strength,
      tier,
      creditsCost: ctx.billing.creditsCost,
      status: ctx.jobs.currentJob.status,
    });
  });

export const blend = blendTool.handler;
export const BlendInputSchema = z.object(blendTool.inputSchema);
export type BlendInput = Parameters<typeof blend>[0];
