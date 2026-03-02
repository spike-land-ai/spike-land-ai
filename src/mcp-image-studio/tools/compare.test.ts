import { beforeEach, describe, expect, it } from "vitest";
import { createMockImageStudioDeps, mockImageRow } from "../__test-utils__/mock-deps.js";
import { compare } from "./compare.js";
import type { ToolContext } from "../types.js";

describe("compare", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should compare two images by ID", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage
      .mockResolvedValueOnce(mockImageRow({ userId }))
      .mockResolvedValueOnce(mockImageRow({ userId }));
    mocks.generation.compareImages.mockResolvedValue({
      comparison: { similarity: 0.85, differences: ["Color variation"] },
    });

    const result = await compare({ image1_id: "img-1", image2_id: "img-2" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.comparison.similarity).toBe(0.85);
    expect(data.comparison.differences).toEqual(["Color variation"]);
    expect(data.creditsCost).toBe(1);
  });

  it("should compare two images by URL", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.compareImages.mockResolvedValue({
      comparison: { similarity: 0.6, differences: ["Layout difference"] },
    });

    const result = await compare(
      {
        image1_url: "https://example.com/a.jpg",
        image2_url: "https://example.com/b.jpg",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.comparison.similarity).toBe(0.6);
  });

  it("should compare one image by ID and one by URL", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValueOnce(mockImageRow({ userId }));
    mocks.generation.compareImages.mockResolvedValue({
      comparison: { similarity: 0.75, differences: [] },
    });

    const result = await compare(
      {
        image1_id: "img-1",
        image2_url: "https://example.com/b.jpg",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
  });

  it("should return NOT_SUPPORTED when compareImages is not available", async () => {
    const ctx: ToolContext = { userId, deps };
    (deps.generation as Record<string, unknown>).compareImages = undefined;

    const result = await compare({ image1_id: "img-1", image2_id: "img-2" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NOT_SUPPORTED");
  });

  it("should return INVALID_INPUT when no source is provided for image 1", async () => {
    const ctx: ToolContext = { userId, deps };

    const result = await compare({ image2_id: "img-2" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("INVALID_INPUT");
  });

  it("should return INVALID_INPUT when no source is provided for image 2", async () => {
    const ctx: ToolContext = { userId, deps };

    const result = await compare({ image1_id: "img-1" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("INVALID_INPUT");
  });

  it("should return error when insufficient credits", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.consume.mockResolvedValue({
      success: false,
      error: "Insufficient credits",
    });

    const result = await compare({ image1_id: "img-1", image2_id: "img-2" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("CREDIT_CONSUME_FAILED");
  });

  it("should return IMAGE_NOT_FOUND when image 1 is not resolved", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValueOnce(null);

    const result = await compare({ image1_id: "missing-1", image2_id: "img-2" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGE_NOT_FOUND");
  });

  it("should return IMAGE_NOT_FOUND when image 2 is not resolved", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage
      .mockResolvedValueOnce(mockImageRow({ userId }))
      .mockResolvedValueOnce(null);

    const result = await compare({ image1_id: "img-1", image2_id: "missing-2" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGE_NOT_FOUND");
  });

  it("should return COMPARISON_FAILED when compareImages returns an error", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage
      .mockResolvedValueOnce(mockImageRow({ userId }))
      .mockResolvedValueOnce(mockImageRow({ userId }));
    mocks.generation.compareImages.mockResolvedValue({
      comparison: { similarity: 0, differences: [] },
      error: "AI engine failed",
    });

    const result = await compare({ image1_id: "img-1", image2_id: "img-2" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("COMPARISON_FAILED");
    expect(result.content[0].text).toContain("AI engine failed");
  });

  it("should return COMPARISON_FAILED with error message when tryCatch rejects", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage
      .mockResolvedValueOnce(mockImageRow({ userId }))
      .mockResolvedValueOnce(mockImageRow({ userId }));
    mocks.generation.compareImages.mockRejectedValue(new Error("Network timeout"));

    const result = await compare({ image1_id: "img-1", image2_id: "img-2" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("COMPARISON_FAILED");
    expect(result.content[0].text).toContain("Network timeout");
  });

  it("should return COMPARISON_FAILED with default message when all error sources are missing", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage
      .mockResolvedValueOnce(mockImageRow({ userId }))
      .mockResolvedValueOnce(mockImageRow({ userId }));

    // To trigger "Comparison failed", we need result.ok to be false, or result.data to be empty
    // resolving null works because !result.data will be true
    mocks.generation.compareImages.mockResolvedValue(null as never);

    const result = await compare({ image1_id: "img-1", image2_id: "img-2" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("COMPARISON_FAILED");
    expect(result.content[0].text).toContain("Comparison failed");
  });
});
