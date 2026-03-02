import { beforeEach, describe, expect, it, vi } from "vitest";
import { asImageId } from "../types.js";
import { createMockImageStudioDeps, mockImageRow } from "../__test-utils__/mock-deps.js";
import type { NanoDeps, ToolContext } from "../types.js";
import {
  consumeCreditsOrError,
  resolveImageOrError,
  resolveImagesOrError,
} from "../define-tool.js";

describe("resolveImageOrError", () => {
  let deps: NanoDeps;
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should return image when resolveImage succeeds", async () => {
    const imageId = asImageId("img-1");
    const image = mockImageRow({ id: imageId, userId: "test-user-123" });
    mocks.resolverMocks.resolveImage.mockResolvedValue(image);

    const result = await resolveImageOrError(deps, imageId);

    expect(result.error).toBeUndefined();
    expect(result.image).toEqual(image);
  });

  it("should return IMAGE_NOT_FOUND error when resolveImage rejects", async () => {
    const imageId = asImageId("img-missing");
    mocks.resolverMocks.resolveImage.mockRejectedValue(new Error("Image not found in DB"));

    const result = await resolveImageOrError(deps, imageId);

    expect(result.image).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.isError).toBe(true);
    expect(result.error!.content[0].text).toContain("IMAGE_NOT_FOUND");
    expect(result.error!.content[0].text).toContain("Image not found in DB");
  });

  it("should return IMAGE_NOT_FOUND error when resolveImage returns null", async () => {
    const imageId = asImageId("img-null");
    mocks.resolverMocks.resolveImage.mockResolvedValue(null);

    const result = await resolveImageOrError(deps, imageId);

    expect(result.image).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.isError).toBe(true);
    expect(result.error!.content[0].text).toContain("IMAGE_NOT_FOUND");
    expect(result.error!.content[0].text).toContain("img-null");
  });

  it("should use fallback message when error has no message", async () => {
    const imageId = asImageId("img-no-msg");
    mocks.resolverMocks.resolveImage.mockRejectedValue({ code: "ERR" });

    const result = await resolveImageOrError(deps, imageId);

    expect(result.error!.content[0].text).toContain("IMAGE_NOT_FOUND");
  });
});

describe("resolveImagesOrError", () => {
  let deps: NanoDeps;
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should return images when resolveImages succeeds", async () => {
    const imageIds = [asImageId("img-1"), asImageId("img-2")];
    const images = imageIds.map((id) => mockImageRow({ id, userId: "test-user-123" }));
    mocks.resolverMocks.resolveImages.mockResolvedValue(images);

    const result = await resolveImagesOrError(deps, imageIds);

    expect(result.error).toBeUndefined();
    expect(result.images).toEqual(images);
  });

  it("should return RESOLVE_FAILED error when resolveImages rejects", async () => {
    const imageIds = [asImageId("img-1")];
    mocks.resolverMocks.resolveImages.mockRejectedValue(new Error("DB connection failed"));

    const result = await resolveImagesOrError(deps, imageIds);

    expect(result.images).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.isError).toBe(true);
    expect(result.error!.content[0].text).toContain("RESOLVE_FAILED");
    expect(result.error!.content[0].text).toContain("DB connection failed");
  });

  it("should return RESOLVE_FAILED error when resolveImages returns null", async () => {
    const imageIds = [asImageId("img-null")];
    mocks.resolverMocks.resolveImages.mockResolvedValue(null);

    const result = await resolveImagesOrError(deps, imageIds);

    expect(result.images).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.isError).toBe(true);
    expect(result.error!.content[0].text).toContain("RESOLVE_FAILED");
    expect(result.error!.content[0].text).toContain("Failed to resolve images");
  });

  it("should use fallback message when error has no message", async () => {
    const imageIds = [asImageId("img-no-msg")];
    mocks.resolverMocks.resolveImages.mockRejectedValue({ code: "ERR" });

    const result = await resolveImagesOrError(deps, imageIds);

    expect(result.error!.content[0].text).toContain("RESOLVE_FAILED");
  });
});

describe("consumeCreditsOrError", () => {
  let deps: NanoDeps;
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should return empty object on successful credit consumption", async () => {
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 90 });

    const result = await consumeCreditsOrError(deps, "user-1", 10, "enhance", "img-1");

    expect(result.error).toBeUndefined();
  });

  it("should call credits.consume with correct params", async () => {
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 90 });

    await consumeCreditsOrError(deps, "user-1", 5, "generate", "job-1");

    expect(mocks.credits.consume).toHaveBeenCalledWith({
      userId: "user-1",
      amount: 5,
      source: "generate",
      sourceId: "job-1",
    });
  });

  it("should return CREDIT_CONSUME_FAILED when consume returns success:false", async () => {
    mocks.credits.consume.mockResolvedValue({
      success: false,
      remaining: 0,
      error: "Balance too low",
    });

    const result = await consumeCreditsOrError(deps, "user-1", 10, "enhance");

    expect(result.error).toBeDefined();
    expect(result.error!.isError).toBe(true);
    expect(result.error!.content[0].text).toContain("CREDIT_CONSUME_FAILED");
    expect(result.error!.content[0].text).toContain("Balance too low");
  });

  it("should return CREDIT_CONSUME_FAILED when consume throws", async () => {
    mocks.credits.consume.mockRejectedValue(new Error("Network error"));

    const result = await consumeCreditsOrError(deps, "user-1", 10, "enhance");

    expect(result.error).toBeDefined();
    expect(result.error!.isError).toBe(true);
    expect(result.error!.content[0].text).toContain("CREDIT_CONSUME_FAILED");
  });

  it("should use fallback error message when consume returns no error string", async () => {
    mocks.credits.consume.mockResolvedValue({ success: false, remaining: 0 });

    const result = await consumeCreditsOrError(deps, "user-1", 10, "enhance");

    expect(result.error!.content[0].text).toContain("Failed to consume credits");
  });

  it("should notify with credits:consumed event when ctx.notify is provided", async () => {
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 90 });
    const notify = vi.fn();

    const result = await consumeCreditsOrError(deps, "user-1", 10, "enhance", "img-1", {
      notify,
    } as unknown as ToolContext);

    expect(result.error).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "credits:consumed" }));
  });

  it("should not throw when ctx is undefined", async () => {
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 90 });

    const result = await consumeCreditsOrError(deps, "user-1", 10, "enhance", undefined, undefined);

    expect(result.error).toBeUndefined();
  });

  it("should not notify when ctx.notify is undefined", async () => {
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 90 });

    const result = await consumeCreditsOrError(
      deps,
      "user-1",
      10,
      "enhance",
      "img-1",
      {} as unknown as ToolContext,
    );

    expect(result.error).toBeUndefined();
  });
});
