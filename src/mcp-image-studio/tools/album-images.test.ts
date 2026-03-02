import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockImageStudioDeps,
  mockAlbumRow,
  mockImageRow,
} from "../__test-utils__/mock-deps.js";
import { albumImages } from "./album-images.js";
import type { ToolContext } from "../types.js";
import { asImageId, asAlbumHandle } from "../types.js";
import { standardScenarios } from "../__test-utils__/standard-scenarios.js";

describe("albumImages", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  const { deps: defaultDeps, mocks: defaultMocks } = createMockImageStudioDeps();
  defaultMocks.resolverMocks.resolveAlbum.mockResolvedValue(
    mockAlbumRow({ handle: asAlbumHandle("vacation"), userId }),
  );
  defaultMocks.resolverMocks.resolveImages.mockResolvedValue([
    mockImageRow({ userId, id: asImageId("img-1") }),
  ]);

  standardScenarios({
    handler: albumImages,
    validInput: {
      album_handle: "vacation",
      action: "add",
      image_ids: ["img-1"],
    },
    deps: defaultDeps,
    resolvesAlbum: true,
    resolvesImages: true,
  });

  it("should add images to an album", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    const albumRow = mockAlbumRow({ userId, handle: asAlbumHandle("vacation") });
    mocks.resolverMocks.resolveAlbum.mockResolvedValue(albumRow);
    mocks.resolverMocks.resolveImages.mockResolvedValue([
      mockImageRow({ userId, id: asImageId("img-1") }),
      mockImageRow({ userId, id: asImageId("img-2") }),
    ]);
    mocks.db.albumImageMaxSortOrder.mockResolvedValue(2);
    mocks.db.albumImageAdd.mockResolvedValue({
      id: "ai-1",
      albumId: albumRow.id,
      imageId: asImageId("img-1"),
      sortOrder: 3,
      addedAt: new Date(),
    });

    const result = await albumImages(
      {
        album_handle: "vacation",
        action: "add",
        image_ids: ["img-1", "img-2"],
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "album:images_changed", entityId: "vacation" }),
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.action).toBe("add");
    expect(data.added).toBe(2);
    expect(data.album_handle).toBe(albumRow.handle);
  });

  it("should remove images from an album", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    const albumRow = mockAlbumRow({
      userId,
      handle: asAlbumHandle("work"),
      coverImageId: null,
    });
    mocks.resolverMocks.resolveAlbum.mockResolvedValue(albumRow);
    mocks.db.albumImageRemove.mockResolvedValue(2);

    const result = await albumImages(
      { album_handle: "work", action: "remove", image_ids: ["img-a", "img-b"] },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "album:images_changed", entityId: "work" }),
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.action).toBe("remove");
    expect(data.removed).toBe(2);
  });

  it("should clear cover image when a removed image is the cover", async () => {
    const ctx: ToolContext = { userId, deps };
    const albumRow = mockAlbumRow({
      userId,
      handle: asAlbumHandle("covers"),
      coverImageId: asImageId("img-cover"),
    });
    mocks.resolverMocks.resolveAlbum.mockResolvedValue(albumRow);
    mocks.db.albumImageRemove.mockResolvedValue(1);
    mocks.db.albumUpdate.mockResolvedValue(albumRow);

    const result = await albumImages(
      { album_handle: "covers", action: "remove", image_ids: ["img-cover"] },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(mocks.db.albumUpdate).toHaveBeenCalledWith(expect.anything(), { coverImageId: null });
  });

  it("should not call albumUpdate when removed image is not the cover", async () => {
    const ctx: ToolContext = { userId, deps };
    const albumRow = mockAlbumRow({
      userId,
      handle: asAlbumHandle("misc"),
      coverImageId: asImageId("cover-img"),
    });
    mocks.resolverMocks.resolveAlbum.mockResolvedValue(albumRow);
    mocks.db.albumImageRemove.mockResolvedValue(1);

    await albumImages({ album_handle: "misc", action: "remove", image_ids: ["other-img"] }, ctx);

    expect(mocks.db.albumUpdate).not.toHaveBeenCalled();
  });

  it("should return ADD_IMAGES_FAILED when all albumImageAdd calls return null", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveAlbum.mockResolvedValue(mockAlbumRow({ userId }));
    mocks.resolverMocks.resolveImages.mockResolvedValue([
      mockImageRow({ userId, id: asImageId("img-dup") }),
    ]);
    mocks.db.albumImageMaxSortOrder.mockResolvedValue(0);
    // null means duplicate / already in album
    mocks.db.albumImageAdd.mockResolvedValue(null);

    const result = await albumImages(
      { album_handle: "my-album", action: "add", image_ids: ["img-dup"] },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("ADD_IMAGES_FAILED");
  });

  it("should handle albumImageMaxSortOrder rejection by defaulting to 0", async () => {
    const ctx: ToolContext = { userId, deps };
    const albumRow = mockAlbumRow({ userId, handle: asAlbumHandle("vacation") });
    mocks.resolverMocks.resolveAlbum.mockResolvedValue(albumRow);
    mocks.resolverMocks.resolveImages.mockResolvedValue([
      mockImageRow({ userId, id: asImageId("img-1") }),
    ]);
    mocks.db.albumImageMaxSortOrder.mockRejectedValue(new Error("Unable to fetch"));
    mocks.db.albumImageAdd.mockResolvedValue({
      id: "ai-1",
      albumId: albumRow.id,
      imageId: asImageId("img-1"),
      sortOrder: 1, // 0 + 1
      addedAt: new Date(),
    });

    const result = await albumImages(
      { album_handle: "vacation", action: "add", image_ids: ["img-1"] },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(mocks.db.albumImageAdd).toHaveBeenCalledWith(albumRow.id, asImageId("img-1"), 1);
  });

  it("should handle albumImageRemove rejection by defaulting to 0", async () => {
    const ctx: ToolContext = { userId, deps };
    const albumRow = mockAlbumRow({
      userId,
      handle: asAlbumHandle("work"),
      coverImageId: null,
    });
    mocks.resolverMocks.resolveAlbum.mockResolvedValue(albumRow);
    mocks.db.albumImageRemove.mockRejectedValue(new Error("Deletion failed"));

    const result = await albumImages(
      { album_handle: "work", action: "remove", image_ids: ["img-a"] },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.action).toBe("remove");
    expect(data.removed).toBe(0);
  });
});
