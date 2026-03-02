import { z } from "zod";
import { IMG_DEFAULTS, jsonResult } from "../types.js";
import {
  imageProcedure,
  withResolves,
  withCredits,
  withJob,
} from "../tool-builder/image-middleware.js";

export const watermarkTool = imageProcedure
  .use(withResolves({ image_id: "image", logo_image_id: "image" }))
  .use(
    withCredits({
      cost: () => 1,
      source: "watermark",
      sourceIdField: "image_id",
    }),
  )
  .use(withJob({ imageIdField: "image_id" }))
  .tool("watermark", "Add a text or logo watermark to an image", {
    image_id: z.string().describe("ID of the image to watermark"),
    text: z.string().describe('Watermark text. Defaults to "©"').optional(),
    logo_image_id: z.string().describe("ID of the logo image").optional(),
    position: z
      .string()
      .describe("Position of the watermark (e.g. bottom-right, center)")
      .optional(),
    opacity: z.number().describe("Watermark opacity from 0-100. Defaults to 50").optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const {
      text = IMG_DEFAULTS.watermarkText,
      logo_image_id,
      position = IMG_DEFAULTS.watermarkPosition,
      opacity = IMG_DEFAULTS.watermarkOpacity,
    } = input;

    return jsonResult({
      jobId: ctx.jobs.currentJob.id,
      type: "watermark",
      watermark: {
        text,
        logo_image_id: logo_image_id ?? null,
        position,
        opacity,
      },
      creditsCost: ctx.billing.creditsCost,
      status: ctx.jobs.currentJob.status,
    });
  });

export const watermark = watermarkTool.handler;
export const WatermarkInputSchema = z.object(watermarkTool.inputSchema);
export type WatermarkInput = Parameters<typeof watermark>[0];
