import { z } from "zod";
import { errorResult, jsonResult, SHARE_ACTION_VALUES, toolEvent } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure, withResolves, withOwnership } from "../tool-builder/image-middleware.js";

export const shareTool = imageProcedure
  .use(withResolves({ image_id: "image" }))
  .use(withOwnership(["image_id"]))
  .tool("share", "Share or unshare an image", {
    image_id: z.string().describe("ID of the image to share or unshare"),
    action: z
      .enum(SHARE_ACTION_VALUES)
      .describe("Action to perform: share (make public) or unshare (make private)"),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { deps } = ctx;
    const image = ctx.entities.image_id;
    const imageId = image.id;

    if (input.action === "share") {
      const shareToken = image.shareToken || deps.nanoid(12);
      const updateResult = await tryCatch(
        deps.db.imageUpdate(imageId, { isPublic: true, shareToken }),
      );
      if (!updateResult.ok) {
        return errorResult("UPDATE_FAILED", "Failed to update image sharing status");
      }

      ctx.notify?.(toolEvent("image:updated", image.id, { action: "share", isPublic: true }));

      return jsonResult({
        image_id: image.id,
        action: "share",
        shareToken,
        shareUrl: `https://spike.land/pixel/shared/${shareToken}`,
        isPublic: true,
      });
    }

    // unshare
    const updateResult = await tryCatch(deps.db.imageUpdate(imageId, { isPublic: false }));
    if (!updateResult.ok) {
      return errorResult("UPDATE_FAILED", "Failed to update image sharing status");
    }

    ctx.notify?.(toolEvent("image:updated", image.id, { action: "unshare", isPublic: false }));

    return jsonResult({
      image_id: image.id,
      action: "unshare",
      isPublic: false,
    });
  });

export const share = shareTool.handler;
export const ShareInputSchema = z.object(shareTool.inputSchema);
export type ShareInput = Parameters<typeof share>[0];
