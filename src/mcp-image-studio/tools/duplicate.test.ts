import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps, mockImageRow } from "../__test-utils__/mock-deps.js";
import { duplicate } from "./duplicate.js";
import type { ToolContext } from "../types.js";
import { asImageId } from "../types.js";
import { standardScenarios } from "../__test-utils__/standard-scenarios.js";

describe("duplicate", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  const { deps: defaultDeps, mocks: defaultMocks } = createMockImageStudioDeps();
  defaultMocks.resolverMocks.resolveImage.mockResolvedValue(
    mockImageRow({ id: asImageId("img-1"), userId }),
  );

  standardScenarios({
    handler: duplicate,
    validInput: { image_id: "img-1" },
    deps: defaultDeps,
    resolvesImage: true,
  });

  it("should duplicate an image with default name", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    const image = mockImageRow({
      userId,
      id: asImageId("img-1"),
      name: "sunset.jpg",
      description: "A sunset",
      tags: ["nature", "sky"],
      originalR2Key: "key/sunset",
      originalFormat: "jpeg",
      isPublic: true,
      shareToken: "share-abc",
    });
    mocks.resolverMocks.resolveImage.mockResolvedValue(image);
    mocks.storage.download.mockResolvedValue(Buffer.from("image-data"));
    mocks.storage.upload.mockResolvedValue({
      url: "https://r2.spike.land/copy.jpg",
      r2Key: "key/copy",
      sizeBytes: 2048,
    });
    const newImage = mockImageRow({
      id: asImageId("img-new"),
      userId,
      name: "Copy of sunset.jpg",
      originalUrl: "https://r2.spike.land/copy.jpg",
    });
    mocks.db.imageCreate.mockResolvedValue(newImage);

    const result = await duplicate({ image_id: image.id }, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image:created", entityId: "img-new" }),
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.duplicated).toBe(true);
    expect(data.original_id).toBe(image.id);
    expect(data.new_image.id).toBe("img-new");
    expect(data.new_image.name).toBe("Copy of sunset.jpg");
    expect(data.new_image.url).toBe("https://r2.spike.land/copy.jpg");

    // Verify storage chain
    expect(mocks.storage.download).toHaveBeenCalledWith("key/sunset");
    expect(mocks.storage.upload).toHaveBeenCalledWith(userId, Buffer.from("image-data"), {
      filename: "Copy of sunset.jpg",
      contentType: "jpeg",
    });

    // Verify tags copied but isPublic/shareToken reset
    const createCall = mocks.db.imageCreate.mock.calls[0][0];
    expect(createCall.tags).toEqual(["nature", "sky"]);
    expect(createCall.isPublic).toBe(false);
    expect(createCall.shareToken).toBeNull();
  });

  it("should duplicate an image with custom name", async () => {
    const ctx: ToolContext = { userId, deps };
    const image = mockImageRow({ userId, id: asImageId("img-1"), name: "original.png" });
    mocks.resolverMocks.resolveImage.mockResolvedValue(image);
    mocks.storage.download.mockResolvedValue(Buffer.from("data"));
    mocks.storage.upload.mockResolvedValue({
      url: "https://r2.spike.land/custom.jpg",
      r2Key: "key/custom",
      sizeBytes: 512,
    });
    const newImage = mockImageRow({
      id: asImageId("img-custom"),
      userId,
      name: "My Custom Name",
      originalUrl: "https://r2.spike.land/custom.jpg",
    });
    mocks.db.imageCreate.mockResolvedValue(newImage);

    const result = await duplicate(
      {
        image_id: image.id,
        name: "My Custom Name",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.new_image.name).toBe("My Custom Name");

    const createCall = mocks.db.imageCreate.mock.calls[0][0];
    expect(createCall.name).toBe("My Custom Name");
  });

  it("should return error when imageCreate fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    mocks.storage.download.mockResolvedValue(Buffer.from("data"));
    mocks.storage.upload.mockResolvedValue({
      url: "https://r2.spike.land/copy.jpg",
      r2Key: "key/copy",
      sizeBytes: 512,
    });
    mocks.db.imageCreate.mockRejectedValue(new Error("DB error"));

    const result = await duplicate({ image_id: "img-1" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("CREATE_FAILED");
    expect(result.content[0].text).toContain("Retryable:** true");
  });

  it("should copy tags but reset shareToken and isPublic", async () => {
    const ctx: ToolContext = { userId, deps };
    const image = mockImageRow({
      userId,
      id: asImageId("img-1"),
      tags: ["portrait", "studio"],
      isPublic: true,
      shareToken: "token-xyz",
    });
    mocks.resolverMocks.resolveImage.mockResolvedValue(image);
    mocks.storage.download.mockResolvedValue(Buffer.from("data"));
    mocks.storage.upload.mockResolvedValue({
      url: "https://r2.spike.land/copy.jpg",
      r2Key: "key/copy",
      sizeBytes: 512,
    });
    mocks.db.imageCreate.mockResolvedValue(mockImageRow({ id: asImageId("img-dup"), userId }));

    const result = await duplicate({ image_id: image.id }, ctx);

    expect(result.isError).toBeUndefined();
    const createCall = mocks.db.imageCreate.mock.calls[0][0];
    expect(createCall.tags).toEqual(["portrait", "studio"]);
    expect(createCall.isPublic).toBe(false);
    expect(createCall.shareToken).toBeNull();
    // Ensure tags are a copy, not same reference
    expect(createCall.tags).not.toBe(image.tags);
  });
});
