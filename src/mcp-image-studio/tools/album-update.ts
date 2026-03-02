import { z } from "zod";
import {
  asImageId,
  asPipelineId,
  errorResult,
  jsonResult,
  ALBUM_PRIVACY_VALUES,
  toolEvent,
} from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure, withResolves, withOwnership } from "../tool-builder/image-middleware.js";

export const albumUpdateTool = imageProcedure
  .use(withResolves({ album_handle: "album" }))
  .use(withOwnership(["album_handle"]))
  .tool(
    "album_update",
    "Update album settings (name, description, privacy, cover, pipeline, tier)",
    {
      album_handle: z.string().describe("Handle of the album to update"),
      name: z.string().describe("New name for the album").optional(),
      description: z.string().describe("New description for the album").optional(),
      privacy: z
        .enum(ALBUM_PRIVACY_VALUES)
        .describe("New privacy setting: PRIVATE, UNLISTED, or PUBLIC")
        .optional(),
      cover_image_id: z.string().describe("Image ID to use as the album cover").optional(),
      pipeline_id: z.string().describe("Pipeline ID to apply to this album").optional(),
      default_tier: z
        .enum(["FREE", "TIER_0_5K", "TIER_1K", "TIER_2K", "TIER_4K"])
        .describe("Default enhancement tier for images in this album")
        .optional(),
    },
  )
  .handler(async ({ input: input, ctx: ctx }) => {
    const { deps } = ctx;

    const album = ctx.entities.album_handle;
    const handle = album.handle;

    // Validate cover_image_id ownership if provided
    if (input.cover_image_id !== undefined) {
      const imgRes = await tryCatch(deps.resolvers.resolveImage(asImageId(input.cover_image_id)));
      if (!imgRes.ok) {
        return errorResult("IMAGE_NOT_FOUND", "Cover image not found or not owned by user");
      }
    }

    // Validate pipeline_id ownership if provided
    if (input.pipeline_id !== undefined) {
      const pipeRes = await tryCatch(
        deps.resolvers.resolvePipeline(asPipelineId(input.pipeline_id)),
      );
      if (!pipeRes.ok) {
        return errorResult("PIPELINE_NOT_FOUND", "Pipeline not found or not owned by user");
      }
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.cover_image_id !== undefined) {
      data.coverImageId = input.cover_image_id;
    }
    if (input.pipeline_id !== undefined) data.pipelineId = input.pipeline_id;
    if (input.default_tier !== undefined) data.defaultTier = input.default_tier;

    if (input.privacy !== undefined) {
      data.privacy = input.privacy;
      if (input.privacy === "PRIVATE") {
        data.shareToken = null;
      } else if (!album.shareToken) {
        data.shareToken = deps.nanoid(12);
      }
    }

    const updateResult = await tryCatch(deps.db.albumUpdate(handle, data));
    if (!updateResult.ok || !updateResult.data) {
      return errorResult("UPDATE_FAILED", "Failed to update album");
    }

    const updated = updateResult.data;

    ctx.notify?.(
      toolEvent("album:updated", updated.handle, { name: updated.name, privacy: updated.privacy }),
    );

    return jsonResult({
      album_handle: updated.handle,
      name: updated.name,
      privacy: updated.privacy,
      default_tier: updated.defaultTier,
      share_token: updated.shareToken,
    });
  });

export const albumUpdate = albumUpdateTool.handler;
export const AlbumUpdateInputSchema = z.object(albumUpdateTool.inputSchema);
export type AlbumUpdateInput = Parameters<typeof albumUpdate>[0];
