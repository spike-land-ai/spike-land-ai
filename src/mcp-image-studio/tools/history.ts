import { z } from "zod";
import { errorResult, jsonResult, HISTORY_TYPE_VALUES } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure } from "../tool-builder/image-middleware.js";

export const historyTool = imageProcedure
  .tool("history", "View job history status", {
    type: z.enum(HISTORY_TYPE_VALUES).describe("Type of history entries to return").optional(),
    limit: z.number().max(100).describe("Maximum number of history entries to return").optional(),
    status: z
      .enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED", "REFUNDED"])
      .describe("Filter by job status")
      .optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;
    const type = input.type ?? "all";
    const limit = Math.min(input.limit ?? 20, 100);
    const status = input.status;

    const results: Array<Record<string, unknown>> = [];

    // Enhancement jobs
    if (type === "enhancement" || type === "all") {
      const enhRes = await tryCatch(deps.db.jobFindMany({ userId, status, limit }));
      if (enhRes.ok && enhRes.data) {
        for (const j of enhRes.data) {
          results.push({
            id: j.id,
            type: "enhancement",
            status: j.status,
            tier: j.tier,
            creditsCost: j.creditsCost,
            imageId: j.imageId,
            enhancedUrl: j.enhancedUrl,
            createdAt: j.createdAt.toISOString(),
          });
        }
      } else if (!enhRes.ok) {
        return errorResult("HISTORY_FAILED", enhRes.error.message, true);
      }
    }

    // Generation jobs via toolCallList (optional capability)
    if (type === "generation" || type === "all") {
      if (deps.db.toolCallList) {
        const callRes = await tryCatch(deps.db.toolCallList({ limit }));
        if (callRes.ok && callRes.data) {
          for (const c of callRes.data) {
            if (c.toolName === "img_generate" || c.toolName === "img_edit") {
              results.push({
                id: c.id,
                type: "generation",
                toolName: c.toolName,
                status:
                  c.status === "COMPLETED"
                    ? "COMPLETED"
                    : c.status === "ERROR"
                      ? "FAILED"
                      : "PENDING",
                createdAt: c.createdAt.toISOString(),
              });
            }
          }
        }
      }
      // If toolCallList is not available, generation history is simply omitted
    }

    // Sort by createdAt descending and limit
    results.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    return jsonResult({
      jobs: results.slice(0, limit),
      total: results.length,
      type,
    });
  });

export const history = historyTool.handler;
export const HistoryInputSchema = z.object(historyTool.inputSchema);
export type HistoryInput = Parameters<typeof history>[0];
