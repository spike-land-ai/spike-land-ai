import { z } from "zod";
import type { AspectRatio, EnhancementTier } from "../types.js";
import {
  errorResult,
  jsonResult,
  toolEvent,
  DIAGRAM_TYPE_VALUES,
  DIAGRAM_STYLE_VALUES,
} from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure, withCredits } from "../tool-builder/image-middleware.js";

export const diagramTool = imageProcedure
  .use(
    withCredits({
      cost: (input, deps) =>
        deps.credits.calculateGenerationCost({
          tier: ((input as Record<string, unknown>).tier as EnhancementTier) ?? "TIER_1K",
        }),
      source: "diagram",
    }),
  )
  .tool("diagram", "Description of the diagram to generate", {
    prompt: z.string().describe("Description of the diagram to generate"),
    type: z
      .enum(DIAGRAM_TYPE_VALUES)
      .describe("Diagram type: architecture, flowchart, sequence, er, or network")
      .optional(),
    style: z
      .enum(DIAGRAM_STYLE_VALUES)
      .describe("Visual style: technical, hand_drawn, or minimal")
      .optional(),
    tier: z
      .enum(["FREE", "TIER_0_5K", "TIER_1K", "TIER_2K", "TIER_4K"])
      .describe("Enhancement tier for output quality")
      .optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;
    const tier = input.tier ?? "TIER_1K";
    const diagramType = input.type ?? "architecture";
    const style = input.style ?? "technical";
    const cost = ctx.billing.creditsCost;
    const aspectRatio: AspectRatio = diagramType === "sequence" ? "3:4" : "16:9";

    const fullPrompt = `A clear, readable ${diagramType} diagram. Style: ${style}. ${input.prompt}`;

    if (deps.generation.createAdvancedGenerationJob) {
      const jobRes = await tryCatch(
        deps.generation.createAdvancedGenerationJob({
          userId,
          prompt: fullPrompt,
          tier,
          options: { thinkingMode: true },
        }),
      );

      if (!jobRes.ok) {
        return errorResult("GENERATION_FAILED", jobRes.error.message, true);
      }
      if (!jobRes.data?.success) {
        return errorResult(
          "GENERATION_FAILED",
          jobRes.data?.error ?? "Failed to create diagram job",
          true,
        );
      }

      ctx.notify?.(
        toolEvent("job:created", jobRes.data.jobId!, {
          tier,
          diagram_type: diagramType,
          status: "PENDING",
        }),
      );
      return jsonResult({
        jobId: jobRes.data.jobId,
        creditsCost: jobRes.data.creditsCost ?? cost,
        diagram_type: diagramType,
        aspect_ratio: aspectRatio,
      });
    }

    const jobRes = await tryCatch(
      deps.generation.createGenerationJob({
        userId,
        prompt: fullPrompt,
        tier,
        aspectRatio,
      }),
    );

    if (!jobRes.ok) {
      return errorResult("GENERATION_FAILED", jobRes.error.message, true);
    }
    if (!jobRes.data?.success) {
      return errorResult(
        "GENERATION_FAILED",
        jobRes.data?.error ?? "Failed to create diagram job",
        true,
      );
    }

    ctx.notify?.(
      toolEvent("job:created", jobRes.data.jobId!, {
        tier,
        diagram_type: diagramType,
        status: "PENDING",
      }),
    );
    return jsonResult({
      jobId: jobRes.data.jobId,
      creditsCost: jobRes.data.creditsCost ?? cost,
      diagram_type: diagramType,
      aspect_ratio: aspectRatio,
    });
  });

export const diagram = diagramTool.handler;
export const DiagramInputSchema = z.object(diagramTool.inputSchema);
export type DiagramInput = Parameters<typeof diagram>[0];
