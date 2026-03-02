import { asImageId } from "../types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps, mockImageRow } from "../__test-utils__/mock-deps.js";
import { icon } from "./icon.js";
import type { CallToolResult, ToolContext } from "../types.js";
import { standardScenarios } from "../__test-utils__/standard-scenarios.js";

describe("icon", () => {
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
    jobId: "gen-job-1",
    creditsCost: 2,
  });

  standardScenarios({
    handler: icon as unknown as (input: unknown, ctx: ToolContext) => Promise<CallToolResult>,
    validInput: { prompt: "A coffee cup" },
    deps: defaultDeps,
    consumesCredits: true,
  });

  // --- App icon tests (target = both / ios / android) ---

  it("should generate app icon for both platforms (happy path)", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-1",
      creditsCost: 2,
    });

    const result = await icon({ prompt: "A coffee cup" }, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("gen-job-1");
    expect(data.aspect_ratio).toBe("1:1");
    expect(data.target).toBe("both");
    expect(data.output_sizes).toHaveProperty("ios");
    expect(data.output_sizes).toHaveProperty("android");
  });

  it("should return only ios sizes when target is ios", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-2",
      creditsCost: 2,
    });

    const result = await icon({ prompt: "Calendar", target: "ios" }, ctx);

    const data = JSON.parse(result.content[0].text);
    expect(data.target).toBe("ios");
    expect(data.output_sizes).toHaveProperty("ios");
    expect(data.output_sizes).not.toHaveProperty("android");
  });

  it("should return only android sizes when target is android", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-3",
      creditsCost: 2,
    });

    const result = await icon({ prompt: "Chat bubble", target: "android" }, ctx);

    const data = JSON.parse(result.content[0].text);
    expect(data.target).toBe("android");
    expect(data.output_sizes).toHaveProperty("android");
    expect(data.output_sizes).not.toHaveProperty("ios");
  });

  it("should include style in generation prompt", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-4",
      creditsCost: 2,
    });

    await icon({ prompt: "Shield", style: "gradient" }, ctx);

    const call = mocks.generation.createGenerationJob.mock.calls[0][0];
    expect(call.prompt).toContain("gradient");
    expect(call.prompt).toContain("Shield");
    expect(call.aspectRatio).toBe("1:1");
  });

  it("should use app icon prompt prefix for non-favicon targets", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-app",
      creditsCost: 2,
    });

    await icon({ prompt: "Rocket", target: "ios" }, ctx);

    const call = mocks.generation.createGenerationJob.mock.calls[0][0];
    expect(call.prompt).toContain("An app icon design, clean and modern.");
    expect(call.prompt).not.toContain("favicon");
  });

  it("should return GENERATION_FAILED when createGenerationJob returns failure", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: false,
      error: "Capacity exceeded",
    });

    const result = await icon({ prompt: "Star" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should return GENERATION_FAILED when createGenerationJob throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockRejectedValue(new Error("network failure"));

    const result = await icon({ prompt: "Star" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should consume credits after successful generation", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-5",
      creditsCost: 2,
    });

    await icon({ prompt: "Rocket" }, ctx);

    expect(mocks.credits.consume).toHaveBeenCalledWith(
      expect.objectContaining({ userId, source: "icon" }),
    );
  });

  it("should use creditsCost from job response when available", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-6",
      creditsCost: 10,
    });

    const result = await icon({ prompt: "Diamond", tier: "TIER_4K" }, ctx);

    const data = JSON.parse(result.content[0].text);
    expect(data.creditsCost).toBe(10);
  });

  it("should check credits with correct cost for TIER_2K", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-7",
      creditsCost: 5,
    });

    await icon({ prompt: "Leaf", tier: "TIER_2K" }, ctx);
  });

  it("should return INVALID_INPUT when no prompt and no source_image_id", async () => {
    const ctx: ToolContext = { userId, deps };
    const result = await icon({}, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("INVALID_INPUT");
    expect(result.content[0].text).toContain("Either prompt or source_image_id is required");
  });

  // --- Favicon tests (target = "favicon") ---

  it("should generate favicon from prompt (happy path)", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "fav-job-1",
      creditsCost: 2,
    });

    const result = await icon({ prompt: "A shield logo", target: "favicon" }, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("fav-job-1");
    expect(data.aspect_ratio).toBe("1:1");
    expect(data.creditsCost).toBe(2);
    expect(data.target).toBe("favicon");
    expect(data.output_sizes).toHaveProperty("favicon");
    expect(data.output_sizes.favicon).toEqual([16, 32, 48]);
  });

  it("should use favicon prompt prefix when target is favicon", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "fav-job-2",
      creditsCost: 2,
    });

    await icon({ prompt: "Globe icon", target: "favicon" }, ctx);

    const call = mocks.generation.createGenerationJob.mock.calls[0][0];
    expect(call.prompt).toContain("A favicon icon design, simple and recognizable at small sizes.");
    expect(call.prompt).not.toContain("An app icon design");
  });

  it("should apply specified style in favicon prompt", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "fav-job-3",
      creditsCost: 2,
    });

    await icon({ prompt: "Star logo", target: "favicon", style: "3d" }, ctx);

    const call = mocks.generation.createGenerationJob.mock.calls[0][0];
    expect(call.prompt).toContain("3d");
  });

  it("should support filled style", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "fav-job-filled",
      creditsCost: 2,
    });

    await icon({ prompt: "Heart", target: "favicon", style: "filled" }, ctx);

    const call = mocks.generation.createGenerationJob.mock.calls[0][0];
    expect(call.prompt).toContain("filled");
  });

  it("should return GENERATION_FAILED for favicon when job fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: false,
      error: "Quota exceeded",
    });

    const result = await icon({ prompt: "A star", target: "favicon" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should consume credits after successful favicon generation", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "fav-job-5",
      creditsCost: 2,
    });

    await icon({ prompt: "Arrow icon", target: "favicon" }, ctx);

    expect(mocks.credits.consume).toHaveBeenCalledWith(
      expect.objectContaining({ userId, source: "icon" }),
    );
  });

  it("should use creditsCost from favicon job response when available", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "fav-job-6",
      creditsCost: 5,
    });

    const result = await icon(
      {
        prompt: "Bolt",
        target: "favicon",
        tier: "TIER_2K",
      },
      ctx,
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.creditsCost).toBe(5);
  });

  // --- Reference image tests (source_image_id) ---

  it("should use createReferenceGenerationJob when source_image_id is provided", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img-1"), userId }),
    );
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: true,
      jobId: "ref-gen-job-1",
      creditsCost: 3,
    });

    const result = await icon({ source_image_id: "img-1", target: "favicon" }, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("ref-gen-job-1");
    expect(data.aspect_ratio).toBe("1:1");
    expect(data.target).toBe("favicon");
    expect(data.output_sizes).toHaveProperty("favicon");
    expect(data.output_sizes.favicon).toEqual([16, 32, 48]);
    expect(mocks.generation.createReferenceGenerationJob).toHaveBeenCalledOnce();
  });

  it("should use reference image for app icon targets", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img-2"), userId }),
    );
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: true,
      jobId: "ref-gen-job-2",
      creditsCost: 2,
    });

    const result = await icon({ source_image_id: "img-2", target: "ios" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.target).toBe("ios");
    expect(data.output_sizes).toHaveProperty("ios");
    expect(data.output_sizes).not.toHaveProperty("favicon");
    expect(mocks.generation.createReferenceGenerationJob).toHaveBeenCalledOnce();
  });

  it("should use favicon prompt prefix in reference image path when target is favicon", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img-3"), userId }),
    );
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: true,
      jobId: "ref-gen-job-3",
      creditsCost: 2,
    });

    await icon({ source_image_id: "img-3", target: "favicon" }, ctx);

    const call = mocks.generation.createReferenceGenerationJob.mock.calls[0][0];
    expect(call.prompt).toContain("A favicon icon design, simple and recognizable at small sizes.");
  });

  it("should return IMAGE_NOT_FOUND when source image cannot be resolved", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(null);

    const result = await icon(
      {
        source_image_id: "missing-img",
        target: "favicon",
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGE_NOT_FOUND");
  });

  it("should return IMAGE_NOT_FOUND when resolveImage throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockRejectedValue(new Error("db error"));

    const result = await icon({ source_image_id: "img-err", target: "favicon" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGE_NOT_FOUND");
  });

  it("should return GENERATION_FAILED when reference job returns failure", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img-1"), userId }),
    );
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: false,
      error: "Model overloaded",
    });

    const result = await icon({ source_image_id: "img-1", target: "favicon" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should return GENERATION_FAILED when reference job throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img-5"), userId }),
    );
    mocks.generation.createReferenceGenerationJob.mockRejectedValue(new Error("Network timeout"));

    const result = await icon({ source_image_id: "img-5", target: "favicon" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should fall back to calculated cost for reference path when creditsCost is not returned", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.calculateGenerationCost.mockReturnValue(3);
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img-6"), userId }),
    );
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: true,
      jobId: "ref-fallback-job",
      creditsCost: undefined,
    });

    const result = await icon({ source_image_id: "img-6" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.creditsCost).toBe(3);
  });

  it("should fall back to calculated cost for prompt-only path when creditsCost is not returned", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.calculateGenerationCost.mockReturnValue(2);
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "prompt-fallback-job",
      creditsCost: undefined,
    });

    const result = await icon({ prompt: "A star" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.creditsCost).toBe(2);
  });

  it("should use source_image_id without createReferenceGenerationJob (falls back to prompt path)", async () => {
    // Remove createReferenceGenerationJob capability
    const depsNoRef = {
      ...deps,
      generation: { ...deps.generation, createReferenceGenerationJob: undefined },
    };
    const ctxNoRef: ToolContext = { userId, deps: depsNoRef };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img-7"), userId }),
    );
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "fallback-job",
      creditsCost: 2,
    });

    const result = await icon({ source_image_id: "img-7", prompt: "Star" }, ctxNoRef);

    expect(result.isError).toBeUndefined();
    expect(mocks.generation.createGenerationJob).toHaveBeenCalled();
    expect(mocks.generation.createReferenceGenerationJob).not.toHaveBeenCalled();
  });

  it("should consume credits after successful reference image generation", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img-4"), userId }),
    );
    mocks.generation.createReferenceGenerationJob.mockResolvedValue({
      success: true,
      jobId: "ref-gen-job-4",
      creditsCost: 2,
    });

    await icon({ source_image_id: "img-4", target: "both" }, ctx);

    expect(mocks.credits.consume).toHaveBeenCalledWith(
      expect.objectContaining({ userId, source: "icon" }),
    );
  });
});
