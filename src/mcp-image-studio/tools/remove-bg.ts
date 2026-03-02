import { z } from "zod";
import { asImageId, errorResult, jsonResult } from "../types.js";
import type { ImageRow } from "../types.js";
import {
  imageProcedure,
  withResolves,
  withOwnership,
  withCredits,
  withJob,
} from "../tool-builder/image-middleware.js";
import { middleware } from "@spike-land-ai/shared/tool-builder";

export const removeBgTool = imageProcedure
  .use(withResolves({ image_id: "image" }))
  .use(withOwnership(["image_id"]))
  .use(
    middleware<{ entities: { image_id: ImageRow } }, { entities: { image_id: ImageRow } }>(
      async ({ ctx, next }) => {
        const image = ctx.entities.image_id;
        if (image && image.name.includes("_nobg")) {
          return errorResult(
            "ALREADY_PROCESSED",
            "This image has already been processed to remove the background.",
          );
        }
        return next(ctx);
      },
    ),
  )
  .use(
    withCredits({
      cost: () => 1,
      source: "removeBg",
      sourceIdField: "image_id",
    }),
  )
  .use(withJob({ imageIdField: "image_id" }))
  .tool("remove_bg", "Remove background from an image.", {
    image_id: z.string().describe("ID of the image to remove background from"),
  })
  .handler(async ({ input, ctx }) => {
    const imageId = asImageId(input.image_id as string);

    return jsonResult({
      jobId: ctx.jobs.currentJob.id,
      status: ctx.jobs.currentJob.status,
      creditsCost: ctx.billing.creditsCost,
      imageId,
    });
  });

export const removeBg = removeBgTool.handler;
export const RemoveBgInputSchema = z.object(removeBgTool.inputSchema);
export type RemoveBgInput = Parameters<typeof removeBg>[0];
