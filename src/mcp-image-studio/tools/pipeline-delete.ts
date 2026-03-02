import { z } from "zod";
import { asPipelineId, errorResult, jsonResult, toolEvent } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure } from "../tool-builder/image-middleware.js";

export const pipelineDeleteTool = imageProcedure
  .tool("pipeline_delete", "Delete an owned pipeline (fails if pipeline has albums)", {
    pipeline_id: z.string().describe("ID of the pipeline to delete"),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { deps } = ctx;
    const pipelineId = asPipelineId(input.pipeline_id);

    const resolveRes = await tryCatch(deps.resolvers.resolvePipeline(pipelineId));
    if (!resolveRes.ok || !resolveRes.data) {
      return errorResult("NOT_FOUND", "Pipeline not found or not owned by user");
    }

    // Check album usage
    const pipelineResult = await tryCatch(deps.db.pipelineFindById(pipelineId));
    if (
      pipelineResult.ok &&
      pipelineResult.data &&
      pipelineResult.data._count &&
      pipelineResult.data._count.albums > 0
    ) {
      return errorResult(
        "PIPELINE_IN_USE",
        `Pipeline is used by ${pipelineResult.data._count.albums} album(s). Remove albums first.`,
      );
    }

    const result = await tryCatch(deps.db.pipelineDelete(pipelineId));
    if (!result.ok) {
      return errorResult("DELETE_FAILED", "Failed to delete pipeline");
    }

    ctx.notify?.(toolEvent("pipeline:deleted", pipelineId));

    return jsonResult({ deleted: true, id: input.pipeline_id });
  });

export const pipelineDelete = pipelineDeleteTool.handler;
export const PipelineDeleteInputSchema = z.object(pipelineDeleteTool.inputSchema);
export type PipelineDeleteInput = Parameters<typeof pipelineDelete>[0];
