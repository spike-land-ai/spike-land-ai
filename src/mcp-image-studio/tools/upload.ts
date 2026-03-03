import { z } from "zod";
import { asAlbumHandle, jsonResult, toolEvent } from "../types.js";
import { tryCatch, DomainError } from "./try-catch.js";
import { imageProcedure } from "../tool-builder/image-middleware.js";

export const uploadTool = imageProcedure
  .tool("upload", "Upload an image, optionally into an album", {
    name: z.string().describe("Display name for the image in the library"),
    description: z.string().describe("Description for the uploaded image").optional(),
    tags: z
      .array(z.string().describe("Tag"))
      .describe("Tags to apply to the uploaded image")
      .optional(),
    data_base64: z.string().describe("Base64 encoded image data"),
    content_type: z.string().describe("MIME type of the image"),
    width: z.number().describe("Original image width in pixels"),
    height: z.number().describe("Original image height in pixels"),
    album_handle: z.string().describe("Handle of the album to upload to").optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;
    const {
      name,
      description,
      tags = [],
      data_base64,
      content_type,
      width,
      height,
      album_handle,
    } = input;

    const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
    const estimatedSize = Math.ceil(data_base64.length * 0.75);
    if (estimatedSize > MAX_FILE_SIZE_BYTES) {
      throw new DomainError("FILE_TOO_LARGE", "File size exceeds maximum of 50MB", false);
    }

    // If album_handle provided, resolve album first (fail early)
    let album: { id: string; handle: string } | undefined;
    if (album_handle) {
      const handle = asAlbumHandle(album_handle);
      const albumRes = await tryCatch(deps.resolvers.resolveAlbum(handle));
      /* v8 ignore next */
if (!albumRes.ok || !albumRes.data)
        throw new DomainError("ALBUM_NOT_FOUND", `Album ${album_handle} not found`);
      album = albumRes.unwrap();
    }

    const buffer = Buffer.from(data_base64, "base64");

    const uploadedRes = await tryCatch(
      deps.storage.upload(userId, buffer, {
        filename: name,
        contentType: content_type,
      }),
    );
    if (!uploadedRes.ok)
      throw new DomainError("UPLOAD_FAILED", uploadedRes.error.message || "Upload failed", true);
    if (!uploadedRes.data) throw new DomainError("UPLOAD_FAILED", "Upload failed", true);
    const uploaded = uploadedRes.unwrap();

    const imageRes = await tryCatch(
      deps.db.imageCreate({
        userId,
        name,
        description: description ?? null,
        tags,
        originalUrl: uploaded.url,
        originalR2Key: uploaded.r2Key,
        originalWidth: width,
        originalHeight: height,
        originalSizeBytes: uploaded.sizeBytes,
        originalFormat: content_type,
        isPublic: false,
        shareToken: null,
      }),
    );

    if (!imageRes.ok) {
      // Compensating transaction
      await tryCatch(deps.storage.delete(uploaded.r2Key));
      throw new DomainError("DB_ERROR", "Failed to save image metadata", true);
    }
    const image = imageRes.unwrap();

    // If album provided, add image to it
    if (album) {
      const maxSortResult = await tryCatch(deps.db.albumImageMaxSortOrder(album.id));
      const sortOrder = maxSortResult.ok ? maxSortResult.unwrap() : 0;
      await tryCatch(deps.db.albumImageAdd(album.id, image.id, sortOrder + 1));
    }

    // Auto-tag: AI-analyze the image for tags + description (best-effort, no credits consumed)
    let aiTags: string[] = tags;
    let aiDescription: string | null = description ?? null;
    if (deps.generation.describeImage) {
      const descResult = await tryCatch(
        deps.generation.describeImage({ userId, imageId: image.id }),
      );
      if (descResult.ok && !descResult.data.error) {
        const data = descResult.unwrap();
        const newTags = data.tags ?? [];
        const existingSet = new Set(tags);
        const merged = [...tags, ...newTags.filter((t) => !existingSet.has(t))];
        aiTags = merged;
        aiDescription = data.description ?? aiDescription;

        await tryCatch(
          deps.db.imageUpdate(image.id, {
            tags: aiTags,
            ...(aiDescription ? { description: aiDescription } : {}),
          }),
        );
      }
    }

    ctx.notify?.(toolEvent("image:created", image.id, { name: image.name }));

    return jsonResult({
      id: image.id,
      url: image.originalUrl,
      name: image.name,
      tags: aiTags,
      description: aiDescription,
      width,
      height,
      ...(album ? { album_handle: album.handle } : {}),
    });
  });

export const upload = uploadTool.handler;
export const UploadInputSchema = z.object(uploadTool.inputSchema);
export type UploadInput = Parameters<typeof upload>[0];
