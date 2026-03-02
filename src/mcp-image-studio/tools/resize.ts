import { z } from "zod";
import type { EnhancementTier } from "../types.js";
import { jsonResult } from "../types.js";
import {
  imageProcedure,
  withResolves,
  withCredits,
  withJob,
} from "../tool-builder/image-middleware.js";

const FIT_VALUES = ["cover", "contain", "fill", "inside", "outside"] as const;

export const resizeTool = imageProcedure
  .use(withResolves({ image_id: "image" }))
  .use(
    withCredits({
      cost: (input, deps) =>
        deps.credits.calculateGenerationCost({
          tier: ((input as Record<string, unknown>).tier as EnhancementTier | undefined) ?? "FREE",
        }),
      source: "resize",
      sourceIdField: "image_id",
    }),
  )
  .use(withJob({ imageIdField: "image_id" }))
  .tool("resize", "Resize an image to specific dimensions with a configurable fit mode.", {
    image_id: z.string().describe("ID of the image to resize"),
    width: z.number().int().min(1).describe("Target width in pixels"),
    height: z.number().int().min(1).describe("Target height in pixels"),
    fit: z.enum(FIT_VALUES).describe("Fit mode").optional(),
    tier: z
      .enum(["FREE", "TIER_0_5K", "TIER_1K", "TIER_2K", "TIER_4K"])
      .describe("Enhancement tier for output quality")
      .optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const tier = (input.tier as EnhancementTier | undefined) ?? "FREE";
    const fit = input.fit ?? "cover";

    return jsonResult({
      jobId: ctx.jobs.currentJob.id,
      type: "resize",
      width: input.width,
      height: input.height,
      fit,
      tier,
      creditsCost: ctx.billing.creditsCost,
      status: ctx.jobs.currentJob.status,
    });
  });

export const resize = resizeTool.handler;
export const ResizeInputSchema = z.object(resizeTool.inputSchema);
export type ResizeInput = Parameters<typeof resize>[0];
