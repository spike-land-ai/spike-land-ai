import { z } from "zod";
import { jsonResult } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure, withResolves, withOwnership } from "../tool-builder/image-middleware.js";

export const versionsTool = imageProcedure
  .use(withResolves({ image_id: "image" }))
  .use(withOwnership(["image_id"]))
  .tool("versions", "List all enhancement versions for an image", {
    image_id: z.string().describe("ID of the image to get versions for"),
  })
  .handler(async ({ input: _input, ctx: ctx }) => {
    const { userId, deps } = ctx;
    const image = ctx.entities.image_id;
    const imageId = image.id;

    const jobsResult = await tryCatch(deps.db.jobFindMany({ userId, imageId }));

    if (!jobsResult.ok || !jobsResult.data) {
      return jsonResult({
        imageId: imageId,
        imageName: image.name,
        versions: [],
        count: 0,
      });
    }

    const versionList = jobsResult.data.map((job) => ({
      jobId: job.id,
      status: job.status,
      tier: job.tier,
      creditsCost: job.creditsCost,
      enhancedUrl: job.enhancedUrl,
      enhancedWidth: job.enhancedWidth,
      enhancedHeight: job.enhancedHeight,
      createdAt: job.createdAt,
    }));

    return jsonResult({
      imageId: imageId,
      imageName: image.name,
      versions: versionList,
      count: versionList.length,
    });
  });

export const versions = versionsTool.handler;
export const VersionsInputSchema = z.object(versionsTool.inputSchema);
export type VersionsInput = Parameters<typeof versions>[0];
