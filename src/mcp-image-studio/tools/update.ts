import { z } from "zod";
import type { ImageRow } from "../types.js";
import { errorResult, jsonResult, toolEvent } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure, withResolves, withOwnership } from "../tool-builder/image-middleware.js";

export const updateTool = imageProcedure
  .use(withResolves({ image_id: "image" }))
  .use(withOwnership(["image_id"]))
  .tool("update", "Update image metadata (name, description, tags)", {
    image_id: z.string().describe("ID of the image to update"),
    name: z.string().describe("New name for the image").optional(),
    description: z.string().describe("New description for the image").optional(),
    tags: z
      .array(z.string().describe("Tag item"))
      .describe("New tags array for the image")
      .optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { deps } = ctx;

    // 1. Validate at least one field to update
    const { name, description, tags } = input;
    if (name === undefined && description === undefined && tags === undefined) {
      return errorResult(
        "NO_FIELDS",
        "Provide at least one field to update: name, description, or tags",
      );
    }

    // 2. Resolve image ownership
    const image = ctx.entities.image_id;
    const imageId = image.id;

    // 3. Build partial update object from provided fields
    const updateData: Partial<Pick<ImageRow, "name" | "description" | "tags">> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) updateData.tags = tags;

    // 4. Call deps.db.imageUpdate
    const updateResult = await tryCatch(deps.db.imageUpdate(imageId, updateData));
    if (!updateResult.ok) {
      return errorResult("UPDATE_FAILED", "Failed to update image metadata");
    }

    // 5. Return updated image info
    const updated = updateResult.data;

    ctx.notify?.(toolEvent("image:updated", updated.id, { name: updated.name }));

    return jsonResult({
      image_id: updated.id,
      name: updated.name,
      description: updated.description,
      tags: updated.tags,
      updatedAt: updated.updatedAt,
    });
  });

export const update = updateTool.handler;
export const UpdateInputSchema = z.object(updateTool.inputSchema);
export type UpdateInput = Parameters<typeof update>[0];
