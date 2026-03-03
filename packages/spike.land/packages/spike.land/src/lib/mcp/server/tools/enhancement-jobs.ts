/**
 * Enhancement Jobs MCP Tools
 *
 * Single image enhancement, job cancellation with credit refund, status, and history.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const EnhanceImageSchema = z.object({
  image_id: z.string().min(1).describe("Image ID to enhance."),
  tier: z
    .enum(["FREE", "TIER_1K", "TIER_2K", "TIER_4K"])
    .describe(
      "Enhancement tier. FREE=0 credits, TIER_1K=2, TIER_2K=5, TIER_4K=10.",
    ),
});

const CancelEnhancementJobSchema = z.object({
  job_id: z.string().min(1).describe("Enhancement job ID to cancel."),
});

const GetEnhancementJobSchema = z.object({
  job_id: z.string().min(1).describe("Enhancement job ID."),
});

const ListEnhancementJobsSchema = z.object({
  image_id: z
    .string()
    .optional()
    .describe("Filter by image ID."),
  status: z
    .enum([
      "PENDING",
      "PROCESSING",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
      "REFUNDED",
    ])
    .optional()
    .describe("Filter by job status."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("Max jobs to return. Default: 20."),
});

export function registerEnhancementJobsTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "enhance_image",
    description: "Start a single image enhancement. Credits are consumed upfront. "
      + "Returns a job ID for tracking progress.",
    category: "enhancement-jobs",
    tier: "free",
    inputSchema: EnhanceImageSchema.shape,
    handler: async ({
      image_id,
      tier,
    }: z.infer<typeof EnhanceImageSchema>): Promise<CallToolResult> =>
      safeToolCall("enhance_image", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const { ENHANCEMENT_COSTS } = await import("@/lib/credits/costs");
        const { WorkspaceCreditManager } = await import(
          "@/lib/credits/workspace-credit-manager"
        );

        // Verify image ownership
        const image = await prisma.enhancedImage.findUnique({
          where: { id: image_id },
          select: { id: true, userId: true },
        });

        if (!image || image.userId !== userId) {
          return textResult(
            `**Error: IMAGE_NOT_FOUND**\nImage '${image_id}' not found.\n**Retryable:** false`,
          );
        }

        // Credit check and consumption
        const creditCost = ENHANCEMENT_COSTS[tier];

        if (creditCost > 0) {
          const hasEnough = await WorkspaceCreditManager.hasEnoughCredits(
            userId,
            creditCost,
          );

          if (!hasEnough) {
            return textResult(
              `**Error: INSUFFICIENT_CREDITS**\nRequired: ${creditCost} credits for ${tier}.\n**Retryable:** false`,
            );
          }

          const consumeResult = await WorkspaceCreditManager.consumeCredits({
            userId,
            amount: creditCost,
            source: "image_enhancement",
            sourceId: image_id,
          });

          if (!consumeResult.success) {
            return textResult(
              `**Error: CREDIT_CONSUMPTION_FAILED**\n${
                consumeResult.error || "Failed to consume credits"
              }\n**Retryable:** true`,
            );
          }
        }

        // Create enhancement job
        const job = await prisma.imageEnhancementJob.create({
          data: {
            imageId: image_id,
            userId,
            tier,
            creditsCost: creditCost,
            status: "PROCESSING",
            processingStartedAt: new Date(),
          },
        });

        return textResult(
          `**Enhancement Started!**\n\n`
            + `**Job ID:** ${job.id}\n`
            + `**Image:** ${image_id}\n`
            + `**Tier:** ${tier}\n`
            + `**Credit Cost:** ${creditCost}\n\n`
            + `Use \`get_enhancement_job\` to check progress.`,
        );
      }),
  });

  registry.register({
    name: "cancel_enhancement_job",
    description: "Cancel an enhancement job. Only PENDING or PROCESSING jobs can be cancelled. "
      + "Credits are automatically refunded.",
    category: "enhancement-jobs",
    tier: "free",
    inputSchema: CancelEnhancementJobSchema.shape,
    handler: async ({
      job_id,
    }: z.infer<typeof CancelEnhancementJobSchema>): Promise<CallToolResult> =>
      safeToolCall("cancel_enhancement_job", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const { WorkspaceCreditManager } = await import(
          "@/lib/credits/workspace-credit-manager"
        );

        const job = await prisma.imageEnhancementJob.findUnique({
          where: { id: job_id },
        });

        if (!job || job.userId !== userId) {
          return textResult(
            `**Error: JOB_NOT_FOUND**\nJob '${job_id}' not found.\n**Retryable:** false`,
          );
        }

        if (job.status !== "PENDING" && job.status !== "PROCESSING") {
          return textResult(
            `**Error: INVALID_STATUS**\nCannot cancel job with status: ${job.status}. Only PENDING or PROCESSING jobs can be cancelled.\n**Retryable:** false`,
          );
        }

        // Cancel the job
        await prisma.imageEnhancementJob.update({
          where: { id: job_id },
          data: { status: "CANCELLED" },
        });

        // Refund credits
        const refundSuccess = await WorkspaceCreditManager.refundCredits(
          userId,
          job.creditsCost,
        );

        if (!refundSuccess) {
          return textResult(
            `**Warning: REFUND_FAILED**\nJob cancelled but credit refund failed. Please contact support.\n`
              + `**Job ID:** ${job_id}\n`
              + `**Credits to Refund:** ${job.creditsCost}\n`,
          );
        }

        const newBalance = await WorkspaceCreditManager.getBalance(userId);

        return textResult(
          `**Job Cancelled!**\n\n`
            + `**Job ID:** ${job_id}\n`
            + `**Credits Refunded:** ${job.creditsCost}\n`
            + `**New Balance:** ${newBalance?.remaining ?? 0}\n`,
        );
      }),
  });

  registry.register({
    name: "get_enhancement_job",
    description: "Get the status and details of an enhancement job.",
    category: "enhancement-jobs",
    tier: "free",
    inputSchema: GetEnhancementJobSchema.shape,
    handler: async ({
      job_id,
    }: z.infer<typeof GetEnhancementJobSchema>): Promise<CallToolResult> =>
      safeToolCall("get_enhancement_job", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const job = await prisma.imageEnhancementJob.findUnique({
          where: { id: job_id },
          include: {
            image: {
              select: {
                id: true,
                name: true,
                originalUrl: true,
              },
            },
          },
        });

        if (!job || job.userId !== userId) {
          return textResult(
            `**Error: JOB_NOT_FOUND**\nJob '${job_id}' not found.\n**Retryable:** false`,
          );
        }

        let text = `**Enhancement Job: ${job_id}**\n\n`;
        text += `**Status:** ${job.status}\n`;
        text += `**Tier:** ${job.tier}\n`;
        text += `**Credits Cost:** ${job.creditsCost}\n`;
        text += `**Image:** ${job.image.name} (\`${job.image.id}\`)\n`;
        text += `**Created:** ${job.createdAt.toISOString()}\n`;

        if (job.enhancedUrl) {
          text += `**Enhanced URL:** ${job.enhancedUrl}\n`;
        }
        if (job.enhancedWidth && job.enhancedHeight) {
          text += `**Enhanced Size:** ${job.enhancedWidth}x${job.enhancedHeight}\n`;
        }
        if (job.errorMessage) {
          text += `**Error:** ${job.errorMessage}\n`;
        }
        if (job.processingStartedAt) {
          text += `**Processing Started:** ${job.processingStartedAt.toISOString()}\n`;
        }
        if (job.processingCompletedAt) {
          text += `**Processing Completed:** ${job.processingCompletedAt.toISOString()}\n`;
        }

        return textResult(text);
      }),
  });

  registry.register({
    name: "list_enhancement_jobs",
    description:
      "List enhancement jobs with optional filters. Shows job history and current status.",
    category: "enhancement-jobs",
    tier: "free",
    inputSchema: ListEnhancementJobsSchema.shape,
    handler: async ({
      image_id,
      status,
      limit,
    }: z.infer<typeof ListEnhancementJobsSchema>): Promise<CallToolResult> =>
      safeToolCall("list_enhancement_jobs", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const where: Record<string, unknown> = { userId };
        if (image_id) where.imageId = image_id;
        if (status) where.status = status;

        const jobs = await prisma.imageEnhancementJob.findMany({
          where,
          select: {
            id: true,
            status: true,
            tier: true,
            creditsCost: true,
            imageId: true,
            createdAt: true,
            enhancedUrl: true,
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        });

        if (jobs.length === 0) {
          return textResult(
            `**Enhancement Jobs (0)**\n\nNo jobs found matching your filters.`,
          );
        }

        let text = `**Enhancement Jobs (${jobs.length})**\n\n`;
        for (const job of jobs) {
          text += `- **${job.id}** — ${job.status} | ${job.tier} | ${job.creditsCost} credits`;
          text += ` | Image: \`${job.imageId}\``;
          if (job.enhancedUrl) text += ` | Enhanced`;
          text += `\n`;
        }

        return textResult(text);
      }),
  });
}
