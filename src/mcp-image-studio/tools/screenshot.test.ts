import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps, mockImageRow } from "../__test-utils__/mock-deps.js";
import { screenshot } from "./screenshot.js";
import type { ToolContext } from "../types.js";
import { asImageId } from "../types.js";
import { standardScenarios } from "../__test-utils__/standard-scenarios.js";

describe("screenshot", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  /** Wire up mocks for the standard happy-path flow. */
  function setupHappyPath(
    overrides: { imageId?: string; format?: string; cost?: number; jobId?: string } = {},
  ) {
    const { imageId = "src-1", format = "png", cost = 2, jobId = "mod-job-1" } = overrides;
    mocks.resolverMocks.resolveImage.mockResolvedValueOnce(
      mockImageRow({ userId, id: asImageId(imageId), originalFormat: format }),
    );
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 100 - cost });
    mocks.credits.calculateGenerationCost.mockReturnValue(cost);
    mocks.generation.createModificationJob.mockResolvedValue({
      success: true,
      jobId,
      creditsCost: cost,
    });
  }

  // getter needed because `deps` is reassigned in beforeEach
  standardScenarios({
    handler: screenshot,
    validInput: { source_image_id: "src-1" },
    get deps() {
      return deps;
    },
    resolvesImage: true,
  });

  it("should place screenshot into device mockup (happy path with defaults)", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    setupHappyPath();

    const result = await screenshot({ source_image_id: "src-1" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("mod-job-1");
    expect(data.device).toBe("iphone");
    expect(data.background).toBe("gradient");
    expect(data.source_image_id).toBe("src-1");
    expect(data.creditsCost).toBe(2);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "job:created", entityId: "mod-job-1" }),
    );
  });

  it("should use custom device", async () => {
    const ctx: ToolContext = { userId, deps };
    setupHappyPath({ jobId: "mod-job-2" });

    const result = await screenshot(
      {
        source_image_id: "src-1",
        device: "macbook",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.device).toBe("macbook");

    const call = mocks.generation.createModificationJob.mock.calls[0][0];
    expect(call.prompt).toContain("macbook");
  });

  it("should use custom background", async () => {
    const ctx: ToolContext = { userId, deps };
    setupHappyPath({ jobId: "mod-job-3" });

    const result = await screenshot(
      {
        source_image_id: "src-1",
        background: "transparent",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.background).toBe("transparent");

    const call = mocks.generation.createModificationJob.mock.calls[0][0];
    expect(call.prompt).toContain("transparent");
  });

  it("should use custom tier", async () => {
    const ctx: ToolContext = { userId, deps };
    setupHappyPath({ cost: 10, jobId: "mod-job-4" });

    const result = await screenshot(
      {
        source_image_id: "src-1",
        tier: "TIER_4K",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const call = mocks.generation.createModificationJob.mock.calls[0][0];
    expect(call.tier).toBe("TIER_4K");
  });

  it("should accept all options specified", async () => {
    const ctx: ToolContext = { userId, deps };
    setupHappyPath({ cost: 10, jobId: "mod-job-5" });

    const result = await screenshot(
      {
        source_image_id: "src-1",
        device: "ipad",
        background: "solid",
        tier: "TIER_4K",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.device).toBe("ipad");
    expect(data.background).toBe("solid");

    const call = mocks.generation.createModificationJob.mock.calls[0][0];
    expect(call.tier).toBe("TIER_4K");
    expect(call.prompt).toContain("ipad");
    expect(call.prompt).toContain("solid");
  });

  it("should fall back to calculated cost when creditsCost is undefined", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValueOnce(
      mockImageRow({ userId, id: asImageId("src-1") }),
    );
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 95 });
    mocks.credits.calculateGenerationCost.mockReturnValue(5);
    mocks.generation.createModificationJob.mockResolvedValue({
      success: true,
      jobId: "job-fallback",
      creditsCost: undefined as unknown as number,
    });

    const result = await screenshot({ source_image_id: "src-1" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.creditsCost).toBe(5);
  });

  it("should return DOWNLOAD_FAILED when storage download rejects", async () => {
    const ctx: ToolContext = { userId, deps };
    setupHappyPath();
    mocks.storage.download.mockRejectedValue(new Error("S3 timeout"));

    const result = await screenshot({ source_image_id: "src-1" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("DOWNLOAD_FAILED");
  });

  it("should return DOWNLOAD_FAILED when storage download returns null", async () => {
    const ctx: ToolContext = { userId, deps };
    setupHappyPath();
    mocks.storage.download.mockResolvedValue(null);

    const result = await screenshot({ source_image_id: "src-1" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("DOWNLOAD_FAILED");
  });

  it("should return GENERATION_FAILED when createModificationJob throws", async () => {
    const ctx: ToolContext = { userId, deps };
    setupHappyPath();
    mocks.generation.createModificationJob.mockRejectedValue(new Error("GPU unavailable"));

    const result = await screenshot({ source_image_id: "src-1" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should return GENERATION_FAILED when createModificationJob returns success=false", async () => {
    const ctx: ToolContext = { userId, deps };
    setupHappyPath();
    mocks.generation.createModificationJob.mockResolvedValue({
      success: false,
      error: "Model capacity exceeded",
    });

    const result = await screenshot({ source_image_id: "src-1" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
    expect(result.content[0].text).toContain("Model capacity exceeded");
  });

  it("should return GENERATION_FAILED with fallback message when success=false and no error", async () => {
    const ctx: ToolContext = { userId, deps };
    setupHappyPath();
    mocks.generation.createModificationJob.mockResolvedValue({
      success: false,
    });

    const result = await screenshot({ source_image_id: "src-1" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
    expect(result.content[0].text).toContain("Failed to create screenshot mockup job");
  });

  it("should construct prompt with device and background", async () => {
    const ctx: ToolContext = { userId, deps };
    setupHappyPath({ jobId: "mod-job-prompt" });

    await screenshot({ source_image_id: "src-1" }, ctx);

    const call = mocks.generation.createModificationJob.mock.calls[0][0];
    expect(call.prompt).toContain("iphone");
    expect(call.prompt).toContain("gradient");
    expect(call.prompt).toBe(
      "Place this screenshot into a iphone device mockup with a gradient background.",
    );
  });

  it("should pass base64-encoded image data and correct mimeType", async () => {
    const ctx: ToolContext = { userId, deps };
    const imageBuffer = Buffer.from("fake-png-data");
    setupHappyPath({ jobId: "mod-job-data" });
    mocks.storage.download.mockResolvedValue(imageBuffer);

    await screenshot({ source_image_id: "src-1" }, ctx);

    const call = mocks.generation.createModificationJob.mock.calls[0][0];
    expect(call.imageData).toBe(imageBuffer.toString("base64"));
    expect(call.mimeType).toBe("image/png");
  });

  it("should emit toolEvent with correct payload shape", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    setupHappyPath({ jobId: "mod-job-evt" });

    await screenshot({ source_image_id: "src-1" }, ctx);

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "job:created",
        entityId: "mod-job-evt",
        payload: expect.objectContaining({
          tier: "TIER_1K",
          device: "iphone",
          background: "gradient",
          status: "PENDING",
        }),
      }),
    );
  });

  it("should consume credits via middleware", async () => {
    const ctx: ToolContext = { userId, deps };
    setupHappyPath({ jobId: "mod-job-credits" });

    await screenshot({ source_image_id: "src-1" }, ctx);

    expect(mocks.credits.consume).toHaveBeenCalledWith(
      expect.objectContaining({ userId, source: "screenshot" }),
    );
  });
});
