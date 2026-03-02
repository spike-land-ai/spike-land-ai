import { beforeEach, describe, expect, it, vi } from "vitest";
import { autoTag } from "./auto-tag.js";
import type { ToolContext } from "../types.js";
import { asImageId } from "../types.js";
import { createMockImageStudioDeps, mockImageRow } from "../__test-utils__/index.js";

describe("auto-tag tool", () => {
  let ctx: ToolContext;
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const result = createMockImageStudioDeps();
    mocks = result.mocks;
    ctx = { userId: "test-user-123", deps: result.deps };
    vi.resetAllMocks();

    // Sensible defaults
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 98 });
    mocks.generation.describeImage.mockResolvedValue({
      description: "A scenic mountain landscape",
      tags: ["mountain", "landscape", "nature"],
    });
    mocks.generation.extractPalette.mockResolvedValue({
      palette: ["#228B22", "#87CEEB", "#FFFFFF"],
    });
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ userId: "test-user-123", tags: ["existing-tag"] }),
    );
    mocks.db.imageUpdate.mockResolvedValue(
      mockImageRow({
        userId: "test-user-123",
        tags: ["existing-tag", "mountain", "landscape", "nature"],
      }),
    );
  });

  it("merges tags with existing when overwrite=false (default)", async () => {
    ctx.notify = vi.fn();
    const res = await autoTag({ image_id: "img-1" }, ctx);
    expect(res.isError).toBeUndefined();
    expect(ctx.notify).toHaveBeenCalledWith(expect.objectContaining({ type: "image:updated" }));

    const data = JSON.parse(res.content[0].text);
    expect(data.tags_added).toBe(3);
    expect(data.total_tags).toBe(4);
    expect(data.tags).toEqual(["existing-tag", "mountain", "landscape", "nature"]);
    expect(data.description_updated).toBe(true);
    expect(data.description).toBe("A scenic mountain landscape");
    expect(data.overwrite).toBe(false);

    // Verify imageUpdate was called with merged tags
    expect(mocks.db.imageUpdate).toHaveBeenCalledWith(asImageId("img-1"), {
      tags: ["existing-tag", "mountain", "landscape", "nature"],
      description: "A scenic mountain landscape",
    });
  });

  it("replaces tags when overwrite=true", async () => {
    ctx.notify = vi.fn();
    const res = await autoTag({ image_id: "img-1", overwrite: true }, ctx);
    expect(res.isError).toBeUndefined();
    expect(ctx.notify).toHaveBeenCalledWith(expect.objectContaining({ type: "image:updated" }));

    const data = JSON.parse(res.content[0].text);
    expect(data.tags_added).toBe(3);
    expect(data.tags).toEqual(["mountain", "landscape", "nature"]);
    expect(data.overwrite).toBe(true);

    expect(mocks.db.imageUpdate).toHaveBeenCalledWith(asImageId("img-1"), {
      tags: ["mountain", "landscape", "nature"],
      description: "A scenic mountain landscape",
    });
  });

  it("deduplicates when merging tags", async () => {
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ userId: "test-user-123", tags: ["mountain", "old-tag"] }),
    );

    const res = await autoTag({ image_id: "img-1" }, ctx);
    expect(res.isError).toBeUndefined();

    const data = JSON.parse(res.content[0].text);
    // "mountain" already exists, so only "landscape" and "nature" are added
    expect(data.tags_added).toBe(2);
    expect(data.total_tags).toBe(4);
    expect(data.tags).toEqual(["mountain", "old-tag", "landscape", "nature"]);
  });

  it("includes palette when extractPalette is available", async () => {
    const res = await autoTag({ image_id: "img-1" }, ctx);
    expect(res.isError).toBeUndefined();

    const data = JSON.parse(res.content[0].text);
    expect(data.palette).toEqual(["#228B22", "#87CEEB", "#FFFFFF"]);
    expect(data.credits_cost).toBe(2);
  });

  it("works without palette when extractPalette is not available", async () => {
    ctx.deps.generation.extractPalette = undefined;

    const res = await autoTag({ image_id: "img-1" }, ctx);
    expect(res.isError).toBeUndefined();

    const data = JSON.parse(res.content[0].text);
    expect(data.palette).toBeNull();
    expect(data.credits_cost).toBe(1);

    // Should only charge 1 credit
  });

  it("returns UNSUPPORTED if describeImage is not available", async () => {
    ctx.deps.generation.describeImage = undefined;

    const res = await autoTag({ image_id: "img-1" }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("UNSUPPORTED");
    expect(res.content[0].text).toContain("not available");
  });

  it("returns IMAGE_NOT_FOUND if image does not exist", async () => {
    mocks.resolverMocks.resolveImage.mockRejectedValue(new Error("Not found"));

    const res = await autoTag({ image_id: "img-missing" }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("IMAGE_NOT_FOUND");
  });

  it("returns IMAGE_NOT_FOUND if resolver returns null", async () => {
    mocks.resolverMocks.resolveImage.mockResolvedValue(null);

    const res = await autoTag({ image_id: "img-1" }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("IMAGE_NOT_FOUND");
  });

  it("returns INSUFFICIENT_CREDITS when user lacks credits", async () => {
    mocks.credits.consume.mockResolvedValue({
      success: false,
      error: "Insufficient credits",
    });

    const res = await autoTag({ image_id: "img-1" }, ctx);
    console.log("AUTO-TAG TEST res:", res); // DEBUG LOG
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("CREDIT_CONSUME_FAILED");
  });

  it("returns INSUFFICIENT_CREDITS when hasEnough throws", async () => {
    mocks.credits.consume.mockRejectedValue(new Error("Credit service error"));

    const res = await autoTag({ image_id: "img-1" }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("CREDIT_CONSUME_FAILED");
  });

  it("returns DESCRIPTION_FAILED when describeImage returns error", async () => {
    mocks.generation.describeImage.mockResolvedValue({
      error: "Model unavailable",
    });

    const res = await autoTag({ image_id: "img-1" }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("DESCRIPTION_FAILED");
    expect(res.content[0].text).toContain("Model unavailable");
  });

  it("returns DESCRIPTION_FAILED when describeImage throws", async () => {
    mocks.generation.describeImage.mockRejectedValue(new Error("API timeout"));

    const res = await autoTag({ image_id: "img-1" }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("DESCRIPTION_FAILED");
    expect(res.content[0].text).toContain("API timeout");
  });

  it("gracefully handles extractPalette failure", async () => {
    mocks.generation.extractPalette.mockRejectedValue(new Error("Palette error"));

    const res = await autoTag({ image_id: "img-1" }, ctx);
    expect(res.isError).toBeUndefined();

    const data = JSON.parse(res.content[0].text);
    expect(data.palette).toBeNull();
    // Still persists tags and description
    expect(mocks.db.imageUpdate).toHaveBeenCalled();
  });

  it("handles image with null tags when merging (uses empty array fallback)", async () => {
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ userId: "test-user-123", tags: null as unknown as string[] }),
    );

    const res = await autoTag({ image_id: "img-1" }, ctx);
    expect(res.isError).toBeUndefined();

    const data = JSON.parse(res.content[0].text);
    // image.tags is null, so existingSet is empty, all newTags are added
    expect(data.tags).toEqual(["mountain", "landscape", "nature"]);
    expect(data.tags_added).toBe(3);
  });

  it("returns DESCRIPTION_FAILED with fallback message when describeImage returns null data", async () => {
    mocks.generation.describeImage.mockResolvedValue(null);

    const res = await autoTag({ image_id: "img-1" }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("DESCRIPTION_FAILED");
  });

  it("consumes credits with correct source", async () => {
    await autoTag({ image_id: "img-1" }, ctx);

    expect(mocks.credits.consume).toHaveBeenCalledWith({
      userId: "test-user-123",
      amount: 2,
      source: "auto_tag",
      sourceId: asImageId("img-1"),
    });
  });
});
