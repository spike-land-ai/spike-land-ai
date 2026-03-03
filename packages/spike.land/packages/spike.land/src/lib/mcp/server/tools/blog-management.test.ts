import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  blogPost: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  pageView: {
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerBlogManagementTools } from "./blog-management";

describe("blog-management tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerBlogManagementTools(registry, userId);
  });

  it("should register 6 blog-management tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(6);
  });

  // ─── blog_create_draft ──────────────────────────────────────────────

  describe("blog_create_draft", () => {
    it("should create a draft post with all fields", async () => {
      const now = new Date("2025-06-01T10:00:00Z");
      mockPrisma.blogPost.create.mockResolvedValue({
        id: "post-abc",
        title: "My First Post",
        content: "Hello world!",
        tags: ["intro", "news"],
        category: "engineering",
        status: "draft",
        userId,
        createdAt: now,
      });

      const handler = registry.handlers.get("blog_create_draft")!;
      const result = await handler({
        title: "My First Post",
        content: "Hello world!",
        tags: ["intro", "news"],
        category: "engineering",
      });

      expect(getText(result)).toContain("Draft Created!");
      expect(getText(result)).toContain("post-abc");
      expect(getText(result)).toContain("My First Post");
      expect(getText(result)).toContain("draft");
      expect(getText(result)).toContain("intro, news");
      expect(getText(result)).toContain("engineering");
      expect(mockPrisma.blogPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "My First Post",
            status: "draft",
            userId,
            tags: ["intro", "news"],
            category: "engineering",
          }),
        }),
      );
    });

    it("should create a draft with minimal fields (no tags or category)", async () => {
      mockPrisma.blogPost.create.mockResolvedValue({
        id: "post-min",
        title: "Minimal",
        content: "Content here.",
        tags: [],
        category: null,
        status: "draft",
        userId,
        createdAt: new Date(),
      });

      const handler = registry.handlers.get("blog_create_draft")!;
      const result = await handler({ title: "Minimal", content: "Content here." });

      expect(getText(result)).toContain("Draft Created!");
      expect(getText(result)).toContain("post-min");
      expect(getText(result)).toContain("none"); // tags: none
      expect(mockPrisma.blogPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tags: [], category: null }),
        }),
      );
    });
  });

  // ─── blog_update_post ───────────────────────────────────────────────

  describe("blog_update_post", () => {
    it("should update post title and tags", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "post-abc",
        userId,
        status: "draft",
      });
      mockPrisma.blogPost.update.mockResolvedValue({
        id: "post-abc",
        title: "Updated Title",
        status: "draft",
        tags: ["updated"],
        category: "tech",
        updatedAt: new Date("2025-06-02T11:00:00Z"),
      });

      const handler = registry.handlers.get("blog_update_post")!;
      const result = await handler({
        post_id: "post-abc",
        title: "Updated Title",
        tags: ["updated"],
      });

      expect(getText(result)).toContain("Post Updated");
      expect(getText(result)).toContain("Updated Title");
      expect(getText(result)).toContain("updated");
      expect(mockPrisma.blogPost.update).toHaveBeenCalledWith({
        where: { id: "post-abc" },
        data: { title: "Updated Title", tags: ["updated"] },
      });
    });

    it("should revert a published post to draft", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "p1",
        userId,
        status: "published",
      });
      mockPrisma.blogPost.update.mockResolvedValue({
        id: "p1",
        status: "draft",
        title: "Title",
        tags: [],
        category: null,
        updatedAt: new Date(),
      });

      const handler = registry.handlers.get("blog_update_post")!;
      const result = await handler({ post_id: "p1", status: "draft" });

      const text = getText(result);
      expect(text).toContain("Post Updated");
      expect(text).toContain("Status:** draft");
      expect(mockPrisma.blogPost.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: expect.objectContaining({ status: "draft", scheduledAt: null }),
      });
    });

    it("should return NOT_FOUND when post does not exist", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("blog_update_post")!;
      const result = await handler({ post_id: "nope", title: "New title" });

      expect(getText(result)).toContain("NOT_FOUND");
      expect(mockPrisma.blogPost.update).not.toHaveBeenCalled();
    });

    it("should return PERMISSION_DENIED when post belongs to another user", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "post-other",
        userId: "other-user-999",
        status: "draft",
      });

      const handler = registry.handlers.get("blog_update_post")!;
      const result = await handler({ post_id: "post-other", title: "Hijack" });

      expect(getText(result)).toContain("PERMISSION_DENIED");
      expect(mockPrisma.blogPost.update).not.toHaveBeenCalled();
    });

    it("should return no-changes message when no fields provided", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "post-abc",
        userId,
        status: "draft",
      });

      const handler = registry.handlers.get("blog_update_post")!;
      const result = await handler({ post_id: "post-abc" });

      expect(getText(result)).toContain("No changes specified");
      expect(mockPrisma.blogPost.update).not.toHaveBeenCalled();
    });
  });

  // ─── blog_publish_post ──────────────────────────────────────────────

  describe("blog_publish_post", () => {
    it("should publish a draft post", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "post-abc",
        userId,
        status: "draft",
        slug: "my-first-post",
      });
      mockPrisma.blogPost.update.mockResolvedValue({
        id: "post-abc",
        title: "My First Post",
        status: "published",
        slug: "my-first-post",
        publishedAt: new Date("2025-06-03T12:00:00Z"),
      });

      const handler = registry.handlers.get("blog_publish_post")!;
      const result = await handler({ post_id: "post-abc" });

      expect(getText(result)).toContain("Post Published!");
      expect(getText(result)).toContain("post-abc");
      expect(getText(result)).toContain("https://spike.land/blog/my-first-post");
      expect(mockPrisma.blogPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "post-abc" },
          data: expect.objectContaining({ status: "published" }),
        }),
      );
    });

    it("should publish a scheduled post", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "p1",
        userId,
        status: "scheduled",
      });
      mockPrisma.blogPost.update.mockResolvedValue({
        id: "p1",
        status: "published",
        slug: "post-1",
      });

      const handler = registry.handlers.get("blog_publish_post")!;
      const result = await handler({ post_id: "p1" });

      const text = getText(result);
      expect(text).toContain("Post Published!");
      expect(mockPrisma.blogPost.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: expect.objectContaining({ status: "published" }),
      });
    });

    it("should return INVALID_STATE when post is already published", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "post-abc",
        userId,
        status: "published",
      });

      const handler = registry.handlers.get("blog_publish_post")!;
      const result = await handler({ post_id: "post-abc" });

      expect(getText(result)).toContain("INVALID_STATE");
      expect(getText(result)).toContain("published");
      expect(mockPrisma.blogPost.update).not.toHaveBeenCalled();
    });

    it("should return NOT_FOUND for missing post", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("blog_publish_post")!;
      const result = await handler({ post_id: "ghost" });

      expect(getText(result)).toContain("NOT_FOUND");
      expect(mockPrisma.blogPost.update).not.toHaveBeenCalled();
    });

    it("should return PERMISSION_DENIED for another user's post", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "post-abc",
        userId: "other-user",
        status: "draft",
      });

      const handler = registry.handlers.get("blog_publish_post")!;
      const result = await handler({ post_id: "post-abc" });

      expect(getText(result)).toContain("PERMISSION_DENIED");
      expect(mockPrisma.blogPost.update).not.toHaveBeenCalled();
    });
  });

  // ─── blog_get_analytics ─────────────────────────────────────────────

  describe("blog_get_analytics", () => {
    it("should return analytics for owned post", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "post-abc",
        title: "My First Post",
        userId,
        slug: "my-first-post",
      });
      mockPrisma.pageView.count.mockResolvedValue(450);
      mockPrisma.pageView.aggregate.mockResolvedValue({
        _avg: { timeOnPage: 127 },
        _count: { timeOnPage: 380 },
      });
      mockPrisma.pageView.groupBy.mockResolvedValue([
        { sessionId: "s1", _count: { sessionId: 1 } },
        { sessionId: "s2", _count: { sessionId: 3 } },
        { sessionId: "s3", _count: { sessionId: 1 } },
      ]);

      const handler = registry.handlers.get("blog_get_analytics")!;
      const result = await handler({ post_id: "post-abc", period: "30d" });

      expect(getText(result)).toContain("Analytics:");
      expect(getText(result)).toContain("My First Post");
      expect(getText(result)).toContain("30d");
      expect(getText(result)).toContain("450"); // total views
      expect(getText(result)).toContain("3"); // unique visitors
      expect(getText(result)).toContain("127s"); // avg read time
      expect(getText(result)).toContain("%"); // bounce rate
    });

    it("should return analytics for 'all' period without date filter", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "post-abc",
        title: "My Post",
        userId,
        slug: "my-post",
      });
      mockPrisma.pageView.count.mockResolvedValue(1200);
      mockPrisma.pageView.aggregate.mockResolvedValue({
        _avg: { timeOnPage: null },
        _count: { timeOnPage: 0 },
      });
      mockPrisma.pageView.groupBy.mockResolvedValue([]);

      const handler = registry.handlers.get("blog_get_analytics")!;
      const result = await handler({ post_id: "post-abc", period: "all" });

      expect(getText(result)).toContain("all");
      expect(getText(result)).toContain("1200");
      expect(getText(result)).toContain("0s"); // no time-on-page data
    });

    it("should return NOT_FOUND for missing post", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("blog_get_analytics")!;
      const result = await handler({ post_id: "ghost" });

      expect(getText(result)).toContain("NOT_FOUND");
      expect(mockPrisma.pageView.count).not.toHaveBeenCalled();
    });

    it("should return PERMISSION_DENIED for another user's post", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "post-abc",
        title: "Stolen",
        userId: "other-user",
        slug: "stolen",
      });

      const handler = registry.handlers.get("blog_get_analytics")!;
      const result = await handler({ post_id: "post-abc" });

      expect(getText(result)).toContain("PERMISSION_DENIED");
      expect(mockPrisma.pageView.count).not.toHaveBeenCalled();
    });
  });

  // ─── blog_schedule_post ─────────────────────────────────────────────

  describe("blog_schedule_post", () => {
    it("should schedule a draft post for a future date", async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const futureDateISO = futureDate.toISOString();

      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "post-abc",
        userId,
        status: "draft",
      });
      mockPrisma.blogPost.update.mockResolvedValue({
        id: "post-abc",
        title: "Coming Soon",
        status: "scheduled",
        scheduledAt: futureDate,
      });

      const handler = registry.handlers.get("blog_schedule_post")!;
      const result = await handler({
        post_id: "post-abc",
        publish_at: futureDateISO,
      });

      expect(getText(result)).toContain("Post Scheduled!");
      expect(getText(result)).toContain("post-abc");
      expect(getText(result)).toContain("scheduled");
      expect(mockPrisma.blogPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "post-abc" },
          data: expect.objectContaining({ status: "scheduled" }),
        }),
      );
    });

    it("should return VALIDATION_ERROR for a past date", async () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();

      const handler = registry.handlers.get("blog_schedule_post")!;
      const result = await handler({
        post_id: "post-abc",
        publish_at: pastDate,
      });

      expect(getText(result)).toContain("VALIDATION_ERROR");
      expect(getText(result)).toContain("future");
      expect(mockPrisma.blogPost.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.blogPost.update).not.toHaveBeenCalled();
    });

    it("should return VALIDATION_ERROR for an invalid datetime string", async () => {
      const handler = registry.handlers.get("blog_schedule_post")!;
      const result = await handler({
        post_id: "post-abc",
        publish_at: "not-a-date",
      });

      expect(getText(result)).toContain("VALIDATION_ERROR");
      expect(getText(result)).toContain("ISO 8601");
      expect(mockPrisma.blogPost.update).not.toHaveBeenCalled();
    });

    it("should return NOT_FOUND when post does not exist", async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();
      mockPrisma.blogPost.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("blog_schedule_post")!;
      const result = await handler({
        post_id: "ghost",
        publish_at: futureDate,
      });

      expect(getText(result)).toContain("NOT_FOUND");
      expect(mockPrisma.blogPost.update).not.toHaveBeenCalled();
    });

    it("should return PERMISSION_DENIED for another user's post", async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "post-abc",
        userId: "other-user",
        status: "draft",
      });

      const handler = registry.handlers.get("blog_schedule_post")!;
      const result = await handler({
        post_id: "post-abc",
        publish_at: futureDate,
      });

      expect(getText(result)).toContain("PERMISSION_DENIED");
      expect(mockPrisma.blogPost.update).not.toHaveBeenCalled();
    });

    it("should return INVALID_STATE when post is already scheduled", async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "post-abc",
        userId,
        status: "scheduled",
      });

      const handler = registry.handlers.get("blog_schedule_post")!;
      const result = await handler({
        post_id: "post-abc",
        publish_at: futureDate,
      });

      expect(getText(result)).toContain("INVALID_STATE");
      expect(getText(result)).toContain("scheduled");
      expect(mockPrisma.blogPost.update).not.toHaveBeenCalled();
    });
  });

  // ─── blog_revert_to_draft ───────────────────────────────────────────

  describe("blog_revert_to_draft", () => {
    it("should revert a scheduled post to draft", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "post-abc",
        userId,
        status: "scheduled",
      });
      mockPrisma.blogPost.update.mockResolvedValue({
        id: "post-abc",
        title: "My Scheduled Post",
        status: "draft",
      });

      const handler = registry.handlers.get("blog_revert_to_draft")!;
      const result = await handler({ post_id: "post-abc" });

      const text = getText(result);
      expect(text).toContain("Post Reverted to Draft");
      expect(text).toContain("post-abc");
      expect(text).toContain("Previous Status:** scheduled");
      expect(text).toContain("Status:** draft");
      expect(mockPrisma.blogPost.update).toHaveBeenCalledWith({
        where: { id: "post-abc" },
        data: { status: "draft", scheduledAt: null, publishedAt: null },
      });
    });

    it("should revert a published post to draft", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "p1",
        userId,
        status: "published",
      });
      mockPrisma.blogPost.update.mockResolvedValue({
        id: "p1",
        title: "Published Post",
        status: "draft",
      });

      const handler = registry.handlers.get("blog_revert_to_draft")!;
      const result = await handler({ post_id: "p1" });

      const text = getText(result);
      expect(text).toContain("Post Reverted to Draft");
      expect(text).toContain("Previous Status:** published");
      expect(mockPrisma.blogPost.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { status: "draft", scheduledAt: null, publishedAt: null },
      });
    });

    it("should return INVALID_STATE when post is already a draft", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "post-abc",
        userId,
        status: "draft",
      });

      const handler = registry.handlers.get("blog_revert_to_draft")!;
      const result = await handler({ post_id: "post-abc" });

      expect(getText(result)).toContain("INVALID_STATE");
      expect(getText(result)).toContain("already a draft");
      expect(mockPrisma.blogPost.update).not.toHaveBeenCalled();
    });

    it("should return NOT_FOUND for missing post", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("blog_revert_to_draft")!;
      const result = await handler({ post_id: "ghost" });

      expect(getText(result)).toContain("NOT_FOUND");
      expect(mockPrisma.blogPost.update).not.toHaveBeenCalled();
    });

    it("should return PERMISSION_DENIED for another user's post", async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: "post-abc",
        userId: "other-user",
        status: "scheduled",
      });

      const handler = registry.handlers.get("blog_revert_to_draft")!;
      const result = await handler({ post_id: "post-abc" });

      expect(getText(result)).toContain("PERMISSION_DENIED");
      expect(mockPrisma.blogPost.update).not.toHaveBeenCalled();
    });
  });
});
