import { beforeEach, describe, expect, it } from "vitest";
import { createMockImageStudioDeps, mockAlbumRow } from "../__test-utils__/mock-deps.js";
import { album } from "./album.js";
import type { ToolContext } from "../types.js";
import { asImageId } from "../types.js";

describe("album", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should return album details for owner", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.albumFindByHandle.mockResolvedValue(
      mockAlbumRow({ userId, name: "My Photos", privacy: "PRIVATE" }),
    );

    const result = await album({ album_handle: "my-album" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("My Photos");
    expect(data.privacy).toBe("PRIVATE");
  });

  it("should include share_token for owner when shareToken is set", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.albumFindByHandle.mockResolvedValue(
      mockAlbumRow({
        userId,
        shareToken: "share-tok-abc",
        privacy: "UNLISTED",
      }),
    );

    const result = await album({ album_handle: "my-album" }, ctx);

    const data = JSON.parse(result.content[0].text);
    expect(data.share_token).toBe("share-tok-abc");
    expect(data.share_url).toBe("https://spike.land/pixel/album/share-tok-abc");
  });

  it("should not include share_token for non-owner", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.albumFindByHandle.mockResolvedValue(
      mockAlbumRow({
        userId: "other-user",
        shareToken: "tok",
        privacy: "PUBLIC",
      }),
    );

    const result = await album({ album_handle: "public-album" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.share_token).toBeUndefined();
  });

  it("should return NOT_FOUND for private album owned by another user", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.albumFindByHandle.mockResolvedValue(
      mockAlbumRow({ userId: "other-user", privacy: "PRIVATE" }),
    );

    const result = await album({ album_handle: "private-other" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NOT_FOUND");
  });

  it("should return NOT_FOUND when album does not exist", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.albumFindByHandle.mockResolvedValue(null);

    const result = await album({ album_handle: "no-such-album" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NOT_FOUND");
  });

  it("should include images when include_images is true", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.albumFindByHandle.mockResolvedValue(mockAlbumRow({ userId }));
    mocks.db.albumImageList.mockResolvedValue([
      {
        id: "ai-1",
        albumId: "album-uuid-1",
        imageId: asImageId("img-1"),
        sortOrder: 1,
        addedAt: new Date(),
        image: {
          id: asImageId("img-1"),
          name: "pic.jpg",
          originalUrl: "https://r2.spike.land/pic.jpg",
          originalWidth: 800,
          originalHeight: 600,
        },
      },
    ]);

    const result = await album(
      {
        album_handle: "my-album",
        include_images: true,
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.images).toHaveLength(1);
    expect(data.images[0].name).toBe("pic.jpg");
    expect(data.images[0].sort_order).toBe(1);
  });

  it("should return error when albumImageList fails with include_images", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.albumFindByHandle.mockResolvedValue(mockAlbumRow({ userId }));
    mocks.db.albumImageList.mockRejectedValue(new Error("DB error"));

    const result = await album(
      {
        album_handle: "my-album",
        include_images: true,
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("LIST_IMAGES_FAILED");
  });

  it("should expose image_count from _count", async () => {
    const ctx: ToolContext = { userId, deps };
    const row = { ...mockAlbumRow({ userId }), _count: { albumImages: 7 } };
    mocks.db.albumFindByHandle.mockResolvedValue(row);

    const result = await album({ album_handle: "my-album" }, ctx);

    const data = JSON.parse(result.content[0].text);
    expect(data.image_count).toBe(7);
  });

  it("should array fallback to empty when albumImageList returns null", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.albumFindByHandle.mockResolvedValue(mockAlbumRow({ userId }));
    // Simulate query returning null for some reason
    mocks.db.albumImageList.mockResolvedValue(
      null as unknown as Awaited<ReturnType<typeof deps.db.albumImageList>>,
    );

    const result = await album(
      {
        album_handle: "my-album",
        include_images: true,
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    // Should gracefully fallback to empty array
    expect(data.images).toEqual([]);
  });
});
