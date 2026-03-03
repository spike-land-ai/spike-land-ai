import { z } from "zod";
import type { SubjectReference } from "../types.js";
import {
  asImageId,
  errorResult,
  GENERATION_OUTPUT_FORMAT_VALUES,
  GENERATION_RESOLUTION_VALUES,
  IMG_DEFAULTS,
  jsonResult,
  toolEvent,
  MODEL_PREFERENCE_VALUES,
  REFERENCE_ROLE_VALUES,
  SUPPORTED_ASPECT_RATIOS,
} from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure } from "../tool-builder/image-middleware.js";

export const generateTool = imageProcedure
  .tool(
    "generate",
    "Generate images from text prompts with optional reference images, subjects, and advanced options",
    {
      prompt: z.string().describe("Text prompt for image generation").optional(),
      negative_prompt: z.string().describe("What to avoid in the generated image").optional(),
      aspect_ratio: z
        .enum(SUPPORTED_ASPECT_RATIOS)
        .describe("Aspect ratio (default 1:1)")
        .optional(),
      tier: z
        .enum(["FREE", "TIER_0_5K", "TIER_1K", "TIER_2K", "TIER_4K"])
        .describe("Quality tier — higher tiers cost more credits")
        .optional(),
      model_preference: z
        .enum(MODEL_PREFERENCE_VALUES)
        .describe("Model routing hint: default, quality, speed, latest")
        .optional(),
      resolution: z
        .enum(GENERATION_RESOLUTION_VALUES)
        .describe("Output resolution (advanced)")
        .optional(),
      thinking_mode: z
        .boolean()
        .describe("Enable thinking mode for better prompt interpretation")
        .optional(),
      google_search_grounding: z
        .boolean()
        .describe("Ground generation in current web knowledge")
        .optional(),
      text_to_render: z.string().describe("Text to render inside the image").optional(),
      subject_refs: z
        .array(z.string().describe("Subject ID or label"))
        .describe("Subject labels or IDs to include")
        .optional(),
      reference_images: z
        .array(
          z.object({
            url: z.string().describe("External URL of reference image").optional(),
            image_id: z
              .string()
              .describe("ID of a user-owned image to use as reference")
              .optional(),
            role: z
              .enum(REFERENCE_ROLE_VALUES)
              .describe("Role: style, subject, composition, color")
              .optional(),
          }),
        )
        .describe("Reference images for style/subject transfer")
        .optional(),
      seed: z.number().describe("Random seed for reproducibility").optional(),
      output_format: z
        .enum(GENERATION_OUTPUT_FORMAT_VALUES)
        .describe("Output format: png, jpeg, webp")
        .optional(),
      num_images: z
        .number()
        .min(1)
        .max(4)
        .describe("Number of images to generate (1-4)")
        .optional(),
    },
  )
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;
    const {
      negative_prompt,
      thinking_mode,
      google_search_grounding,
      text_to_render,
      subject_refs,
      reference_images,
      seed,
      num_images,
    } = input;
    const prompt = input.prompt ?? IMG_DEFAULTS.promptGenerate;
    const tier = input.tier ?? IMG_DEFAULTS.tier;
    const aspectRatio = input.aspect_ratio ?? IMG_DEFAULTS.aspectRatio;
    const modelPreference = input.model_preference ?? IMG_DEFAULTS.modelPreference;
    const resolution = input.resolution;
    const outputFormat = input.output_format;

    const creditsCost = deps.credits.calculateGenerationCost({
      tier,
      numImages: num_images,
      hasGrounding: google_search_grounding,
      hasTextRender: !!text_to_render,
      numSubjects: subject_refs?.length,
      numReferences: reference_images?.length,
    });

    const hasEnough = await deps.credits.hasEnough(userId, creditsCost);
    if (!hasEnough) {
      return errorResult("BALANCE_ERROR", `Insufficient credits. Required: ${creditsCost}`);
    }

    // ── Reference generation path ──
    if (reference_images && reference_images.length > 0) {
      if (!deps.generation.createReferenceGenerationJob) {
        return errorResult("NOT_SUPPORTED", "Reference generation is not available", true);
      }

      const refs: Array<{
        imageId?: string;
        url?: string;
        role: (typeof REFERENCE_ROLE_VALUES)[number];
      }> = [];
      for (const ref of reference_images) {
        if (ref.image_id) {
          const imgRes = await tryCatch(deps.resolvers.resolveImage(asImageId(ref.image_id)));
          if (!imgRes.ok || !imgRes.data || imgRes.data.userId !== userId) {
            return errorResult("IMAGE_NOT_FOUND", `Reference image ${ref.image_id} not found`);
          }
          refs.push({ imageId: imgRes.data.id, role: ref.role ?? "style" });
        } else if (ref.url) {
          refs.push({ url: ref.url, role: ref.role ?? "style" });
        }
      }

      const resp = await tryCatch(
        deps.generation.createReferenceGenerationJob({
          userId,
          prompt,
          tier,
          referenceImages: refs,
          seed,
          outputFormat,
          numImages: num_images,
        }),
      );

      if (!resp.ok) {
        return errorResult("GENERATION_FAILED", resp.error.message, true);
      }
      /* v8 ignore next */
if (!resp.data.success) {
        return errorResult("GENERATION_FAILED", resp.data.error ?? "Reference generation failed");
      }
      ctx.notify?.(toolEvent("job:created", resp.data.jobId!, { tier, status: "PENDING" }));
      return jsonResult({
        jobId: resp.data.jobId,
        status: "PENDING",
        tier,
        creditsCost: resp.data.creditsCost,
      });
    }

    // ── Advanced generation path ──
    const hasAdvancedParams =
      resolution !== undefined ||
      thinking_mode !== undefined ||
      google_search_grounding !== undefined ||
      text_to_render !== undefined ||
      (subject_refs !== undefined && subject_refs.length > 0);

    if (hasAdvancedParams) {
      if (!deps.generation.createAdvancedGenerationJob) {
        return errorResult("NOT_SUPPORTED", "Advanced generation is not available", true);
      }

      let subjects: SubjectReference[] | undefined;
      if (subject_refs && subject_refs.length > 0 && deps.db.subjectFindMany) {
        const subRes = await tryCatch(deps.db.subjectFindMany({ userId }));
        if (!subRes.ok || !subRes.data) {
          return errorResult("SUBJECT_LIST_FAILED", "Failed to fetch subjects", true);
        }
        subjects = [];
        for (const ref of subject_refs) {
          const sub = subRes.data.find((s) => s.id === ref || s.label === ref);
          if (!sub) {
            return errorResult("SUBJECT_NOT_FOUND", `Subject "${ref}" not found`);
          }
          subjects.push({
            label: sub.label,
            type: sub.type,
            sourceImageId: sub.imageId,
          });
        }
      }

      const resp = await tryCatch(
        deps.generation.createAdvancedGenerationJob({
          userId,
          prompt,
          tier,
          options: {
            modelPreference,
            resolution,
            thinkingMode: thinking_mode,
            googleSearchGrounding: google_search_grounding,
            textToRender: text_to_render,
            subjects,
            seed,
            outputFormat,
            numImages: num_images,
            negativePrompt: negative_prompt,
            aspectRatio,
          },
        }),
      );

      if (!resp.ok) {
        return errorResult("GENERATION_FAILED", resp.error.message, true);
      }
      if (!resp.data.success) {
        return errorResult("GENERATION_FAILED", resp.data.error ?? "Advanced generation failed");
      }
      ctx.notify?.(toolEvent("job:created", resp.data.jobId!, { tier, status: "PENDING" }));
      return jsonResult({
        jobId: resp.data.jobId,
        status: "PENDING",
        tier,
        creditsCost: resp.data.creditsCost,
      });
    }

    // ── Basic generation path ──
    const resp = await tryCatch(
      deps.generation.createGenerationJob({
        userId,
        prompt,
        tier,
        negativePrompt: negative_prompt,
        aspectRatio,
        seed,
        outputFormat,
        numImages: num_images,
      }),
    );

    if (!resp.ok) {
      return errorResult("GENERATION_FAILED", resp.error.message, true);
    }
    if (!resp.data.success) {
      return errorResult("GENERATION_FAILED", resp.data.error ?? "Generation failed");
    }
    ctx.notify?.(toolEvent("job:created", resp.data.jobId!, { tier, status: "PENDING" }));
    return jsonResult({
      jobId: resp.data.jobId,
      status: "PENDING",
      tier,
      creditsCost: resp.data.creditsCost,
    });
  });

export const generate = generateTool.handler;
export const GenerateInputSchema = z.object(generateTool.inputSchema);
export type GenerateInput = Parameters<typeof generate>[0];
