import { asImageId, asJobId } from "../types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockImageStudioDeps,
  mockImageRow,
  mockJobRow,
} from "../__test-utils__/mock-deps.js";
import { enhance } from "./enhance.js";
import type { ToolContext } from "../types.js";

describe("enhance", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  // ── Single mode — happy path ──

  it("should start a single enhancement job", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img1"), userId }),
    );
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 98 });
    mocks.db.jobCreate.mockResolvedValue(
      mockJobRow({
        id: asJobId("job-enh-1"),
        status: "PENDING",
        tier: "TIER_1K",
      }),
    );

    const result = await enhance({ image_id: "img1", tier: "TIER_1K" }, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "job:created", entityId: "job-enh-1" }),
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("job-enh-1");
    expect(data.tier).toBe("TIER_1K");
    expect(data.creditsCost).toBe(2);
    expect(data.status).toBe("PENDING");
  });

  it("should use TIER_1K as the default tier", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img1"), userId }),
    );
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 98 });
    mocks.db.jobCreate.mockResolvedValue(
      mockJobRow({
        id: asJobId("job-default"),
        status: "PENDING",
        tier: "TIER_1K",
      }),
    );

    await enhance({ image_id: "img1" }, ctx);

    expect(mocks.db.jobCreate).toHaveBeenCalledWith(expect.objectContaining({ tier: "TIER_1K" }));
  });

  it("should skip credit check for FREE tier single enhancement", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img-free"), userId }),
    );
    mocks.db.jobCreate.mockResolvedValue(
      mockJobRow({
        id: asJobId("job-free"),
        status: "PENDING",
        tier: "FREE",
        creditsCost: 0,
      }),
    );

    const result = await enhance({ image_id: "img-free", tier: "FREE" }, ctx);

    expect(result.isError).toBeUndefined();
    expect(mocks.credits.consume).not.toHaveBeenCalled();
    const data = JSON.parse(result.content[0].text);
    expect(data.creditsCost).toBe(0);
  });

  it("should return IMAGE_NOT_FOUND for single mode when image is not found", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(null);

    const result = await enhance({ image_id: "missing" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGE_NOT_FOUND");
  });

  it("should return INSUFFICIENT_CREDITS for single mode when balance is low", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img1"), userId }),
    );
    mocks.credits.consume.mockResolvedValue({
      success: false,
      error: "Insufficient credits",
    });

    const result = await enhance({ image_id: "img1", tier: "TIER_2K" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("CREDIT_CONSUME_FAILED");
  });

  it("should return CREDIT_CONSUME_FAILED when consume returns success:false", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img1"), userId }),
    );
    mocks.credits.consume.mockResolvedValue({
      success: false,
      error: "Ledger locked",
    });

    const result = await enhance({ image_id: "img1", tier: "TIER_1K" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("CREDIT_CONSUME_FAILED");
    expect(result.content[0].text).toContain("Ledger locked");
  });

  it("should return CREDIT_CONSUME_FAILED fallback string without error message", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img1"), userId }),
    );
    mocks.credits.consume.mockResolvedValue({ success: false, remaining: 0 });

    const result = await enhance({ image_id: "img1", tier: "TIER_1K" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("CREDIT_CONSUME_FAILED");
    expect(result.content[0].text).toContain("Failed to consume credits");
  });

  it("should return JOB_CREATE_FAILED when db.jobCreate fails for single mode", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img1"), userId }),
    );
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 98 });
    mocks.db.jobCreate.mockResolvedValue(null);

    const result = await enhance({ image_id: "img1", tier: "TIER_1K" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("JOB_CREATE_FAILED");
  });

  // ── Single mode — preview ──

  it("should return a cost preview for single mode without starting a job", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img1"), userId }),
    );
    mocks.credits.getBalance.mockResolvedValue({ remaining: 50 });

    const result = await enhance(
      {
        image_id: "img1",
        tier: "TIER_2K",
        preview: true,
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.cost).toBe(5);
    expect(data.current_balance).toBe(50);
    expect(data.can_afford).toBe(true);
    expect(mocks.db.jobCreate).not.toHaveBeenCalled();
  });

  it("should show can_afford:false in preview when balance is too low", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img1"), userId }),
    );
    mocks.credits.getBalance.mockResolvedValue({ remaining: 1 });

    const result = await enhance(
      {
        image_id: "img1",
        tier: "TIER_4K",
        preview: true,
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.can_afford).toBe(false);
  });

  it("should show current_balance of 0 in preview when getBalance fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img1"), userId }),
    );
    mocks.credits.getBalance.mockRejectedValue(new Error("Service down"));

    const result = await enhance(
      {
        image_id: "img1",
        tier: "TIER_1K",
        preview: true,
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.current_balance).toBe(0);
  });

  // ── No image source ──

  it("should return INVALID_INPUT when neither image_id nor image_ids is provided", async () => {
    const ctx: ToolContext = { userId, deps };

    const result = await enhance({}, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("INVALID_INPUT");
  });

  // ── Batch mode — happy path ──

  it("should start batch enhancement jobs for multiple images", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.resolverMocks.resolveImages.mockResolvedValue([
      mockImageRow({ id: asImageId("img-a"), userId }),
      mockImageRow({ id: asImageId("img-b"), userId }),
    ]);
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 96 });
    mocks.db.jobCreate
      .mockResolvedValueOnce(mockJobRow({ id: asJobId("job-a"), imageId: asImageId("img-a") }))
      .mockResolvedValueOnce(mockJobRow({ id: asJobId("job-b"), imageId: asImageId("img-b") }));

    const result = await enhance(
      {
        image_ids: ["img-a", "img-b"],
        tier: "TIER_1K",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "job:created", entityId: "job-a" }),
    );
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "job:created", entityId: "job-b" }),
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.batch_size).toBe(2);
    expect(data.jobs_started).toBe(2);
    expect(data.total_cost).toBe(4);
    expect(data.jobs).toHaveLength(2);
  });

  it("should return IMAGES_NOT_FOUND when resolveImages returns empty", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImages.mockResolvedValue([]);

    const result = await enhance({ image_ids: ["ghost-1", "ghost-2"] }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGES_NOT_FOUND");
  });

  it("should return IMAGES_NOT_FOUND when resolveImages throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImages.mockRejectedValue(new Error("DB error"));

    const result = await enhance({ image_ids: ["img-x"] }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGES_NOT_FOUND");
  });

  it("should return INSUFFICIENT_CREDITS for batch mode when balance is low", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImages.mockResolvedValue([
      mockImageRow({ id: asImageId("img-a"), userId }),
      mockImageRow({ id: asImageId("img-b"), userId }),
    ]);
    mocks.credits.consume.mockResolvedValue({
      success: false,
      error: "Insufficient credits",
    });

    const result = await enhance(
      {
        image_ids: ["img-a", "img-b"],
        tier: "TIER_2K",
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("BATCH_ENHANCE_FAILED");
  });

  it("should return BATCH_ENHANCE_FAILED when all jobCreate calls return null", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImages.mockResolvedValue([
      mockImageRow({ id: asImageId("img-a"), userId }),
    ]);
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 98 });
    mocks.db.jobCreate.mockResolvedValue(null);

    const result = await enhance({ image_ids: ["img-a"] }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("BATCH_ENHANCE_FAILED");
  });

  // ── Batch mode — preview ──

  it("should return a batch cost preview without starting jobs", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImages.mockResolvedValue([
      mockImageRow({ id: asImageId("img-a"), userId }),
      mockImageRow({ id: asImageId("img-b"), userId }),
      mockImageRow({ id: asImageId("img-c"), userId }),
    ]);
    mocks.credits.getBalance.mockResolvedValue({ remaining: 20 });

    const result = await enhance(
      {
        image_ids: ["img-a", "img-b", "img-c"],
        tier: "TIER_1K",
        preview: true,
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.batch_size).toBe(3);
    expect(data.cost_per_image).toBe(2);
    expect(data.total_cost).toBe(6);
    expect(data.current_balance).toBe(20);
    expect(data.can_afford).toBe(true);
    expect(mocks.db.jobCreate).not.toHaveBeenCalled();
  });

  it("should count null images in batch as failed", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImages.mockResolvedValue([
      mockImageRow({ id: asImageId("img-a"), userId }),
      null,
    ]);
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 98 });
    mocks.db.jobCreate.mockResolvedValue(
      mockJobRow({ id: asJobId("job-a"), imageId: asImageId("img-a") }),
    );

    const result = await enhance(
      {
        image_ids: ["img-a", "img-null"],
        tier: "TIER_1K",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.failed).toBe(1);
    expect(data.jobs_started).toBe(1);
  });

  it("should show current_balance of 0 in batch preview when getBalance fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImages.mockResolvedValue([
      mockImageRow({ id: asImageId("img-a"), userId }),
    ]);
    mocks.credits.getBalance.mockRejectedValue(new Error("Service down"));

    const result = await enhance(
      {
        image_ids: ["img-a"],
        tier: "TIER_1K",
        preview: true,
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.current_balance).toBe(0);
  });
});
