import { z } from "zod";
import {
  asAlbumHandle,
  errorResult,
  jsonResult,
  ALBUM_PRIVACY_VALUES,
  toolEvent,
} from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure } from "../tool-builder/image-middleware.js";

export const albumCreateTool = imageProcedure
  .tool("album_create", "Create a new image album with optional privacy and tier settings", {
    name: z.string().min(1).max(100).describe("Name of the album"),
    description: z.string().max(1000).describe("Description for the album").optional(),
    privacy: z.enum(ALBUM_PRIVACY_VALUES).describe("Privacy setting: PRIVATE, UNLISTED, or PUBLIC"),
    default_tier: z
      .enum(["FREE", "TIER_0_5K", "TIER_1K", "TIER_2K", "TIER_4K"])
      .describe("Default enhancement tier for images in this album"),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;
    const { name, description, privacy, default_tier: defaultTier } = input;

    const maxSortResult = await tryCatch(deps.db.albumMaxSortOrder(userId));
    const maxSort = maxSortResult.ok ? maxSortResult.data : 0;

    const shareToken = privacy !== "PRIVATE" ? deps.nanoid(12) : null;

    const albumResult = await tryCatch(
      deps.db.albumCreate({
        handle: asAlbumHandle(deps.nanoid(8)),
        userId,
        name,
        description: description ?? null,
        coverImageId: null,
        privacy,
        defaultTier,
        shareToken,
        sortOrder: maxSort + 1,
        pipelineId: null,
      }),
    );

    if (!albumResult.ok || !albumResult.data) {
      return errorResult("ALBUM_CREATE_FAILED", "Failed to create album");
    }

    const album = albumResult.data;

    ctx.notify?.(
      toolEvent("album:created", album.handle, { name: album.name, privacy: album.privacy }),
    );

    return jsonResult({
      album_handle: album.handle,
      name: album.name,
      privacy: album.privacy,
      default_tier: album.defaultTier,
      share_token: album.shareToken,
      share_url: album.shareToken ? `https://spike.land/pixel/album/${album.shareToken}` : null,
    });
  });

export const albumCreate = albumCreateTool.handler;
export const AlbumCreateInputSchema = z.object(albumCreateTool.inputSchema);
export type AlbumCreateInput = Parameters<typeof albumCreate>[0];
