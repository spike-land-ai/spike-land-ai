import { z } from "zod";
import type { EnhancementTier } from "../types.js";
import {
  errorResult,
  IMG_DEFAULTS,
  jsonResult,
  toolEvent,
  MODEL_PREFERENCE_VALUES,
} from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure, withResolves } from "../tool-builder/image-middleware.js";

export const editTool = imageProcedure
  .use(withResolves({ source_image_id: "image" }))
  .tool(
    "edit",
    "Modify an existing image with a text prompt (merges image-modify + style-transfer).",
    {
      prompt: z.string().describe("Text prompt describing the desired modifications").optional(),
      image_url: z.string().describe("URL of an external image to modify").optional(),
      image_base64: z.string().describe("Base64-encoded image data to modify").optional(),
      source_image_id: z.string().describe("Library image ID to use as source").optional(),
      mime_type: z
        .string()
        .describe("MIME type of the image (e.g. image/jpeg). Defaults to image/jpeg")
        .optional(),
      tier: z
        .enum(["FREE", "TIER_0_5K", "TIER_1K", "TIER_2K", "TIER_4K"])
        .describe("Enhancement tier — higher tiers produce better quality")
        .optional(),
      model_preference: z
        .enum(MODEL_PREFERENCE_VALUES)
        .describe("Model preference: default, quality, speed, or latest")
        .optional(),
    },
  )
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;
    const prompt = input.prompt ?? IMG_DEFAULTS.promptModify;
    const tier = (input.tier ?? IMG_DEFAULTS.tier) as EnhancementTier;
    const mimeType = input.mime_type ?? "image/jpeg";

    let imageData: string;

    if (input.source_image_id) {
      const image = ctx.entities.source_image_id;

      const downloadResult = await tryCatch(deps.storage.download(image.originalR2Key));
      /* v8 ignore next */
if (!downloadResult.ok || !downloadResult.data) {
        return errorResult("DOWNLOAD_FAILED", "Failed to download source image data", true);
      }
      imageData = Buffer.from(downloadResult.data).toString("base64");
    } else if (input.image_base64) {
      imageData = input.image_base64;
    } else if (input.image_url) {
      const responseResult = await tryCatch(fetch(input.image_url));
      if (!responseResult.ok) {
        return errorResult("FETCH_FAILED", responseResult.error.message, true);
      }
      if (!responseResult.data || !responseResult.data.ok) {
        return errorResult(
          "FETCH_FAILED",
          `Failed to fetch image: ${responseResult.data?.status ?? "Network error"}`,
          true,
        );
      }
      const bufferResult = await tryCatch(responseResult.data.arrayBuffer());
      if (!bufferResult.ok || !bufferResult.data) {
        return errorResult("FETCH_FAILED", "Failed to read image data", true);
      }
      imageData = Buffer.from(bufferResult.data).toString("base64");
    } else {
      return errorResult("MISSING_IMAGE", "Provide source_image_id, image_url, or image_base64");
    }

    const result = await tryCatch(
      deps.generation.createModificationJob({
        userId,
        prompt,
        imageData,
        mimeType,
        tier,
      }),
    );

    if (!result.ok) {
      return errorResult("MODIFICATION_FAILED", result.error.message, true);
    }
    if (!result.data || !result.data.success) {
      return errorResult(
        "MODIFICATION_FAILED",
        result.data?.error ?? "Failed to create modification job",
        true,
      );
    }

    ctx.notify?.(toolEvent("job:created", result.data.jobId!, { tier, status: "PENDING" }));
    return jsonResult({
      jobId: result.data.jobId,
      creditsCost: result.data.creditsCost,
      tier,
      status: "PENDING",
    });
  });

export const edit = editTool.handler;
export const EditInputSchema = z.object(editTool.inputSchema);
export type EditInput = Parameters<typeof edit>[0];
