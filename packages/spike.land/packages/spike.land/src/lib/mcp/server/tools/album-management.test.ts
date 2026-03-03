import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  album: {
    aggregate: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  albumImage: {
    findFirst: vi.fn(),
  },
  enhancementPipeline: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: () => "mock-token-12",
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerAlbumManagementTools } from "./album-management";

describe("album-management tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerAlbumManagementTools(registry, userId);
  });

  it("should register 5 album-management tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("album_create")).toBe(true);
    expect(registry.handlers.has("album_list")).toBe(true);
    expect(registry.handlers.has("album_get")).toBe(true);
    expect(registry.handlers.has("album_update")).toBe(true);
    expect(registry.handlers.has("album_delete")).toBe(true);
  });

  describe("album_create", () => {
    it("should create album with defaults", async () => {
      mockPrisma.album.aggregate.mockResolvedValue({
        _max: { sortOrder: 2 },
      });
      mockPrisma.album.create.mockResolvedValue({
        id: "album-1",
        name: "My Album",
        privacy: "PRIVATE",
        shareToken: null,
      });

      const handler = registry.handlers.get("album_create")!;
      const result = await handler({
        name: "My Album",
        privacy: "PRIVATE",
        default_tier: "TIER_1K",
      });

      const text = getText(result);
      expect(text).toContain("Album Created!");
      expect(text).toContain("My Album");
      expect(mockPrisma.album.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          name: "My Album",
          privacy: "PRIVATE",
          sortOrder: 3,
          shareToken: null,
        }),
      });
    });

    it("should create PUBLIC album with share token", async () => {
      mockPrisma.album.aggregate.mockResolvedValue({
        _max: { sortOrder: null },
      });
      mockPrisma.album.create.mockResolvedValue({
        id: "album-2",
        name: "Public Album",
        privacy: "PUBLIC",
        shareToken: "mock-token-12",
      });

      const handler = registry.handlers.get("album_create")!;
      const result = await handler({
        name: "Public Album",
        privacy: "PUBLIC",
        default_tier: "TIER_2K",
      });

      const text = getText(result);
      expect(text).toContain("PUBLIC");
      expect(text).toContain("mock-token-12");
      expect(mockPrisma.album.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          privacy: "PUBLIC",
          defaultTier: "TIER_2K",
          shareToken: "mock-token-12",
        }),
      });
    });

    it("should trim name and description", async () => {
      mockPrisma.album.aggregate.mockResolvedValue({
        _max: { sortOrder: null },
      });
      mockPrisma.album.create.mockResolvedValue({
        id: "album-3",
        name: "Trimmed",
        privacy: "PRIVATE",
        shareToken: null,
      });

      const handler = registry.handlers.get("album_create")!;
      await handler({
        name: "  Trimmed  ",
        description: "  Some description  ",
      });

      expect(mockPrisma.album.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Trimmed",
          description: "Some description",
        }),
      });
    });

    it("should handle database errors", async () => {
      mockPrisma.album.aggregate.mockRejectedValue(new Error("DB error"));

      const handler = registry.handlers.get("album_create")!;
      const result = await handler({ name: "Fail" });

      expect(result).toEqual(expect.objectContaining({ isError: true }));
    });
  });

  describe("album_list", () => {
    it("should list user albums", async () => {
      mockPrisma.album.findMany.mockResolvedValue([
        {
          id: "album-1",
          name: "Album 1",
          description: null,
          privacy: "PRIVATE",
          coverImageId: null,
          _count: { albumImages: 5 },
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-02"),
        },
      ]);

      const handler = registry.handlers.get("album_list")!;
      const result = await handler({ limit: 20 });

      const text = getText(result);
      expect(text).toContain("My Albums (1)");
      expect(text).toContain("Album 1");
      expect(text).toContain("PRIVATE");
      expect(text).toContain("Images: 5");
    });

    it("should show empty message when no albums", async () => {
      mockPrisma.album.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("album_list")!;
      const result = await handler({ limit: 20 });

      const text = getText(result);
      expect(text).toContain("My Albums (0)");
      expect(text).toContain("album_create");
    });

    it("should respect limit parameter", async () => {
      mockPrisma.album.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("album_list")!;
      await handler({ limit: 5 });

      expect(mockPrisma.album.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  describe("album_get", () => {
    it("should get album details for owner", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        id: "album-1",
        userId,
        name: "My Album",
        description: "Test description",
        privacy: "PUBLIC",
        coverImageId: "img-1",
        shareToken: "token-123",
        defaultTier: "TIER_2K",
        _count: { albumImages: 10 },
        createdAt: new Date("2025-01-01"),
      });

      const handler = registry.handlers.get("album_get")!;
      const result = await handler({ album_id: "album-1" });

      const text = getText(result);
      expect(text).toContain("My Album");
      expect(text).toContain("PUBLIC");
      expect(text).toContain("10");
      expect(text).toContain("Test description");
      expect(text).toContain("token-123");
      expect(text).toContain("Owner:** You");
    });

    it("should include share URL for owner of non-PRIVATE album", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        id: "album-1",
        userId,
        name: "Shared Album",
        description: null,
        privacy: "PUBLIC",
        coverImageId: null,
        shareToken: "abc123",
        defaultTier: "TIER_1K",
        _count: { albumImages: 3 },
        createdAt: new Date("2025-01-01"),
      });

      const handler = registry.handlers.get("album_get")!;
      const result = await handler({ album_id: "album-1" });

      const text = getText(result);
      expect(text).toContain("Share URL:");
      expect(text).toContain("/albums/shared/abc123");
      expect(text).toContain("Share Token:** abc123");
    });

    it("should not include share URL for PRIVATE album", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        id: "album-1",
        userId,
        name: "Private Album",
        description: null,
        privacy: "PRIVATE",
        coverImageId: null,
        shareToken: null,
        defaultTier: "TIER_1K",
        _count: { albumImages: 0 },
        createdAt: new Date("2025-01-01"),
      });

      const handler = registry.handlers.get("album_get")!;
      const result = await handler({ album_id: "album-1" });

      const text = getText(result);
      expect(text).not.toContain("Share URL:");
      expect(text).not.toContain("Share Token:");
    });

    it("should allow non-owner to view PUBLIC album without share URL", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        id: "album-1",
        userId: "other-user",
        name: "Public Album",
        description: null,
        privacy: "PUBLIC",
        coverImageId: null,
        shareToken: "token-123",
        defaultTier: "TIER_1K",
        _count: { albumImages: 3 },
        createdAt: new Date("2025-01-01"),
      });

      const handler = registry.handlers.get("album_get")!;
      const result = await handler({ album_id: "album-1" });

      const text = getText(result);
      expect(text).toContain("Public Album");
      expect(text).toContain("Owner:** Another user");
      // Non-owner should NOT see share token or URL
      expect(text).not.toContain("token-123");
      expect(text).not.toContain("Share URL:");
    });

    it("should deny non-owner access to PRIVATE album", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        id: "album-1",
        userId: "other-user",
        name: "Private Album",
        privacy: "PRIVATE",
        _count: { albumImages: 0 },
      });

      const handler = registry.handlers.get("album_get")!;
      const result = await handler({ album_id: "album-1" });

      expect(getText(result)).toContain("ALBUM_NOT_FOUND");
    });

    it("should return error for non-existent album", async () => {
      mockPrisma.album.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("album_get")!;
      const result = await handler({ album_id: "no-album" });

      expect(getText(result)).toContain("ALBUM_NOT_FOUND");
    });
  });

  describe("album_update", () => {
    it("should update album name", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        shareToken: null,
      });
      mockPrisma.album.update.mockResolvedValue({
        name: "Updated Name",
        privacy: "PRIVATE",
        defaultTier: "TIER_1K",
      });

      const handler = registry.handlers.get("album_update")!;
      const result = await handler({
        album_id: "album-1",
        name: "Updated Name",
      });

      const text = getText(result);
      expect(text).toContain("Album Updated!");
      expect(text).toContain("Updated Name");
      expect(mockPrisma.album.update).toHaveBeenCalledWith({
        where: { id: "album-1" },
        data: { name: "Updated Name" },
      });
    });

    it("should generate share token when changing to PUBLIC", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        shareToken: null,
      });
      mockPrisma.album.update.mockResolvedValue({
        name: "Now Public",
        privacy: "PUBLIC",
        defaultTier: "TIER_1K",
      });

      const handler = registry.handlers.get("album_update")!;
      await handler({ album_id: "album-1", privacy: "PUBLIC" });

      expect(mockPrisma.album.update).toHaveBeenCalledWith({
        where: { id: "album-1" },
        data: expect.objectContaining({
          privacy: "PUBLIC",
          shareToken: "mock-token-12",
        }),
      });
    });

    it("should remove share token when changing to PRIVATE", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        shareToken: "existing-token",
      });
      mockPrisma.album.update.mockResolvedValue({
        name: "Now Private",
        privacy: "PRIVATE",
        defaultTier: "TIER_1K",
      });

      const handler = registry.handlers.get("album_update")!;
      await handler({ album_id: "album-1", privacy: "PRIVATE" });

      expect(mockPrisma.album.update).toHaveBeenCalledWith({
        where: { id: "album-1" },
        data: expect.objectContaining({
          privacy: "PRIVATE",
          shareToken: null,
        }),
      });
    });

    it("should not regenerate token if already exists when going PUBLIC", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        shareToken: "existing-token",
      });
      mockPrisma.album.update.mockResolvedValue({
        name: "Still Public",
        privacy: "PUBLIC",
        defaultTier: "TIER_1K",
      });

      const handler = registry.handlers.get("album_update")!;
      await handler({ album_id: "album-1", privacy: "PUBLIC" });

      // Should NOT include shareToken in update since one already exists
      expect(mockPrisma.album.update).toHaveBeenCalledWith({
        where: { id: "album-1" },
        data: { privacy: "PUBLIC" },
      });
    });

    it("should validate cover image is in album", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        shareToken: null,
      });
      mockPrisma.albumImage.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("album_update")!;
      const result = await handler({
        album_id: "album-1",
        cover_image_id: "not-in-album",
      });

      expect(getText(result)).toContain("VALIDATION_ERROR");
      expect(getText(result)).toContain("Cover image must be in the album");
    });

    it("should set cover image when image is in album", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        shareToken: null,
      });
      mockPrisma.albumImage.findFirst.mockResolvedValue({
        albumId: "album-1",
        imageId: "img-1",
      });
      mockPrisma.album.update.mockResolvedValue({
        name: "With Cover",
        privacy: "PRIVATE",
        defaultTier: "TIER_1K",
      });

      const handler = registry.handlers.get("album_update")!;
      const result = await handler({
        album_id: "album-1",
        cover_image_id: "img-1",
      });

      expect(getText(result)).toContain("Album Updated!");
      expect(mockPrisma.album.update).toHaveBeenCalledWith({
        where: { id: "album-1" },
        data: { coverImageId: "img-1" },
      });
    });

    it("should allow clearing cover image with null", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        shareToken: null,
      });
      mockPrisma.album.update.mockResolvedValue({
        name: "No Cover",
        privacy: "PRIVATE",
        defaultTier: "TIER_1K",
      });

      const handler = registry.handlers.get("album_update")!;
      await handler({ album_id: "album-1", cover_image_id: null });

      expect(mockPrisma.album.update).toHaveBeenCalledWith({
        where: { id: "album-1" },
        data: { coverImageId: null },
      });
    });

    it("should validate pipeline access", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        shareToken: null,
      });
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        userId: "other-user",
        visibility: "PRIVATE",
      });

      const handler = registry.handlers.get("album_update")!;
      const result = await handler({
        album_id: "album-1",
        pipeline_id: "pipe-1",
      });

      expect(getText(result)).toContain("FORBIDDEN");
      expect(getText(result)).toContain("pipeline");
    });

    it("should allow public pipeline access", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        shareToken: null,
      });
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        userId: "other-user",
        visibility: "PUBLIC",
      });
      mockPrisma.album.update.mockResolvedValue({
        name: "With Pipeline",
        privacy: "PRIVATE",
        defaultTier: "TIER_1K",
      });

      const handler = registry.handlers.get("album_update")!;
      await handler({ album_id: "album-1", pipeline_id: "pipe-1" });

      expect(mockPrisma.album.update).toHaveBeenCalledWith({
        where: { id: "album-1" },
        data: { pipelineId: "pipe-1" },
      });
    });

    it("should allow system default pipeline (userId null)", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        shareToken: null,
      });
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        userId: null,
        visibility: "PRIVATE",
      });
      mockPrisma.album.update.mockResolvedValue({
        name: "With System Pipeline",
        privacy: "PRIVATE",
        defaultTier: "TIER_1K",
      });

      const handler = registry.handlers.get("album_update")!;
      await handler({ album_id: "album-1", pipeline_id: "system-pipe" });

      expect(mockPrisma.album.update).toHaveBeenCalledWith({
        where: { id: "album-1" },
        data: { pipelineId: "system-pipe" },
      });
    });

    it("should clear pipeline with null pipeline_id", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        shareToken: null,
      });
      mockPrisma.album.update.mockResolvedValue({
        name: "No Pipeline",
        privacy: "PRIVATE",
        defaultTier: "TIER_1K",
      });

      const handler = registry.handlers.get("album_update")!;
      await handler({ album_id: "album-1", pipeline_id: null });

      expect(mockPrisma.album.update).toHaveBeenCalledWith({
        where: { id: "album-1" },
        data: { pipelineId: null },
      });
    });

    it("should update default_tier", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        shareToken: null,
      });
      mockPrisma.album.update.mockResolvedValue({
        name: "Upgraded",
        privacy: "PRIVATE",
        defaultTier: "TIER_4K",
      });

      const handler = registry.handlers.get("album_update")!;
      const result = await handler({
        album_id: "album-1",
        default_tier: "TIER_4K",
      });

      expect(getText(result)).toContain("Album Updated!");
      expect(mockPrisma.album.update).toHaveBeenCalledWith({
        where: { id: "album-1" },
        data: { defaultTier: "TIER_4K" },
      });
    });

    it("should update description to null when empty string", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        shareToken: null,
      });
      mockPrisma.album.update.mockResolvedValue({
        name: "Cleared Desc",
        privacy: "PRIVATE",
        defaultTier: "TIER_1K",
      });

      const handler = registry.handlers.get("album_update")!;
      await handler({ album_id: "album-1", description: "" });

      expect(mockPrisma.album.update).toHaveBeenCalledWith({
        where: { id: "album-1" },
        data: { description: null },
      });
    });

    it("should return error if album not found", async () => {
      mockPrisma.album.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("album_update")!;
      const result = await handler({
        album_id: "no-album",
        name: "Ghost",
      });

      expect(getText(result)).toContain("ALBUM_NOT_FOUND");
    });

    it("should return error if not album owner", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId: "other-user",
        shareToken: null,
      });

      const handler = registry.handlers.get("album_update")!;
      const result = await handler({
        album_id: "album-1",
        name: "Hacked",
      });

      expect(getText(result)).toContain("FORBIDDEN");
    });

    it("should return error if pipeline not found", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        shareToken: null,
      });
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("album_update")!;
      const result = await handler({
        album_id: "album-1",
        pipeline_id: "no-pipe",
      });

      expect(getText(result)).toContain("VALIDATION_ERROR");
      expect(getText(result)).toContain("Pipeline not found");
    });
  });

  describe("album_delete", () => {
    it("should require confirm=true", async () => {
      const handler = registry.handlers.get("album_delete")!;
      const result = await handler({
        album_id: "album-1",
        confirm: false,
      });

      expect(getText(result)).toContain("Safety Check Failed");
    });

    it("should delete album when confirmed", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId,
        name: "Doomed Album",
      });
      mockPrisma.album.delete.mockResolvedValue({});

      const handler = registry.handlers.get("album_delete")!;
      const result = await handler({
        album_id: "album-1",
        confirm: true,
      });

      const text = getText(result);
      expect(text).toContain("Album Deleted!");
      expect(text).toContain("Doomed Album");
      expect(mockPrisma.album.delete).toHaveBeenCalledWith({
        where: { id: "album-1" },
      });
    });

    it("should return error if not album owner", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({
        userId: "other-user",
        name: "Not Yours",
      });

      const handler = registry.handlers.get("album_delete")!;
      const result = await handler({
        album_id: "album-1",
        confirm: true,
      });

      expect(getText(result)).toContain("FORBIDDEN");
    });

    it("should return error if album not found", async () => {
      mockPrisma.album.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("album_delete")!;
      const result = await handler({
        album_id: "no-album",
        confirm: true,
      });

      expect(getText(result)).toContain("ALBUM_NOT_FOUND");
    });
  });
});
