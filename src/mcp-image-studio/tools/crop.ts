import { z } from "zod";
import { IMG_DEFAULTS, jsonResult } from "../types.js";
import {
  imageProcedure,
  withResolves,
  withCredits,
  withJob,
} from "../tool-builder/image-middleware.js";

const PRESET_DIMENSIONS: Record<string, { width: number; height: number; label: string }> = {
  instagram_square: {
    width: 1080,
    height: 1080,
    label: "Instagram Square (1:1)",
  },
  instagram_story: {
    width: 1080,
    height: 1920,
    label: "Instagram Story (9:16)",
  },
  twitter_header: { width: 1500, height: 500, label: "Twitter Header (3:1)" },
  facebook_cover: { width: 820, height: 312, label: "Facebook Cover" },
  youtube_thumbnail: {
    width: 1280,
    height: 720,
    label: "YouTube Thumbnail (16:9)",
  },
  linkedin_banner: { width: 1584, height: 396, label: "LinkedIn Banner (4:1)" },
};

export const cropTool = imageProcedure
  .use(withResolves({ image_id: "image" }))
  .use(
    withCredits({
      cost: () => 1,
      source: "crop",
      sourceIdField: "image_id",
    }),
  )
  .use(withJob({ imageIdField: "image_id" }))
  .tool("crop", "Intelligently crop an image for social media or custom dimensions.", {
    image_id: z.string().describe("ID of the image to crop"),
    preset: z
      .enum([
        "instagram_square",
        "instagram_story",
        "twitter_header",
        "facebook_cover",
        "youtube_thumbnail",
        "linkedin_banner",
        "custom",
      ])
      .describe("Crop preset (e.g. instagram_square, twitter_header) or custom")
      .optional(),
    custom_width: z
      .number()
      .describe("Custom width in pixels (only with preset=custom)")
      .optional(),
    custom_height: z
      .number()
      .describe("Custom height in pixels (only with preset=custom)")
      .optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const preset = input.preset ?? IMG_DEFAULTS.smartCropPreset;
    const customWidth = input.custom_width ?? 1080;
    const customHeight = input.custom_height ?? 1080;

    let targetWidth: number;
    let targetHeight: number;

    if (preset === "custom") {
      targetWidth = customWidth;
      targetHeight = customHeight;
    } else {
      const dims = PRESET_DIMENSIONS[preset];
      targetWidth = dims!.width;
      targetHeight = dims!.height;
    }

    return jsonResult({
      jobId: ctx.jobs.currentJob.id,
      type: "smart_crop",
      preset,
      targetWidth,
      targetHeight,
      creditsCost: ctx.billing.creditsCost,
      status: ctx.jobs.currentJob.status,
    });
  });

export const crop = cropTool.handler;
export const CropInputSchema = z.object(cropTool.inputSchema);
export type CropInput = Parameters<typeof crop>[0];
