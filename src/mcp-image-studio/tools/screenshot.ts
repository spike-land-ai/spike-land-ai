import { z } from "zod";
import type { EnhancementTier } from "../types.js";
import {
  errorResult,
  jsonResult,
  toolEvent,
  SCREENSHOT_DEVICE_VALUES,
  SCREENSHOT_BACKGROUND_VALUES,
} from "../types.js";
import { tryCatch } from "./try-catch.js";
import {
  imageProcedure,
  withResolves,
  withOwnership,
  withCredits,
} from "../tool-builder/image-middleware.js";

export const screenshotTool = imageProcedure
  .use(withResolves({ source_image_id: "image" }))
  .use(withOwnership(["source_image_id"]))
  .use(
    withCredits({
      cost: (input, deps) =>
        deps.credits.calculateGenerationCost({
          tier: ((input as Record<string, unknown>).tier as EnhancementTier) ?? "TIER_1K",
        }),
      source: "screenshot",
      sourceIdField: "source_image_id",
    }),
  )
  .tool("screenshot", "Place a screenshot into a device mockup", {
    source_image_id: z.string().describe("ID of the source image"),
    device: z.enum(SCREENSHOT_DEVICE_VALUES).describe("Device mockup type").optional(),
    background: z.enum(SCREENSHOT_BACKGROUND_VALUES).describe("Background type").optional(),
    tier: z
      .enum(["FREE", "TIER_0_5K", "TIER_1K", "TIER_2K", "TIER_4K"])
      .describe("Enhancement tier for output quality")
      .optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;
    const tier = input.tier ?? "TIER_1K";
    const device = input.device ?? "iphone";
    const background = input.background ?? "gradient";

    const image = ctx.entities.source_image_id;

    const downloadRes = await tryCatch(deps.storage.download(image.originalR2Key));
    if (!downloadRes.ok || !downloadRes.data) {
      return errorResult("DOWNLOAD_FAILED", "Failed to download source image", true);
    }

    const fullPrompt = `Place this screenshot into a ${device} device mockup with a ${background} background.`;

    const jobRes = await tryCatch(
      deps.generation.createModificationJob({
        userId,
        prompt: fullPrompt,
        imageData: downloadRes.data.toString("base64"),
        mimeType: `image/${image.originalFormat}`,
        tier,
      }),
    );

    if (!jobRes.ok) {
      return errorResult("GENERATION_FAILED", jobRes.error.message, true);
    }
    if (!jobRes.data?.success) {
      return errorResult(
        "GENERATION_FAILED",
        jobRes.data?.error ?? "Failed to create screenshot mockup job",
        true,
      );
    }

    ctx.notify?.(
      toolEvent("job:created", jobRes.data.jobId!, {
        tier,
        device,
        background,
        status: "PENDING",
      }),
    );

    return jsonResult({
      jobId: jobRes.data.jobId,
      creditsCost: ctx.billing.creditsCost,
      device,
      background,
      source_image_id: input.source_image_id,
    });
  });

export const screenshot = screenshotTool.handler;
export const ScreenshotInputSchema = z.object(screenshotTool.inputSchema);
export type ScreenshotInput = Parameters<typeof screenshot>[0];
