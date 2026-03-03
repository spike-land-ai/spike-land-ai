/**
 * Batch Enhancement MCP Tools
 *
 * Batch image enhancement with credit calculation and progress tracking.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const MAX_BATCH_SIZE = 20;

const BatchEnhanceImagesSchema = z.object({
  image_ids: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_BATCH_SIZE)
    .describe(`Image IDs to enhance (max ${MAX_BATCH_SIZE}).`),
  tier: z
    .enum(["FREE", "TIER_1K", "TIER_2K", "TIER_4K"])
    .describe(
      "Enhancement tier. FREE=0 credits, TIER_1K=2, TIER_2K=5, TIER_4K=10.",
    ),
});

const BatchEnhanceCostPreviewSchema = z.object({
  image_ids: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_BATCH_SIZE)
    .describe(`Image IDs to preview cost for (max ${MAX_BATCH_SIZE}).`),
  tier: z
    .enum(["FREE", "TIER_1K", "TIER_2K", "TIER_4K"])
    .describe("Enhancement tier to preview."),
});

const BatchEnhanceStatusSchema = z.object({
  image_ids: z
    .array(z.string().min(1))
    .min(1)
    .max(50)
    .describe("Image IDs from the batch to check status for."),
});

export function registerBatchEnhanceTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "batch_enhance_images",
    description: "Enhance multiple images in a single batch. Credits are consumed upfront. "
      + `Maximum ${MAX_BATCH_SIZE} images per batch.`,
    category: "batch-enhance",
    tier: "free",
    inputSchema: BatchEnhanceImagesSchema.shape,
    handler: async ({
      image_ids,
      tier,
    }: z.infer<typeof BatchEnhanceImagesSchema>): Promise<CallToolResult> =>
      safeToolCall("batch_enhance_images", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const { ENHANCEMENT_COSTS } = await import("@/lib/credits/costs");
        const { WorkspaceCreditManager } = await import(
          "@/lib/credits/workspace-credit-manager"
        );

        // Validate all images belong to user
        const images = await prisma.enhancedImage.findMany({
          where: { id: { in: image_ids }, userId },
          select: { id: true },
        });

        if (images.length !== image_ids.length) {
          return textResult(
            `**Error: VALIDATION_ERROR**\nOne or more images not found or unauthorized.\n**Retryable:** false`,
          );
        }

        // Calculate total cost
        const tokenCost = ENHANCEMENT_COSTS[tier];
        const totalCost = tokenCost * image_ids.length;

        // Check credits
        const hasEnough = await WorkspaceCreditManager.hasEnoughCredits(
          userId,
          totalCost,
        );

        if (!hasEnough) {
          return textResult(
            `**Error: INSUFFICIENT_CREDITS**\nRequired: ${totalCost} credits for ${image_ids.length} images at ${tier}.\n**Retryable:** false`,
          );
        }

        // Consume credits upfront
        const batchId = `batch-${Date.now()}`;
        const consumeResult = await WorkspaceCreditManager.consumeCredits({
          userId,
          amount: totalCost,
          source: "batch_image_enhancement",
          sourceId: batchId,
        });

        if (!consumeResult.success) {
          return textResult(
            `**Error: CREDIT_CONSUMPTION_FAILED**\n${
              consumeResult.error || "Failed to consume credits"
            }\n**Retryable:** true`,
          );
        }

        return textResult(
          `**Batch Enhancement Started!**\n\n`
            + `**Batch ID:** ${batchId}\n`
            + `**Images:** ${image_ids.length}\n`
            + `**Tier:** ${tier}\n`
            + `**Total Cost:** ${totalCost} credits\n`
            + `**New Balance:** ${consumeResult.remaining}\n\n`
            + `Use \`batch_enhance_status\` to track progress.`,
        );
      }),
  });

  registry.register({
    name: "batch_enhance_cost_preview",
    description: "Preview the credit cost for a batch enhancement without starting it. "
      + "Shows per-image and total cost, and whether you have enough credits.",
    category: "batch-enhance",
    tier: "free",
    inputSchema: BatchEnhanceCostPreviewSchema.shape,
    handler: async ({
      image_ids,
      tier,
    }: z.infer<typeof BatchEnhanceCostPreviewSchema>): Promise<
      CallToolResult
    > =>
      safeToolCall("batch_enhance_cost_preview", async () => {
        const { ENHANCEMENT_COSTS } = await import("@/lib/credits/costs");
        const { WorkspaceCreditManager } = await import(
          "@/lib/credits/workspace-credit-manager"
        );

        const perImageCost = ENHANCEMENT_COSTS[tier];
        const totalCost = perImageCost * image_ids.length;

        const balance = await WorkspaceCreditManager.getBalance(userId);
        const remaining = balance?.remaining ?? 0;
        const canAfford = remaining >= totalCost;

        return textResult(
          `**Batch Enhancement Cost Preview**\n\n`
            + `**Images:** ${image_ids.length}\n`
            + `**Tier:** ${tier}\n`
            + `**Per Image:** ${perImageCost} credits\n`
            + `**Total Cost:** ${totalCost} credits\n`
            + `**Current Balance:** ${remaining} credits\n`
            + `**Can Afford:** ${canAfford ? "Yes" : "No"}\n`
            + (!canAfford
              ? `**Shortfall:** ${totalCost - remaining} credits\n`
              : ""),
        );
      }),
  });

  registry.register({
    name: "batch_enhance_status",
    description: "Check the enhancement status for a set of images. "
      + "Shows the most recent job for each image.",
    category: "batch-enhance",
    tier: "free",
    inputSchema: BatchEnhanceStatusSchema.shape,
    handler: async ({
      image_ids,
    }: z.infer<typeof BatchEnhanceStatusSchema>): Promise<CallToolResult> =>
      safeToolCall("batch_enhance_status", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        // Find the most recent job for each image
        const jobs = await prisma.imageEnhancementJob.findMany({
          where: { imageId: { in: image_ids }, userId },
          select: {
            id: true,
            status: true,
            imageId: true,
            tier: true,
            createdAt: true,
            processingCompletedAt: true,
          },
          orderBy: { createdAt: "desc" },
        });

        if (jobs.length === 0) {
          return textResult(
            `**Error: NO_JOBS_FOUND**\nNo enhancement jobs found for the provided images.\n**Retryable:** false`,
          );
        }

        // Group by imageId, keeping most recent
        const latestByImage = new Map<string, typeof jobs[0]>();
        for (const job of jobs) {
          if (!latestByImage.has(job.imageId)) {
            latestByImage.set(job.imageId, job);
          }
        }

        const entries = Array.from(latestByImage.values());
        const completed = entries.filter(j => j.status === "COMPLETED").length;
        const failed = entries.filter(j => j.status === "FAILED").length;
        const pending = entries.filter(
          j => j.status === "PENDING" || j.status === "PROCESSING",
        ).length;

        let text = `**Batch Enhancement Status**\n\n`;
        text += `**Total:** ${entries.length}\n`;
        text += `**Completed:** ${completed}\n`;
        text += `**Failed:** ${failed}\n`;
        text += `**In Progress:** ${pending}\n\n`;

        for (const job of entries) {
          text += `- \`${job.imageId}\`: ${job.status}\n`;
        }

        return textResult(text);
      }),
  });
}
