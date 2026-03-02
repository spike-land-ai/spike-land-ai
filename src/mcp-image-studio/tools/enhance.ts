import { z } from "zod";
import type { EnhancementJobRow } from "../types.js";
import { asImageId, errorResult, IMG_DEFAULTS, jsonResult, toolEvent } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { consumeCreditsOrError, resolveImageOrError } from "../define-tool.js";
import { imageProcedure } from "../tool-builder/image-middleware.js";

export const enhanceTool = imageProcedure
  .tool("enhance", "Start enhancement jobs for one or more images, or preview cost.", {
    image_id: z.string().describe("Image ID to enhance (single mode)").optional(),
    image_ids: z
      .array(z.string().describe("Image ID"))
      .describe("Image IDs to enhance (batch mode)")
      .optional(),
    tier: z
      .enum(["FREE", "TIER_0_5K", "TIER_1K", "TIER_2K", "TIER_4K"])
      .describe("Enhancement tier — higher tiers produce better quality. Defaults to TIER_1K")
      .optional(),
    preview: z
      .boolean()
      .describe("If true, returns cost estimate without starting jobs")
      .optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;
    const tier = input.tier ?? IMG_DEFAULTS.tier;
    const preview = input.preview ?? false;
    const cost = deps.credits.calculateGenerationCost({ tier });

    // ── Batch mode ──
    if (input.image_ids && input.image_ids.length > 0) {
      const imageIds = input.image_ids.map((id) => asImageId(id));
      const imgRes = await tryCatch(deps.resolvers.resolveImages(imageIds));
      if (!imgRes.ok || !imgRes.data || imgRes.data.length === 0) {
        return errorResult("IMAGES_NOT_FOUND", "No valid images found or none owned by user");
      }
      const resolvedImages = imgRes.data;
      const totalCost = resolvedImages.length * cost;

      if (preview) {
        const balanceResult = await tryCatch(deps.credits.getBalance(userId));
        const remaining = balanceResult.ok && balanceResult.data ? balanceResult.data.remaining : 0;
        return jsonResult({
          batch_size: resolvedImages.length,
          tier,
          cost_per_image: cost,
          total_cost: totalCost,
          current_balance: remaining,
          can_afford: remaining >= totalCost,
        });
      }

      let completed = 0;
      const enhancePromises = resolvedImages.map(async (img) => {
        if (!img) throw new Error("Null image");

        const { error: consumeError } = await consumeCreditsOrError(
          deps,
          userId,
          cost,
          "enhance",
          img.id,
          ctx,
        );
        if (consumeError) {
          throw new Error("Credit consume failed");
        }

        const jobRes = await tryCatch(
          deps.db.jobCreate({
            userId,
            imageId: img.id,
            tier,
            creditsCost: cost,
            status: "PENDING",
            processingStartedAt: null,
            metadata: null,
          }),
        );

        if (!jobRes.ok || !jobRes.data) {
          throw new Error("Job create failed");
        }

        ctx.notify?.(
          toolEvent("job:created", jobRes.data.id, {
            imageId: jobRes.data.imageId,
            tier: jobRes.data.tier,
            status: jobRes.data.status,
          }),
        );

        completed++;
        ctx.reportProgress?.(
          completed,
          resolvedImages.length,
          `Started enhance job ${completed}/${resolvedImages.length}`,
        );

        return jobRes.data;
      });

      const results = await Promise.allSettled(enhancePromises);

      const jobs = results
        .filter((r): r is PromiseFulfilledResult<EnhancementJobRow> => r.status === "fulfilled")
        .map((r) => r.value);

      const failedCount = results.filter((r) => r.status === "rejected").length;

      if (jobs.length === 0) {
        return errorResult("BATCH_ENHANCE_FAILED", "Failed to start any enhancement jobs");
      }

      return jsonResult({
        batch_size: resolvedImages.length,
        jobs_started: jobs.length,
        failed: failedCount,
        tier,
        total_cost: jobs.length * cost, // Adjust cost to reflect only started jobs
        jobs: jobs.map((j) => ({ jobId: j.id, imageId: j.imageId })),
      });
    }

    // ── Single mode ──
    if (!input.image_id) {
      return errorResult("INVALID_INPUT", "Provide image_id or image_ids");
    }

    const imageId = asImageId(input.image_id);
    const { error: resolveError } = await resolveImageOrError(deps, imageId);
    if (resolveError) return resolveError;

    if (preview) {
      const balanceResult = await tryCatch(deps.credits.getBalance(userId));
      const remaining = balanceResult.ok && balanceResult.data ? balanceResult.data.remaining : 0;
      return jsonResult({
        imageId,
        tier,
        cost,
        current_balance: remaining,
        can_afford: remaining >= cost,
      });
    }

    if (cost > 0) {
      const { error: consumeError } = await consumeCreditsOrError(
        deps,
        userId,
        cost,
        "enhance",
        imageId,
        ctx,
      );
      if (consumeError) return consumeError;
    }

    const jobResult = await tryCatch(
      deps.db.jobCreate({
        imageId,
        userId,
        tier,
        creditsCost: cost,
        status: "PENDING",
        processingStartedAt: null,
        metadata: null,
      }),
    );

    if (!jobResult.ok || !jobResult.data) {
      return errorResult("JOB_CREATE_FAILED", "Failed to create enhancement job");
    }

    ctx.notify?.(
      toolEvent("job:created", jobResult.data.id, {
        imageId: jobResult.data.imageId,
        tier: jobResult.data.tier,
        status: jobResult.data.status,
      }),
    );

    return jsonResult({
      jobId: jobResult.data.id,
      tier,
      creditsCost: cost,
      status: jobResult.data.status,
    });
  });

export const enhance = enhanceTool.handler;
export const EnhanceInputSchema = z.object(enhanceTool.inputSchema);
export type EnhanceInput = Parameters<typeof enhance>[0];
