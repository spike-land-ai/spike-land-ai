import { asImageId, asAlbumHandle } from "../types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockImageStudioDeps,
  mockAlbumRow,
  mockImageRow,
} from "../__test-utils__/mock-deps.js";
import { upload } from "./upload.js";
import type { ToolContext } from "../types.js";

describe("upload", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  const validInput = {
    name: "photo.jpg",
    data_base64: Buffer.from("fake-image-data").toString("base64"),
    content_type: "image/jpeg",
    width: 1024,
    height: 768,
  };

  it("should upload an image successfully", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.storage.upload.mockResolvedValue({
      url: "https://r2.spike.land/photo.jpg",
      r2Key: "key-1",
      sizeBytes: 2048,
    });
    mocks.db.imageCreate.mockResolvedValue(
      mockImageRow({
        userId,
        name: "photo.jpg",
        originalUrl: "https://r2.spike.land/photo.jpg",
      }),
    );

    const result = await upload(validInput, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image:created", entityId: expect.any(String) }),
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBeDefined();
    expect(data.url).toBe("https://r2.spike.land/photo.jpg");
    expect(data.album_handle).toBeUndefined();
  });

  it("should upload image into an album when album_handle is provided", async () => {
    const ctx: ToolContext = { userId, deps };
    const albumHandle = "my-album";
    mocks.resolverMocks.resolveAlbum.mockResolvedValue(
      mockAlbumRow({ userId, handle: asAlbumHandle(albumHandle) }),
    );
    mocks.storage.upload.mockResolvedValue({
      url: "https://r2.spike.land/photo.jpg",
      r2Key: "key-2",
      sizeBytes: 1024,
    });
    mocks.db.imageCreate.mockResolvedValue(
      mockImageRow({ userId, originalUrl: "https://r2.spike.land/photo.jpg" }),
    );
    mocks.db.albumImageMaxSortOrder.mockResolvedValue(3);
    mocks.db.albumImageAdd.mockResolvedValue({
      id: "ai-1",
      albumId: "album-uuid-1",
      imageId: asImageId("img-1"),
      sortOrder: 4,
      addedAt: new Date(),
    });

    const result = await upload({ ...validInput, album_handle: albumHandle }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.album_handle).toBe(albumHandle);
    expect(mocks.db.albumImageAdd).toHaveBeenCalled();
  });

  it("should return error when file size exceeds 50MB", async () => {
    const ctx: ToolContext = { userId, deps };
    // 50MB + 1 byte worth of base64 (~67MB base64 string)
    const bigBase64 = "A".repeat(Math.ceil((50 * 1024 * 1024 + 1) / 0.75));

    const result = await upload({ ...validInput, data_base64: bigBase64 }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("FILE_TOO_LARGE");
  });

  it("should return error when album is not found", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveAlbum.mockResolvedValue(null);

    const result = await upload(
      {
        ...validInput,
        album_handle: "missing-album",
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("ALBUM_NOT_FOUND");
  });

  it("should return error when storage upload fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.storage.upload.mockRejectedValue(new Error("S3 unavailable"));

    const result = await upload(validInput, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("UPLOAD_FAILED");
  });

  it("should use fallback message when storage resolves with null data", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.storage.upload.mockResolvedValue(null);

    const result = await upload(validInput, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("UPLOAD_FAILED");
    expect(result.content[0].text).toContain("Upload failed");
  });

  it("should return error when database create fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.storage.upload.mockResolvedValue({
      url: "https://r2.spike.land/photo.jpg",
      r2Key: "key-3",
      sizeBytes: 512,
    });
    mocks.db.imageCreate.mockRejectedValue(new Error("DB down"));

    const result = await upload(validInput, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("DB_ERROR");
  });

  it("should upload with tags and description", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.storage.upload.mockResolvedValue({
      url: "https://r2.spike.land/tagged.jpg",
      r2Key: "key-tagged",
      sizeBytes: 500,
    });
    mocks.db.imageCreate.mockResolvedValue(
      mockImageRow({ userId, name: "tagged.jpg", tags: ["sunset", "beach"] }),
    );

    const result = await upload(
      {
        ...validInput,
        description: "A sunset shot",
        tags: ["sunset", "beach"],
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(mocks.db.imageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "A sunset shot",
        tags: ["sunset", "beach"],
      }),
    );
  });

  // ── Auto-tag on upload ──

  it("should auto-tag image with AI-generated tags and description", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.storage.upload.mockResolvedValue({
      url: "https://r2.spike.land/photo.jpg",
      r2Key: "key-auto",
      sizeBytes: 2048,
    });
    mocks.db.imageCreate.mockResolvedValue(mockImageRow({ userId, name: "photo.jpg" }));
    mocks.generation.describeImage.mockResolvedValue({
      description: "A beautiful sunset over the ocean",
      tags: ["sunset", "ocean", "sky"],
    });

    const result = await upload(validInput, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.tags).toEqual(["sunset", "ocean", "sky"]);
    expect(data.description).toBe("A beautiful sunset over the ocean");
    expect(mocks.db.imageUpdate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        tags: ["sunset", "ocean", "sky"],
        description: "A beautiful sunset over the ocean",
      }),
    );
  });

  it("should merge AI tags with user-provided tags", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.storage.upload.mockResolvedValue({
      url: "https://r2.spike.land/photo.jpg",
      r2Key: "key-merge",
      sizeBytes: 1024,
    });
    mocks.db.imageCreate.mockResolvedValue(
      mockImageRow({ userId, name: "photo.jpg", tags: ["my-tag"] }),
    );
    mocks.generation.describeImage.mockResolvedValue({
      description: "A forest path",
      tags: ["forest", "nature", "my-tag"],
    });

    const result = await upload({ ...validInput, tags: ["my-tag"] }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    // "my-tag" should not be duplicated
    expect(data.tags).toEqual(["my-tag", "forest", "nature"]);
  });

  it("should succeed even when auto-tag fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.storage.upload.mockResolvedValue({
      url: "https://r2.spike.land/photo.jpg",
      r2Key: "key-fail",
      sizeBytes: 512,
    });
    mocks.db.imageCreate.mockResolvedValue(mockImageRow({ userId, name: "photo.jpg" }));
    mocks.generation.describeImage.mockRejectedValue(new Error("AI service down"));

    const result = await upload(validInput, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBeDefined();
    expect(data.tags).toEqual([]);
  });

  it("should use sortOrder 0 when albumImageMaxSortOrder fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveAlbum.mockResolvedValue(
      mockAlbumRow({ userId, handle: asAlbumHandle("my-album") }),
    );
    mocks.storage.upload.mockResolvedValue({
      url: "https://r2.spike.land/photo.jpg",
      r2Key: "key-sort",
      sizeBytes: 1024,
    });
    mocks.db.imageCreate.mockResolvedValue(mockImageRow({ userId }));
    mocks.db.albumImageMaxSortOrder.mockRejectedValue(new Error("Sort order query failed"));
    mocks.db.albumImageAdd.mockResolvedValue({} as never);

    const result = await upload({ ...validInput, album_handle: "my-album" }, ctx);

    expect(result.isError).toBeUndefined();
    // Should still succeed, using sortOrder = 0 + 1 = 1
    expect(mocks.db.albumImageAdd).toHaveBeenCalledWith(expect.any(String), expect.any(String), 1);
  });

  it("should not include description in imageUpdate when aiDescription is null", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.storage.upload.mockResolvedValue({
      url: "https://r2.spike.land/photo.jpg",
      r2Key: "key-no-desc",
      sizeBytes: 512,
    });
    mocks.db.imageCreate.mockResolvedValue(mockImageRow({ userId, name: "photo.jpg" }));
    mocks.generation.describeImage.mockResolvedValue({
      tags: ["nature"],
      description: null,
    });

    const result = await upload(validInput, ctx);

    expect(result.isError).toBeUndefined();
    expect(mocks.db.imageUpdate).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({ description: expect.anything() }),
    );
  });

  it("should use empty array when describeImage returns tags as undefined", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.storage.upload.mockResolvedValue({
      url: "https://r2.spike.land/photo.jpg",
      r2Key: "key-no-tags",
      sizeBytes: 512,
    });
    mocks.db.imageCreate.mockResolvedValue(mockImageRow({ userId, name: "photo.jpg" }));
    mocks.generation.describeImage.mockResolvedValue({
      description: "A landscape photo",
      tags: undefined,
    });

    const result = await upload(validInput, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    // tags should be empty array (from `descResult.data.tags ?? []`)
    expect(data.tags).toEqual([]);
    expect(data.description).toBe("A landscape photo");
  });

  it("should skip AI tagging when describeImage returns an error object", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.storage.upload.mockResolvedValue({
      url: "https://r2.spike.land/photo.jpg",
      r2Key: "key-err-desc",
      sizeBytes: 512,
    });
    mocks.db.imageCreate.mockResolvedValue(mockImageRow({ userId, name: "photo.jpg" }));
    mocks.generation.describeImage.mockResolvedValue({
      description: null,
      tags: null,
      error: "Model unavailable",
    });

    const result = await upload(validInput, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.tags).toEqual([]);
    expect(data.description).toBeNull();
    expect(mocks.db.imageUpdate).not.toHaveBeenCalled();
  });

  it("should succeed when describeImage is not available", async () => {
    const _ctx: ToolContext = { userId, deps };
    // Remove describeImage from generation
    const depsWithoutDescribe = {
      ...deps,
      generation: { ...deps.generation, describeImage: undefined },
    };
    const ctxNoDescribe: ToolContext = { userId, deps: depsWithoutDescribe };

    mocks.storage.upload.mockResolvedValue({
      url: "https://r2.spike.land/photo.jpg",
      r2Key: "key-no-ai",
      sizeBytes: 256,
    });
    mocks.db.imageCreate.mockResolvedValue(mockImageRow({ userId, name: "photo.jpg" }));

    const result = await upload(validInput, ctxNoDescribe);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBeDefined();
    expect(data.tags).toEqual([]);
    expect(mocks.generation.describeImage).not.toHaveBeenCalled();
  });
});
