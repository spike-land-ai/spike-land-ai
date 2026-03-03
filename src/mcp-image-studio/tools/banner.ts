import { z } from "zod";
import type { AspectRatio } from "../types.js";
import { errorResult, IMG_DEFAULTS, jsonResult, toolEvent } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure } from "../tool-builder/image-middleware.js";
import { consumeCreditsOrError } from "../define-tool.js";

const PRESET_ASPECT_RATIOS: Record<
  string,
  { aspectRatio: AspectRatio; recommended_size?: string }
> = {
  github_readme: { aspectRatio: "16:9" },
  twitter_header: { aspectRatio: "4:1" },
  youtube_thumbnail: { aspectRatio: "16:9" },
  linkedin_cover: { aspectRatio: "4:1" },
  og: { aspectRatio: "16:9", recommended_size: "1200x630" },
};

function buildOgPrompt(title: string, subtitle?: string, prompt?: string): string {
  const parts = [IMG_DEFAULTS.promptBannerOg, `Title: "${title}".`];
  if (subtitle) parts.push(`Subtitle: "${subtitle}".`);
  if (prompt) parts.push(prompt);
  return parts.join(" ");
}

export const bannerTool = imageProcedure
  .tool(
    "banner",
    "Generates a banner or social media header image based on a prompt, preset platform size, and optional text.",
    {
      prompt: z.string().describe("Description of the desired banner"),
      preset: z
        .enum([
          "github_readme",
          "twitter_header",
          "youtube_thumbnail",
          "linkedin_cover",
          "og",
          "custom",
        ])
        .describe(
          "Platform preset: github_readme, twitter_header, youtube_thumbnail, linkedin_cover, og, or custom",
        ),
      custom_aspect_ratio: z
        .string()
        .describe("Custom aspect ratio (only used with preset=custom)")
        .optional(),
      tier: z
        .enum(["FREE", "TIER_0_5K", "TIER_1K", "TIER_2K", "TIER_4K"])
        .describe("Enhancement tier for generation quality")
        .optional(),
      title: z.string().describe("Title text to overlay on the banner").optional(),
      subtitle: z.string().describe("Subtitle text to overlay on the banner").optional(),
    },
  )
  // TODO: validate -> refine
  /* .validate((input) => {
  if (input.preset === "custom" && !input.custom_aspect_ratio) {
    return errorResult("INVALID_INPUT", "custom_aspect_ratio is required when preset is 'custom'");
  }
  return;
}) */
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;
    const tier = input.tier ?? "TIER_1K";
    const cost = deps.credits.calculateGenerationCost({
      tier,
      hasTextRender: !!input.title,
    });

    let aspectRatio: AspectRatio;
    let recommendedSize: string | undefined;
    if (input.preset === "custom") {
      // Guaranteed by validation
      aspectRatio = input.custom_aspect_ratio as AspectRatio;
    } else {
      const presetInfo = PRESET_ASPECT_RATIOS[input.preset];
      aspectRatio = presetInfo?.aspectRatio ?? "16:9";
      recommendedSize = presetInfo?.recommended_size;
    }

    const fullPrompt = input.title
      ? buildOgPrompt(input.title, input.subtitle, input.prompt)
      : `A banner image for ${input.preset.replace(/_/g, " ")}. ${input.prompt}`;

    // Use advanced generation when title is provided and the capability exists
    if (input.title && deps.generation.createAdvancedGenerationJob) {
      const jobRes = await tryCatch(
        deps.generation.createAdvancedGenerationJob({
          userId,
          prompt: fullPrompt,
          tier,
          options: { textToRender: input.title },
        }),
      );

      if (!jobRes.ok) {
        return errorResult("GENERATION_FAILED", jobRes.error.message, true);
      }
      /* v8 ignore next */
if (!jobRes.data?.success) {
        return errorResult(
          "GENERATION_FAILED",
          jobRes.data?.error ?? "Failed to create banner job",
          true,
        );
      }

      const { error } = await consumeCreditsOrError(
        deps,
        userId,
        cost,
        "banner",
        jobRes.data.jobId,
        ctx,
      );
      if (error) return error;

      ctx.notify?.(
        toolEvent("job:created", jobRes.data.jobId!, {
          tier,
          preset: input.preset,
          status: "PENDING",
        }),
      );

      return jsonResult({
        jobId: jobRes.data.jobId,
        creditsCost: jobRes.data.creditsCost ?? cost,
        preset: input.preset,
        aspect_ratio: aspectRatio,
        ...(recommendedSize ? { recommended_size: recommendedSize } : {}),
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
        jobRes.data?.error ?? "Failed to create banner job",
        true,
      );
    }

    const { error } = await consumeCreditsOrError(
      deps,
      userId,
      cost,
      "banner",
      jobRes.data.jobId,
      ctx,
    );
    if (error) return error;

    ctx.notify?.(
      toolEvent("job:created", jobRes.data.jobId!, {
        tier,
        preset: input.preset,
        status: "PENDING",
      }),
    );

    return jsonResult({
      jobId: jobRes.data.jobId,
      creditsCost: jobRes.data.creditsCost ?? cost,
      preset: input.preset,
      aspect_ratio: aspectRatio,
      ...(recommendedSize ? { recommended_size: recommendedSize } : {}),
    });
  });

export const banner = bannerTool.handler;
export const BannerInputSchema = z.object(bannerTool.inputSchema);
export type BannerInput = Parameters<typeof banner>[0];
