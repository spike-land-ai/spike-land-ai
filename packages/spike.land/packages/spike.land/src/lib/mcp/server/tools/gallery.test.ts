import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  featuredGalleryItem: {
    findMany: vi.fn(),
  },
  enhancedImage: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
  },
  album: {
    findMany: vi.fn(),
  },
  toolInvocation: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock(
  "@/lib/logger",
  () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }),
);

import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerGalleryTools } from "./gallery";

describe("gallery tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerGalleryTools(registry, userId);
    mockPrisma.toolInvocation.create.mockResolvedValue({});
  });

  it("should register 2 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(2);
    expect(registry.handlers.has("gallery_showcase")).toBe(true);
    expect(registry.handlers.has("gallery_public")).toBe(true);
  });

  describe("gallery_showcase (featured view)", () => {
    it("should return featured gallery items with active_only: true", async () => {
      const items = [{ id: "item-1", title: "Test Image" }];
      mockPrisma.featuredGalleryItem.findMany.mockResolvedValue(items);

      const handler = registry.handlers.get("gallery_showcase")!;
      const result = await handler({
        view: "featured",
        active_only: true,
        limit: 12,
      });

      expect(getText(result)).toContain("item-1");
      expect(getText(result)).toContain("\"view\":\"featured\"");
      expect(mockPrisma.featuredGalleryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it("should return all items when active_only: false", async () => {
      mockPrisma.featuredGalleryItem.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("gallery_showcase")!;
      await handler({ view: "featured", active_only: false, limit: 12 });

      expect(mockPrisma.featuredGalleryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });
  });

  describe("gallery_showcase (albums view)", () => {
    it("should process albums and respect limit", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: "admin-1" });
      mockPrisma.album.findMany.mockResolvedValue([
        {
          name: "Album 1",
          albumImages: [
            {
              image: {
                id: "img-1",
                name: "Image 1",
                originalUrl: "orig-1",
                enhancementJobs: [{
                  status: "COMPLETED",
                  enhancedUrl: "enh-1",
                  enhancedWidth: 100,
                  enhancedHeight: 100,
                  tier: "free",
                }],
              },
            },
            {
              image: {
                id: "img-2",
                name: "Image 2",
                originalUrl: "orig-2",
                enhancementJobs: [], // Should be skipped (no job)
              },
            },
            {
              image: {
                id: "img-3",
                name: "Image 3",
                originalUrl: "orig-3",
                enhancementJobs: [{
                  status: "COMPLETED",
                  enhancedUrl: "enh-3",
                  enhancedWidth: 100,
                  enhancedHeight: 100,
                  tier: "free",
                }],
              },
            },
          ],
        },
      ]);

      const handler = registry.handlers.get("gallery_showcase")!;
      const result = await handler({ view: "albums", limit: 1 });

      const data = JSON.parse(getText(result));
      expect(data.view).toBe("albums");
      expect(data.items).toHaveLength(1);
      expect(data.items[0].id).toBe("img-1");
    });

    it("should skip images with incomplete jobs", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: "admin-1" });
      mockPrisma.album.findMany.mockResolvedValue([
        {
          name: "Album 1",
          albumImages: [
            {
              image: {
                id: "img-1",
                name: "Image 1",
                originalUrl: "orig-1",
                enhancementJobs: [{
                  status: "COMPLETED",
                  enhancedUrl: null, // Should skip
                  enhancedWidth: 100,
                  enhancedHeight: 100,
                }],
              },
            },
          ],
        },
      ]);

      const handler = registry.handlers.get("gallery_showcase")!;
      const result = await handler({ view: "albums", limit: 10 });
      const data = JSON.parse(getText(result));
      expect(data.items).toHaveLength(0);
    });

    it("should break out of both album and image loops when limit reached across multiple albums", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: "admin-1" });
      mockPrisma.album.findMany.mockResolvedValue([
        {
          name: "Album 1",
          albumImages: [
            {
              image: {
                id: "img-1",
                name: "Image 1",
                originalUrl: "orig-1",
                enhancementJobs: [{
                  status: "COMPLETED",
                  enhancedUrl: "enh-1",
                  enhancedWidth: 100,
                  enhancedHeight: 100,
                  tier: "free",
                }],
              },
            },
          ],
        },
        {
          name: "Album 2",
          albumImages: [
            {
              image: {
                id: "img-4",
                name: "Image 4",
                originalUrl: "orig-4",
                enhancementJobs: [{
                  status: "COMPLETED",
                  enhancedUrl: "enh-4",
                  enhancedWidth: 200,
                  enhancedHeight: 200,
                  tier: "premium",
                }],
              },
            },
          ],
        },
      ]);

      const handler = registry.handlers.get("gallery_showcase")!;
      const result = await handler({ view: "albums", limit: 1 });

      const data = JSON.parse(getText(result));
      expect(data.items).toHaveLength(1);
      expect(data.items[0].id).toBe("img-1");
      // img-4 from Album 2 should not be included because limit was reached
    });

    it("should error when super admin not found", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("gallery_showcase")!;
      const result = await handler({ view: "albums", limit: 12 });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
    });
  });

  describe("gallery_public", () => {
    it("should return paginated public gallery", async () => {
      const images = [{ id: "img-1", isPublic: true }];
      mockPrisma.enhancedImage.findMany.mockResolvedValue(images);
      mockPrisma.enhancedImage.count.mockResolvedValue(1);

      const handler = registry.handlers.get("gallery_public")!;
      const result = await handler({
        page: 1,
        limit: 20,
        tags: [],
        tier: undefined,
      });

      expect(getText(result)).toContain("img-1");
      expect(getText(result)).toContain("pagination");
    });

    it("should apply tags and tier filters", async () => {
      mockPrisma.enhancedImage.findMany.mockResolvedValue([]);
      mockPrisma.enhancedImage.count.mockResolvedValue(0);

      const handler = registry.handlers.get("gallery_public")!;
      await handler({
        page: 1,
        limit: 10,
        tags: ["nature", "art"],
        tier: "gold",
      });

      expect(mockPrisma.enhancedImage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPublic: true,
            tags: { hasSome: ["nature", "art"] },
            enhancementJobs: {
              some: {
                tier: "gold",
                status: "COMPLETED",
              },
            },
          }),
        }),
      );
    });
  });
});
