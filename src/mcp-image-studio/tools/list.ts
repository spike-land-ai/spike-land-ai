import { z } from "zod";
import { errorResult, jsonResult } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure } from "../tool-builder/image-middleware.js";

export const listTool = imageProcedure
  .tool("list", "List or search images in the user's library", {
    query: z.string().describe("Optional search query to filter images by name/tags").optional(),
    limit: z
      .number()
      .max(100)
      .describe("Maximum number of images to return (max 100). Defaults to 20")
      .optional(),
    cursor: z.string().describe("Pointer for pagination (e.g. last item id)").optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;
    const { query, limit = 20, cursor } = input;

    const result = await tryCatch(
      deps.db.imageFindMany({
        userId,
        limit,
        cursor: query ? undefined : cursor,
        search: query,
      }),
    );

    if (!result.ok) {
      return errorResult("LIST_FAILED", "Failed to list library images");
    }

    const images = result.data ?? [];
    return jsonResult({
      ...(query ? { query } : {}),
      count: images.length,
      ...(!query ? { cursor } : {}),
      images: images.map((img) => ({
        id: img.id,
        name: img.name,
        url: img.originalUrl,
        width: img.originalWidth,
        height: img.originalHeight,
        tags: img.tags,
        createdAt: img.createdAt,
      })),
    });
  });

export const list = listTool.handler;
export const ListInputSchema = z.object(listTool.inputSchema);
export type ListInput = Parameters<typeof list>[0];
