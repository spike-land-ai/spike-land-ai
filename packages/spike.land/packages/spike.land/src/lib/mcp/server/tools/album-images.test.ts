import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  album: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  albumImage: {
    aggregate: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  enhancedImage: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerAlbumImagesTools } from "./album-images";

describe("album-images tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerAlbumImagesTools(registry, userId);
  });

  it("should register 5 album-images tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("album_images_add")).toBe(true);
    expect(registry.handlers.has("album_images_remove")).toBe(true);
    expect(registry.handlers.has("album_images_reorder")).toBe(true);
    expect(registry.handlers.has("album_images_list")).toBe(true);
    expect(registry.handlers.has("album_images_move")).toBe(true);
  });

  describe("album_images_add", () => {
    it("should add images to album", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({ userId });
      mockPrisma.enhancedImage.findMany.mockResolvedValue([
        { id: "img-1" },
        { id: "img-2" },
      ]);
      mockPrisma.albumImage.aggregate.mockResolvedValue({
        _max: { sortOrder: 3 },
      });
      mockPrisma.albumImage.create.mockResolvedValue({ id: "ai-1" });

      const handler = registry.handlers.get("album_images_add")!;
      const result = await handler({
        album_id: "album-1",
        image_ids: ["img-1", "img-2"],
      });

      const text = getText(result);
      expect(text).toContain("Images Added");
      expect(text).toContain("Added:** 2");
      expect(mockPrisma.albumImage.create).toHaveBeenCalledTimes(2);
      // First image starts at sortOrder 4 (3 + 1)
      expect(mockPrisma.albumImage.create).toHaveBeenCalledWith({
        data: { albumId: "album-1", imageId: "img-1", sortOrder: 4 },
      });
      expect(mockPrisma.albumImage.create).toHaveBeenCalledWith({
        data: { albumId: "album-1", imageId: "img-2", sortOrder: 5 },
      });
    });

    it("should skip duplicates (P2002)", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({ userId });
      mockPrisma.enhancedImage.findMany.mockResolvedValue([{ id: "img-1" }]);
      mockPrisma.albumImage.aggregate.mockResolvedValue({
        _max: { sortOrder: null },
      });
      const p2002Error = new Error("Unique constraint") as Error & {
        code: string;
      };
      p2002Error.code = "P2002";
      mockPrisma.albumImage.create.mockRejectedValue(p2002Error);

      const handler = registry.handlers.get("album_images_add")!;
      const result = await handler({
        album_id: "album-1",
        image_ids: ["img-1"],
      });

      const text = getText(result);
      expect(text).toContain("Added:** 0");
      expect(text).toContain("Skipped");
    });

    it("should return error if album not found", async () => {
      mockPrisma.album.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("album_images_add")!;
      const result = await handler({
        album_id: "no-album",
        image_ids: ["img-1"],
      });

      expect(getText(result)).toContain("ALBUM_NOT_FOUND");
    });

    it("should return error if not album owner", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({ userId: "other-user" });

      const handler = registry.handlers.get("album_images_add")!;
      const result = await handler({
        album_id: "album-1",
        image_ids: ["img-1"],
      });

      expect(getText(result)).toContain("FORBIDDEN");
    });

    it("should re-throw non-P2002 errors during add", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({ userId });
      mockPrisma.enhancedImage.findMany.mockResolvedValue([{ id: "img-1" }]);
      mockPrisma.albumImage.aggregate.mockResolvedValue({
        _max: { sortOrder: null },
      });
      mockPrisma.albumImage.create.mockRejectedValue(
        new Error("DB connection lost"),
      );

      const handler = registry.handlers.get("album_images_add")!;
      const result = await handler({
        album_id: "album-1",
        image_ids: ["img-1"],
      });

      // safeToolCall wraps the error
      expect(result).toEqual(expect.objectContaining({ isError: true }));
    });

    it("should return error if images don't belong to user", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({ userId });
      mockPrisma.enhancedImage.findMany.mockResolvedValue([]); // No matching images

      const handler = registry.handlers.get("album_images_add")!;
      const result = await handler({
        album_id: "album-1",
        image_ids: ["img-1"],
      });

      expect(getText(result)).toContain("VALIDATION_ERROR");
    });
  });

  describe("album_images_remove", () => {
    it("should remove images from album", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        coverImageId: null,
      });
      mockPrisma.albumImage.deleteMany.mockResolvedValue({ count: 2 });

      const handler = registry.handlers.get("album_images_remove")!;
      const result = await handler({
        album_id: "album-1",
        image_ids: ["img-1", "img-2"],
      });

      const text = getText(result);
      expect(text).toContain("Images Removed");
      expect(text).toContain("Removed:** 2");
    });

    it("should clear cover when removing cover image", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        coverImageId: "img-1",
      });
      mockPrisma.albumImage.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.album.update.mockResolvedValue({});

      const handler = registry.handlers.get("album_images_remove")!;
      await handler({
        album_id: "album-1",
        image_ids: ["img-1"],
      });

      expect(mockPrisma.album.update).toHaveBeenCalledWith({
        where: { id: "album-1" },
        data: { coverImageId: null },
      });
    });

    it("should return error if album not found", async () => {
      mockPrisma.album.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("album_images_remove")!;
      const result = await handler({
        album_id: "no-album",
        image_ids: ["img-1"],
      });

      expect(getText(result)).toContain("ALBUM_NOT_FOUND");
    });

    it("should return FORBIDDEN if not album owner", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId: "other-user",
        coverImageId: null,
      });

      const handler = registry.handlers.get("album_images_remove")!;
      const result = await handler({
        album_id: "album-1",
        image_ids: ["img-1"],
      });

      expect(getText(result)).toContain("FORBIDDEN");
    });
  });

  describe("album_images_reorder", () => {
    it("should reorder images via transaction", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({ userId });
      mockPrisma.albumImage.count.mockResolvedValue(3);
      mockPrisma.$transaction.mockResolvedValue([]);

      const handler = registry.handlers.get("album_images_reorder")!;
      const result = await handler({
        album_id: "album-1",
        image_order: ["img-2", "img-1", "img-3"],
      });

      const text = getText(result);
      expect(text).toContain("Images Reordered");
      expect(text).toContain("3 image(s)");
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("should return error if not album owner", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({ userId: "other-user" });

      const handler = registry.handlers.get("album_images_reorder")!;
      const result = await handler({
        album_id: "album-1",
        image_order: ["img-1"],
      });

      expect(getText(result)).toContain("FORBIDDEN");
    });

    it("should return error if album not found", async () => {
      mockPrisma.album.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("album_images_reorder")!;
      const result = await handler({
        album_id: "no-album",
        image_order: ["img-1"],
      });

      expect(getText(result)).toContain("ALBUM_NOT_FOUND");
    });

    it("should return specific count mismatch error when some images not in album", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({ userId });
      mockPrisma.albumImage.count.mockResolvedValue(1); // Only 1 of 3 found

      const handler = registry.handlers.get("album_images_reorder")!;
      const result = await handler({
        album_id: "album-1",
        image_order: ["img-1", "img-2", "img-3"],
      });

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("2 of 3 images not found in album");
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("album_images_list", () => {
    it("should list images in album", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        privacy: "PRIVATE",
        name: "My Album",
      });
      mockPrisma.albumImage.findMany.mockResolvedValue([
        {
          image: {
            id: "img-1",
            name: "Photo 1",
            originalUrl: "https://example.com/1.jpg",
            originalWidth: 1920,
            originalHeight: 1080,
          },
        },
      ]);

      const handler = registry.handlers.get("album_images_list")!;
      const result = await handler({ album_id: "album-1" });

      const text = getText(result);
      expect(text).toContain("My Album");
      expect(text).toContain("Photo 1");
      expect(text).toContain("1920x1080");
      expect(text).toContain("img-1");
    });

    it("should show empty message when no images", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        privacy: "PRIVATE",
        name: "Empty Album",
      });
      mockPrisma.albumImage.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("album_images_list")!;
      const result = await handler({ album_id: "album-1" });

      const text = getText(result);
      expect(text).toContain("0 images");
      expect(text).toContain("album_images_add");
    });

    it("should deny access to PRIVATE albums from non-owners", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId: "other-user",
        privacy: "PRIVATE",
        name: "Secret Album",
      });

      const handler = registry.handlers.get("album_images_list")!;
      const result = await handler({ album_id: "album-1" });

      expect(getText(result)).toContain("ALBUM_NOT_FOUND");
    });

    it("should return error if album not found", async () => {
      mockPrisma.album.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("album_images_list")!;
      const result = await handler({ album_id: "no-album" });

      expect(getText(result)).toContain("ALBUM_NOT_FOUND");
    });

    it("should allow access to PUBLIC albums from non-owners", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId: "other-user",
        privacy: "PUBLIC",
        name: "Public Album",
      });
      mockPrisma.albumImage.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("album_images_list")!;
      const result = await handler({ album_id: "album-1" });

      const text = getText(result);
      expect(text).toContain("Public Album");
    });
  });

  describe("album_images_move", () => {
    it("should move images between albums", async () => {
      mockPrisma.album.findUnique
        .mockResolvedValueOnce({ userId, coverImageId: null }) // source
        .mockResolvedValueOnce({ userId }); // target
      mockPrisma.albumImage.findMany.mockResolvedValue([
        { imageId: "img-1" },
        { imageId: "img-2" },
      ]);
      mockPrisma.albumImage.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.albumImage.aggregate.mockResolvedValue({
        _max: { sortOrder: 1 },
      });
      mockPrisma.albumImage.create.mockResolvedValue({ id: "ai-new" });

      const handler = registry.handlers.get("album_images_move")!;
      const result = await handler({
        source_album_id: "album-1",
        target_album_id: "album-2",
        image_ids: ["img-1", "img-2"],
      });

      const text = getText(result);
      expect(text).toContain("Images Moved");
      expect(text).toContain("Removed from source:** 2");
      expect(text).toContain("Added to target:** 2");
    });

    it("should clear cover if moved image was source cover", async () => {
      mockPrisma.album.findUnique
        .mockResolvedValueOnce({ userId, coverImageId: "img-1" })
        .mockResolvedValueOnce({ userId });
      mockPrisma.albumImage.findMany.mockResolvedValue([{ imageId: "img-1" }]);
      mockPrisma.albumImage.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.album.update.mockResolvedValue({});
      mockPrisma.albumImage.aggregate.mockResolvedValue({
        _max: { sortOrder: null },
      });
      mockPrisma.albumImage.create.mockResolvedValue({ id: "ai-new" });

      const handler = registry.handlers.get("album_images_move")!;
      await handler({
        source_album_id: "album-1",
        target_album_id: "album-2",
        image_ids: ["img-1"],
      });

      expect(mockPrisma.album.update).toHaveBeenCalledWith({
        where: { id: "album-1" },
        data: { coverImageId: null },
      });
    });

    it("should return error if source album not found", async () => {
      mockPrisma.album.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ userId });

      const handler = registry.handlers.get("album_images_move")!;
      const result = await handler({
        source_album_id: "no-album",
        target_album_id: "album-2",
        image_ids: ["img-1"],
      });

      expect(getText(result)).toContain("Source album");
    });

    it("should return error if target album not found", async () => {
      mockPrisma.album.findUnique
        .mockResolvedValueOnce({ userId, coverImageId: null })
        .mockResolvedValueOnce(null);

      const handler = registry.handlers.get("album_images_move")!;
      const result = await handler({
        source_album_id: "album-1",
        target_album_id: "no-album",
        image_ids: ["img-1"],
      });

      expect(getText(result)).toContain("Target album");
    });

    it("should skip duplicates when moving to target album", async () => {
      mockPrisma.album.findUnique
        .mockResolvedValueOnce({ userId, coverImageId: null })
        .mockResolvedValueOnce({ userId });
      mockPrisma.albumImage.findMany.mockResolvedValue([{ imageId: "img-1" }]);
      mockPrisma.albumImage.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.albumImage.aggregate.mockResolvedValue({
        _max: { sortOrder: null },
      });
      const p2002Error = new Error("Unique constraint") as Error & {
        code: string;
      };
      p2002Error.code = "P2002";
      mockPrisma.albumImage.create.mockRejectedValue(p2002Error);

      const handler = registry.handlers.get("album_images_move")!;
      const result = await handler({
        source_album_id: "album-1",
        target_album_id: "album-2",
        image_ids: ["img-1"],
      });

      const text = getText(result);
      expect(text).toContain("Added to target:** 0");
    });

    it("should throw non-P2002 errors during move", async () => {
      mockPrisma.album.findUnique
        .mockResolvedValueOnce({ userId, coverImageId: null })
        .mockResolvedValueOnce({ userId });
      mockPrisma.albumImage.findMany.mockResolvedValue([{ imageId: "img-1" }]);
      mockPrisma.albumImage.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.albumImage.aggregate.mockResolvedValue({
        _max: { sortOrder: null },
      });
      mockPrisma.albumImage.create.mockRejectedValue(
        new Error("DB connection lost"),
      );

      const handler = registry.handlers.get("album_images_move")!;
      const result = await handler({
        source_album_id: "album-1",
        target_album_id: "album-2",
        image_ids: ["img-1"],
      });

      // safeToolCall wraps the error
      expect(result).toEqual(expect.objectContaining({ isError: true }));
    });

    it("should return error if user doesn't own both albums", async () => {
      mockPrisma.album.findUnique
        .mockResolvedValueOnce({ userId, coverImageId: null })
        .mockResolvedValueOnce({ userId: "other-user" });

      const handler = registry.handlers.get("album_images_move")!;
      const result = await handler({
        source_album_id: "album-1",
        target_album_id: "album-2",
        image_ids: ["img-1"],
      });

      expect(getText(result)).toContain("FORBIDDEN");
    });

    it("should reject move when images are not in source album (image theft)", async () => {
      // Attacker owns both albums but tries to move images that aren't in the source album
      mockPrisma.album.findUnique
        .mockResolvedValueOnce({ userId, coverImageId: null }) // source
        .mockResolvedValueOnce({ userId }); // target
      // findMany returns fewer images than requested — some images not in source
      mockPrisma.albumImage.findMany.mockResolvedValue([{ imageId: "img-1" }]);

      const handler = registry.handlers.get("album_images_move")!;
      const result = await handler({
        source_album_id: "album-1",
        target_album_id: "album-2",
        image_ids: ["img-1", "stolen-img"],
      });

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("not found in the source album");
      // Must NOT proceed with deleteMany or create
      expect(mockPrisma.albumImage.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.albumImage.create).not.toHaveBeenCalled();
    });

    it("should reject move when images belong to another user (ownership theft)", async () => {
      // Attacker owns both albums but tries to move images that belong to someone else
      mockPrisma.album.findUnique
        .mockResolvedValueOnce({ userId, coverImageId: null }) // source
        .mockResolvedValueOnce({ userId }); // target
      // The join check filters out images not owned by the user
      mockPrisma.albumImage.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("album_images_move")!;
      const result = await handler({
        source_album_id: "album-1",
        target_album_id: "album-2",
        image_ids: ["other-users-img"],
      });

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(mockPrisma.albumImage.deleteMany).not.toHaveBeenCalled();
    });
  });
});
