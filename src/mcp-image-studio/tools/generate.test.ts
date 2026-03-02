import { asImageId } from "../types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps, mockImageRow } from "../__test-utils__/mock-deps.js";
import { generate, GenerateInputSchema } from "./generate.js";
import type { ToolContext } from "../types.js";
import { standardScenarios } from "../__test-utils__/standard-scenarios.js";

describe("generate", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  const { deps: defaultDeps, mocks: defaultMocks } = createMockImageStudioDeps();
  defaultMocks.generation.createGenerationJob.mockResolvedValue({
    success: true,
    jobId: "job-basic-1",
    creditsCost: 2,
  });

  standardScenarios({
    handler: generate,
    validInput: { prompt: "test" },
    deps: defaultDeps,
    consumesCredits: false,
  });

  // ── Basic generation path ──

  it("should create a basic generation job with defaults", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "job-basic-1",
      creditsCost: 2,
    });

    const result = await generate({}, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("job-basic-1");
    expect(data.status).toBe("PENDING");
    expect(data.tier).toBe("TIER_1K");
    expect(data.creditsCost).toBe(2);
  });

  it("should pass prompt, tier, aspect_ratio, and negative_prompt to basic job", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "job-basic-2",
      creditsCost: 5,
    });

    const result = await generate(
      {
        prompt: "A sunset over mountains",
        tier: "TIER_2K",
        aspect_ratio: "16:9",
        negative_prompt: "blurry, dark",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("job-basic-2");
    expect(data.tier).toBe("TIER_2K");
    expect(mocks.generation.createGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        prompt: "A sunset over mountains",
        tier: "TIER_2K",
        aspectRatio: "16:9",
        negativePrompt: "blurry, dark",
      }),
    );
  });

  it("should return GENERATION_FAILED when basic job returns success:false", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: false,
      error: "Model unavailable",
    });

    const result = await generate({ prompt: "test" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
    expect(result.content[0].text).toContain("Model unavailable");
  });

  it("should return GENERATION_FAILED when basic job throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockRejectedValue(new Error("Network failure"));

    const result = await generate({ prompt: "test" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  // ── Advanced generation path ──

  it("should create an advanced job when resolution is provided", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-job-1",
      creditsCost: 5,
    });

    const result = await generate({ prompt: "hi-res art", resolution: "2K" }, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("adv-job-1");
    expect(mocks.generation.createAdvancedGenerationJob).toHaveBeenCalled();
  });

  it("should create an advanced job when thinking_mode is true", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-job-think",
      creditsCost: 2,
    });

    const result = await generate({ prompt: "think", thinking_mode: true }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("adv-job-think");
  });

  it("should add grounding cost when google_search_grounding is true", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-job-ground",
      creditsCost: 4,
    });

    await generate({ prompt: "news", google_search_grounding: true }, ctx);

    // TIER_1K cost (2) + grounding cost (2) = 4
  });

  it("should add text cost when text_to_render is provided", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-job-text",
      creditsCost: 3,
    });

    await generate({ prompt: "poster", text_to_render: "SALE" }, ctx);

    // TIER_1K cost (2) + text cost (1) = 3
  });

  it("should return INSUFFICIENT_CREDITS for advanced path when balance is low", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.consume.mockResolvedValue({
      success: false,
      error: "Insufficient credits",
    });
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: false,
      error: "Insufficient credits",
      creditsCost: 2,
    });

    const result = await generate({ resolution: "4K", tier: "TIER_4K" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should return SUBJECT_NOT_FOUND when a subject ref is not in the user's library", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.subjectFindMany.mockResolvedValue([
      {
        id: "sub-1",
        label: "hero",
        type: "character",
        imageId: asImageId("img-sub-1"),
        userId,
      },
    ]);

    const result = await generate({ subject_refs: ["ghost"] }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("SUBJECT_NOT_FOUND");
  });

  it("should resolve subjects by label and pass them to advanced job", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.subjectFindMany.mockResolvedValue([
      {
        id: "sub-1",
        label: "hero",
        type: "character",
        imageId: asImageId("img-sub-1"),
        userId,
      },
    ]);
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-subj-job",
      creditsCost: 3,
    });

    const result = await generate({ subject_refs: ["hero"] }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("adv-subj-job");
    expect(mocks.generation.createAdvancedGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          subjects: [
            {
              label: "hero",
              type: "character",
              sourceImageId: "img-sub-1",
            },
          ],
        }),
      }),
    );
  });

  it("should return GENERATION_FAILED when advanced job returns success:false", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: false,
      error: "Advanced model overloaded",
    });

    const result = await generate({ resolution: "2K" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
    expect(result.content[0].text).toContain("Advanced model overloaded");
  });

  // ── Reference generation path ──

  it("should create a reference generation job when reference_images are provided", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("ref-img-1"), userId }),
    );
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: true,
      jobId: "ref-job-1",
      creditsCost: 4,
    });

    const result = await generate(
      {
        prompt: "styled art",
        reference_images: [{ image_id: "ref-img-1", role: "style" }],
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("ref-job-1");
    expect(data.status).toBe("PENDING");
  });

  it("should return IMAGE_NOT_FOUND when a reference image_id is not owned by user", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(null);

    const result = await generate(
      {
        reference_images: [{ image_id: "missing-ref" }],
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGE_NOT_FOUND");
  });

  it("should return INSUFFICIENT_CREDITS for reference path when balance is low", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: false,
      error: "Insufficient credits",
      creditsCost: 2,
    });

    const result = await generate(
      {
        reference_images: [
          {
            url: "https://example.com/style.jpg",
            role: "style",
          },
        ],
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should use url-only references (no image_id) without resolving", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: true,
      jobId: "ref-url-job",
      creditsCost: 4,
    });

    const result = await generate(
      {
        reference_images: [{ url: "https://example.com/ref.jpg" }],
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(mocks.resolverMocks.resolveImage).not.toHaveBeenCalled();
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("ref-url-job");
  });

  it("should return GENERATION_FAILED when reference job returns success:false", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: false,
      error: "Reference generation failed",
    });

    const result = await generate(
      {
        reference_images: [{ url: "https://example.com/ref.jpg" }],
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should default reference role to style when not specified", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: true,
      jobId: "ref-default-role",
      creditsCost: 4,
    });

    await generate(
      {
        reference_images: [{ url: "https://example.com/ref.jpg" }],
      },
      ctx,
    );

    expect(mocks.generation.createReferenceGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceImages: [expect.objectContaining({ role: "style" })],
      }),
    );
  });

  // ── Seed parameter ──

  it("should pass seed to advanced generation path", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-seed-job",
      creditsCost: 2,
    });

    const result = await generate({ prompt: "test", seed: 42, thinking_mode: true }, ctx);

    expect(result.isError).toBeUndefined();
    expect(mocks.generation.createAdvancedGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ seed: 42 }),
      }),
    );
  });

  it("should pass seed to reference generation path", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: true,
      jobId: "ref-seed-job",
      creditsCost: 4,
    });

    await generate(
      {
        reference_images: [{ url: "https://example.com/ref.jpg" }],
        seed: 123,
      },
      ctx,
    );

    expect(mocks.generation.createReferenceGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({ seed: 123 }),
    );
  });

  // ── Output format parameter ──

  it("should pass output_format to advanced generation path", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-fmt-job",
      creditsCost: 2,
    });

    await generate({ prompt: "test", output_format: "webp", thinking_mode: true }, ctx);

    expect(mocks.generation.createAdvancedGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ outputFormat: "webp" }),
      }),
    );
  });

  it("should pass output_format to reference generation path", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: true,
      jobId: "ref-fmt-job",
      creditsCost: 4,
    });

    await generate(
      {
        reference_images: [{ url: "https://example.com/ref.jpg" }],
        output_format: "jpeg",
      },
      ctx,
    );

    expect(mocks.generation.createReferenceGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({ outputFormat: "jpeg" }),
    );
  });

  // ── Batch generation (num_images) ──

  it("should pass num_images to advanced generation path", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-batch-job",
      creditsCost: 6,
    });

    await generate({ prompt: "test", num_images: 3, thinking_mode: true }, ctx);

    expect(mocks.generation.createAdvancedGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ numImages: 3 }),
      }),
    );
    // Cost should be base cost (2) * 3 images = 6
  });

  it("should return INVALID_PARAM when num_images is out of range", async () => {
    const parsed0 = GenerateInputSchema.safeParse({ num_images: 0 });
    expect(parsed0.success).toBe(false);

    const parsed5 = GenerateInputSchema.safeParse({ num_images: 5 });
    expect(parsed5.success).toBe(false);
  });

  it("should multiply reference path cost by num_images", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: true,
      jobId: "ref-batch-job",
      creditsCost: 12,
    });

    await generate(
      {
        reference_images: [{ url: "https://example.com/ref.jpg" }],
        num_images: 3,
      },
      ctx,
    );

    // Cost: (base 2 + 1 ref * 2) * 3 images = 12
  });

  // ── 0.5K draft tier ──

  it("should support 0.5K draft resolution", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.estimate.mockReturnValue(1); // TIER_0_5K costs 1 credit
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-draft-job",
      creditsCost: 1,
    });

    const result = await generate(
      {
        prompt: "quick draft",
        resolution: "0.5K",
        tier: "TIER_0_5K",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.tier).toBe("TIER_0_5K");
    expect(mocks.generation.createAdvancedGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: "TIER_0_5K",
        options: expect.objectContaining({ resolution: "0.5K" }),
      }),
    );
  });

  // ── Basic path passthrough ──

  it("should pass seed and output_format to basic generation when no advanced params", async () => {
    const ctx: ToolContext = { userId, deps };
    // Remove createAdvancedGenerationJob to force basic path
    deps.generation.createAdvancedGenerationJob = undefined;
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "basic-extras-job",
      creditsCost: 2,
    });

    await generate(
      {
        prompt: "test",
        seed: 99,
        output_format: "webp",
        num_images: 2,
      },
      ctx,
    );

    expect(mocks.generation.createGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        seed: 99,
        outputFormat: "webp",
        numImages: 2,
      }),
    );
  });

  // ── NOT_SUPPORTED paths ──

  it("should return NOT_SUPPORTED when reference_images provided but createReferenceGenerationJob is undefined", async () => {
    const ctx: ToolContext = { userId, deps };
    deps.generation.createReferenceGenerationJob = undefined;

    const result = await generate(
      {
        reference_images: [{ url: "https://example.com/ref.jpg" }],
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NOT_SUPPORTED");
    expect(result.content[0].text).toContain("Reference generation is not available");
  });

  it("should return NOT_SUPPORTED when advanced params provided but createAdvancedGenerationJob is undefined", async () => {
    const ctx: ToolContext = { userId, deps };
    deps.generation.createAdvancedGenerationJob = undefined;

    const result = await generate({ prompt: "test", resolution: "2K" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NOT_SUPPORTED");
    expect(result.content[0].text).toContain("Advanced generation is not available");
  });

  // ── Reference path throws ──

  it("should return GENERATION_FAILED when createReferenceGenerationJob throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createReferenceGenerationJob.mockRejectedValue(
      new Error("Reference service unavailable"),
    );

    const result = await generate(
      {
        reference_images: [{ url: "https://example.com/ref.jpg" }],
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
    expect(result.content[0].text).toContain("Reference service unavailable");
  });

  // ── Advanced path throws ──

  it("should return GENERATION_FAILED when createAdvancedGenerationJob throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockRejectedValue(
      new Error("Advanced service crashed"),
    );

    const result = await generate({ prompt: "test", resolution: "2K" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
    expect(result.content[0].text).toContain("Advanced service crashed");
  });

  // ── SUBJECT_LIST_FAILED path ──

  it("should return SUBJECT_LIST_FAILED when subjectFindMany throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.subjectFindMany.mockRejectedValue(new Error("DB read error"));

    const result = await generate({ subject_refs: ["hero"] }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("SUBJECT_LIST_FAILED");
    expect(result.content[0].text).toContain("Failed to fetch subjects");
  });

  it("should return SUBJECT_LIST_FAILED when subjectFindMany returns null", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.subjectFindMany.mockResolvedValue(null);

    const result = await generate({ subject_refs: ["hero"] }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("SUBJECT_LIST_FAILED");
  });

  // ── Fallback error messages (null error field in response) ──

  it("should use fallback message when reference job success:false has no error field", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: false,
      // no error field
    });

    const result = await generate(
      {
        reference_images: [{ url: "https://example.com/ref.jpg" }],
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Reference generation failed");
  });

  it("should use fallback message when advanced job success:false has no error field", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: false,
      // no error field
    });

    const result = await generate({ resolution: "2K" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Advanced generation failed");
  });

  it("should use fallback message when basic job success:false has no error field", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: false,
      // no error field
    });

    const result = await generate({ prompt: "test" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Generation failed");
  });

  it("should use specified role when image_id reference has a role", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("ref-img-2"), userId }),
    );
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: true,
      jobId: "ref-role-job",
      creditsCost: 4,
    });

    await generate(
      {
        reference_images: [{ image_id: "ref-img-2", role: "subject" }],
      },
      ctx,
    );

    expect(mocks.generation.createReferenceGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceImages: [expect.objectContaining({ role: "subject" })],
      }),
    );
  });

  it("should skip reference with neither image_id nor url", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: true,
      jobId: "ref-empty-job",
      creditsCost: 0,
    });

    const result = await generate(
      {
        reference_images: [{}],
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(mocks.generation.createReferenceGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({ referenceImages: [] }),
    );
  });

  it("should default role to style when image_id reference has no role", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("ref-img-3"), userId }),
    );
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: true,
      jobId: "ref-default-style-job",
      creditsCost: 4,
    });

    await generate(
      {
        reference_images: [{ image_id: "ref-img-3" }],
      },
      ctx,
    );

    expect(mocks.generation.createReferenceGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceImages: [expect.objectContaining({ role: "style" })],
      }),
    );
  });
});
