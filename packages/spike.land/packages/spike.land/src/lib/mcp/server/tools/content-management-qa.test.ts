import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  blogPost: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  album: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  albumImage: {
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(promises => Promise.all(promises)),
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerBlogManagementTools } from "./blog-management";
import { registerAlbumImagesTools } from "./album-images";

describe("Content Management QA - Reproduction Tests", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerBlogManagementTools(registry, userId);
    registerAlbumImagesTools(registry, userId);
  });

  describe("Bug: blog_publish_post allows 'scheduled' status", () => {
    it("should successfully publish a 'scheduled' post", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "post-scheduled",
        userId,
        status: "scheduled",
      });
      mockPrisma.blogPost.update.mockResolvedValue({
        id: "post-scheduled",
        title: "Scheduled Post",
        slug: "scheduled-post",
        status: "published",
      });

      const handler = registry.handlers.get("blog_publish_post")!;
      const result = await handler({ post_id: "post-scheduled" });

      expect(getText(result)).toContain("Post Published");
      expect(getText(result)).toContain("scheduled-post");
    });
  });

  describe("Inconsistency: album_images_reorder silent failure", () => {
    it("should report success even if image_ids are invalid or not in album", async () => {
      mockPrisma.album.findUnique.mockResolvedValue({ userId });
      // count returns 1 to match the image_order length, bypassing validation
      mockPrisma.albumImage.count.mockResolvedValue(1);
      // updateMany will be called but we don't check if it actually matched any rows in the tool
      mockPrisma.albumImage.updateMany.mockResolvedValue({ count: 0 });

      const handler = registry.handlers.get("album_images_reorder")!;
      const result = await handler({
        album_id: "album-1",
        image_order: ["invalid-img-id"],
      });

      expect(getText(result)).toContain("Images Reordered");
      expect(getText(result)).toContain("Successfully reordered 1 image(s)");
      // The tool doesn't verify if the images actually exist in the album
    });
  });
});
