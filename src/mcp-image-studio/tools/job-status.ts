import { z } from "zod";
import { asImageId, asJobId, errorResult, jsonResult, JOB_TYPE_VALUES } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure } from "../tool-builder/image-middleware.js";

export const jobStatusTool = imageProcedure
  .tool("job_status", "Check the status of generation or enhancement jobs", {
    job_id: z.string().describe("ID of the job to check").optional(),
    image_ids: z.array(z.string().describe("Image ID")).describe("Image IDs to check").optional(),
    job_type: z
      .enum(JOB_TYPE_VALUES)
      .describe("Job type (generation, enhancement, etc.)")
      .optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;

    // Single job lookup
    if (input.job_id) {
      const jobId = asJobId(input.job_id);

      // Try generation job first (unless type hint says enhancement)
      if (input.job_type !== "enhancement") {
        const genRes = await tryCatch(deps.resolvers.resolveGenerationJob(jobId));
        if (genRes.ok && genRes.data) {
          const g = genRes.data;
          const response: Record<string, unknown> = {
            id: g.id,
            type: g.type,
            status: g.status,
            prompt: g.prompt,
            tier: g.tier,
            creditsCost: g.creditsCost,
          };
          if (g.status === "COMPLETED") {
            response.outputUrl = g.outputImageUrl;
            response.width = g.outputWidth;
            response.height = g.outputHeight;
          }
          if (g.status === "FAILED") {
            response.error = g.errorMessage;
          }
          return jsonResult(response);
        }
        // If type was explicitly generation and not found, return error
        if (input.job_type === "generation") {
          return errorResult("NOT_FOUND", `Job ${input.job_id} not found`);
        }
      }

      // Try enhancement job
      const enhRes = await tryCatch(deps.db.jobFindById(jobId));
      if (enhRes.ok && enhRes.data) {
        const e = enhRes.data;
        if (e.userId !== userId) {
          return errorResult("NOT_FOUND", `Job ${input.job_id} not found`);
        }
        const response: Record<string, unknown> = {
          id: e.id,
          type: "ENHANCEMENT",
          status: e.status,
          tier: e.tier,
          creditsCost: e.creditsCost,
          imageId: e.imageId,
        };
        if (e.status === "COMPLETED") {
          response.enhancedUrl = e.enhancedUrl;
          response.width = e.enhancedWidth;
          response.height = e.enhancedHeight;
        }
        if (e.status === "FAILED") {
          response.error = e.errorMessage;
        }
        return jsonResult(response);
      }

      return errorResult("NOT_FOUND", `Job ${input.job_id} not found`);
    }

    // Multiple job lookup by image ID (batch)
    if (input.image_ids && input.image_ids.length > 0) {
      const statuses = [];

      for (const id of input.image_ids) {
        const res = await tryCatch(
          deps.db.jobFindMany({ userId, imageId: asImageId(id), limit: 1 }),
        );
        if (!res.ok) {
          return errorResult("BATCH_STATUS_FAILED", "Failed to retrieve statuses");
        }
        const latest = res.data ? res.data[0] : null;
        statuses.push({
          imageId: id,
          jobId: latest?.id ?? null,
          status: latest?.status ?? "NO_JOB",
          enhancedUrl: latest?.enhancedUrl ?? null,
        });
      }

      return jsonResult({ statuses });
    }

    return errorResult("INVALID_INPUT", "Provide either job_id or image_ids");
  });

export const jobStatus = jobStatusTool.handler;
export const JobStatusInputSchema = z.object(jobStatusTool.inputSchema);
export type JobStatusInput = Parameters<typeof jobStatus>[0];
