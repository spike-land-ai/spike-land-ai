import { z } from "zod";
import { errorResult, IMG_DEFAULTS, jsonResult } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure } from "../tool-builder/image-middleware.js";

export const pipelineListTool = imageProcedure
  .tool("pipeline_list", "List pipelines for the current user.", {
    limit: z.number().max(100).describe("Maximum number of pipelines to return").optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;
    const { limit = IMG_DEFAULTS.pipelineListLimit } = input;
    const result = await tryCatch(deps.db.pipelineFindMany({ userId, limit }));

    if (!result.ok) {
      return errorResult("LIST_PIPELINES_FAILED", "Failed to list pipelines");
    }

    const pipelines = result.data ?? [];
    return jsonResult({ pipelines, count: pipelines.length });
  });

export const pipelineList = pipelineListTool.handler;
export const PipelineListInputSchema = z.object(pipelineListTool.inputSchema);
export type PipelineListInput = Parameters<typeof pipelineList>[0];
