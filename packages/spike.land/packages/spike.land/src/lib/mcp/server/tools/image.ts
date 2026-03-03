/**
 * Image Tools (Server-Side)
 *
 * Calls the generation service directly instead of going through HTTP.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { createGenerationJob } from "@/lib/mcp/generation-service";
import type { EnhancementTier } from "@/lib/credits/costs";
import type { AspectRatio } from "@/lib/ai/aspect-ratio";
import prisma from "@/lib/prisma";

const SUPPORTED_ASPECT_RATIOS = [
  "1:1",
  "3:2",
  "2:3",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;

const GenerateImageSchema = z.object({
  prompt: z.string().describe("Text description of the image to generate"),
  tier: z.enum(["TIER_1K", "TIER_2K", "TIER_4K"]).optional().default("TIER_1K"),
  negative_prompt: z.string().optional().describe("Things to avoid"),
  aspect_ratio: z.enum(SUPPORTED_ASPECT_RATIOS).optional(),
  wait_for_completion: z.boolean().optional().default(true),
});

const ModifyImageSchema = z.object({
  prompt: z.string().describe("How to modify the image"),
  image_url: z.string().optional(),
  image_base64: z.string().optional(),
  mime_type: z.string().optional().default("image/jpeg"),
  tier: z.enum(["TIER_1K", "TIER_2K", "TIER_4K"]).optional().default("TIER_1K"),
  wait_for_completion: z.boolean().optional().default(true),
});

const CheckJobSchema = z.object({
  job_id: z.string().describe("The job ID to check"),
});

async function waitForJobCompletion(jobId: string, maxAttempts = 60): Promise<{
  id: string;
  status: string;
  outputImageUrl: string | null;
  outputWidth: number | null;
  outputHeight: number | null;
  tokensCost: number;
  errorMessage: string | null;
  type: string;
  prompt: string;
}> {
  for (let i = 0; i < maxAttempts; i++) {
    const job = await prisma.mcpGenerationJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new Error("Job not found");

    if (
      job.status === "COMPLETED" || job.status === "FAILED"
      || job.status === "REFUNDED"
    ) {
      return {
        id: job.id,
        status: job.status,
        outputImageUrl: job.outputImageUrl,
        outputWidth: job.outputWidth,
        outputHeight: job.outputHeight,
        tokensCost: job.creditsCost,
        errorMessage: job.errorMessage,
        type: job.type,
        prompt: job.prompt,
      };
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error("Job timed out");
}

export function registerImageTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "generate_image",
    description:
      `Generate a new image from a text prompt using Spike Land's AI.\n\nSupported aspect ratios: ${
        SUPPORTED_ASPECT_RATIOS.join(", ")
      }\n\nToken costs: TIER_1K (1024px): 2, TIER_2K (2048px): 5, TIER_4K (4096px): 10`,
    category: "image",
    tier: "free",
    inputSchema: GenerateImageSchema.shape,
    handler: async (
      { prompt, tier, negative_prompt, aspect_ratio, wait_for_completion }: z.infer<
        typeof GenerateImageSchema
      >,
    ): Promise<CallToolResult> => {
      try {
        const result = await createGenerationJob({
          userId,
          prompt: prompt.trim(),
          tier: tier as EnhancementTier,
          negativePrompt: negative_prompt?.trim(),
          aspectRatio: aspect_ratio as AspectRatio | undefined,
        });

        if (!result.success || !result.jobId) {
          return {
            content: [{
              type: "text",
              text: `Failed: ${result.error || "Unknown error"}`,
            }],
            isError: true,
          };
        }

        if (wait_for_completion) {
          const status = await waitForJobCompletion(result.jobId);
          if (status.status === "FAILED") {
            return {
              content: [{
                type: "text",
                text: `Failed: ${status.errorMessage || "Unknown error"}`,
              }],
              isError: true,
            };
          }
          return {
            content: [{
              type: "text",
              text:
                `Image generated!\n\n**Job ID:** ${status.id}\n**Image URL:** ${status.outputImageUrl}\n**Dimensions:** ${status.outputWidth}x${status.outputHeight}\n**Tokens:** ${status.tokensCost}`,
            }],
          };
        }

        return {
          content: [{
            type: "text",
            text:
              `Generation started!\n\n**Job ID:** ${result.jobId}\n**Tokens:** ${result.creditsCost}\n\nUse check_job to check status.`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
          }],
          isError: true,
        };
      }
    },
  });

  registry.register({
    name: "modify_image",
    description:
      `Modify an existing image using a text prompt.\n\nProvide image_url or image_base64.\n\nToken costs: TIER_1K: 2, TIER_2K: 5, TIER_4K: 10`,
    category: "image",
    tier: "free",
    inputSchema: ModifyImageSchema.shape,
    handler: async (
      { prompt, image_url, image_base64, mime_type, tier, wait_for_completion }: z.infer<
        typeof ModifyImageSchema
      >,
    ): Promise<CallToolResult> => {
      try {
        let imageData: string;
        let mimeType = mime_type || "image/jpeg";

        if (image_base64) {
          imageData = image_base64;
        } else if (image_url) {
          const response = await fetch(image_url);
          if (!response.ok) {
            return {
              content: [{
                type: "text",
                text: `Failed to fetch image: ${response.statusText}`,
              }],
              isError: true,
            };
          }
          const buf = await response.arrayBuffer();
          imageData = Buffer.from(buf).toString("base64");
          mimeType = response.headers.get("content-type") || mimeType;
        } else {
          return {
            content: [{
              type: "text",
              text: "Either image_url or image_base64 required",
            }],
            isError: true,
          };
        }

        const { createModificationJob } = await import(
          "@/lib/mcp/generation-service"
        );
        const result = await createModificationJob({
          userId,
          prompt: prompt.trim(),
          imageData,
          mimeType,
          tier: tier as EnhancementTier,
        });

        if (!result.success || !result.jobId) {
          return {
            content: [{
              type: "text",
              text: `Failed: ${result.error || "Unknown error"}`,
            }],
            isError: true,
          };
        }

        if (wait_for_completion) {
          const status = await waitForJobCompletion(result.jobId);
          if (status.status === "FAILED") {
            return {
              content: [{
                type: "text",
                text: `Failed: ${status.errorMessage || "Unknown error"}`,
              }],
              isError: true,
            };
          }
          return {
            content: [{
              type: "text",
              text:
                `Image modified!\n\n**Job ID:** ${status.id}\n**Image URL:** ${status.outputImageUrl}\n**Dimensions:** ${status.outputWidth}x${status.outputHeight}\n**Tokens:** ${status.tokensCost}`,
            }],
          };
        }

        return {
          content: [{
            type: "text",
            text:
              `Modification started!\n\n**Job ID:** ${result.jobId}\n**Tokens:** ${result.creditsCost}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
          }],
          isError: true,
        };
      }
    },
  });

  registry.register({
    name: "check_job",
    description: "Check the status of an image generation or modification job",
    category: "image",
    tier: "free",
    inputSchema: CheckJobSchema.shape,
    handler: async (
      { job_id }: z.infer<typeof CheckJobSchema>,
    ): Promise<CallToolResult> => {
      try {
        const job = await prisma.mcpGenerationJob.findUnique({
          where: { id: job_id },
          select: {
            id: true,
            type: true,
            status: true,
            prompt: true,
            creditsCost: true,
            outputImageUrl: true,
            outputWidth: true,
            outputHeight: true,
            errorMessage: true,
          },
        });

        if (!job) {
          return {
            content: [{ type: "text", text: "Job not found" }],
            isError: true,
          };
        }

        let text =
          `**Job ID:** ${job.id}\n**Type:** ${job.type}\n**Status:** ${job.status}\n**Tokens:** ${job.creditsCost}\n**Prompt:** ${job.prompt}`;
        if (job.status === "COMPLETED" && job.outputImageUrl) {
          text +=
            `\n**Image URL:** ${job.outputImageUrl}\n**Dimensions:** ${job.outputWidth}x${job.outputHeight}`;
        }
        if (job.status === "FAILED" && job.errorMessage) {
          text += `\n**Error:** ${job.errorMessage}`;
        }

        return { content: [{ type: "text", text }] };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
          }],
          isError: true,
        };
      }
    },
  });
}
