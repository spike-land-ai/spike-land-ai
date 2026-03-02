import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentHubTools } from "./tools";
import { createMockContext, createMockRegistry } from "../shared/test-utils";

/* ── Mocks ────────────────────────────────────────────────────────────── */

const mockBlogPost = {
  id: "post-1",
  title: "Test Post",
  content: "# Hello",
  slug: "test-post",
  tags: ["test"],
  category: "tech",
  status: "draft",
  userId: "test-user-id",
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-02"),
  publishedAt: null,
  scheduledAt: null,
};

vi.mock("@/lib/prisma", () => ({
  default: {
    blogPost: {
      create: vi.fn().mockResolvedValue({
        id: "post-1",
        title: "Test Post",
        content: "# Hello",
        tags: ["test"],
        category: "tech",
        status: "draft",
        userId: "test-user-id",
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-02"),
      }),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({
        id: "post-1",
        title: "Updated",
        content: "# Updated",
        tags: ["test"],
        category: "tech",
        status: "published",
        slug: "test-post",
        userId: "test-user-id",
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-02"),
        publishedAt: new Date("2025-01-02"),
      }),
    },
    pageView: {
      count: vi.fn().mockResolvedValue(100),
      aggregate: vi.fn().mockResolvedValue({
        _avg: { timeOnPage: 45 },
        _count: { timeOnPage: 80 },
      }),
      groupBy: vi.fn().mockResolvedValue([
        { sessionId: "s1", _count: { sessionId: 3 } },
        { sessionId: "s2", _count: { sessionId: 1 } },
      ]),
    },
  },
}));

vi.mock("@/lib/blog/get-posts", () => ({
  getAllPosts: vi.fn().mockReturnValue([
    {
      slug: "hello-world",
      content: "# Hello World",
      readingTime: "3 min",
      frontmatter: {
        title: "Hello World",
        description: "A test post",
        category: "tech",
        tags: ["test"],
        date: "2025-01-01",
        featured: false,
        author: "Test Author",
      },
    },
  ]),
  getPostsByCategory: vi.fn().mockReturnValue([]),
  getPostsByTag: vi.fn().mockReturnValue([]),
  getFeaturedPosts: vi.fn().mockReturnValue([]),
  getPostBySlug: vi.fn().mockImplementation((slug: string) => {
    if (slug === "hello-world") {
      return {
        slug: "hello-world",
        content: "# Hello World",
        readingTime: "3 min",
        frontmatter: {
          title: "Hello World",
          description: "A test post",
          category: "tech",
          tags: ["test"],
          date: "2025-01-01",
          featured: false,
          author: "Test Author",
        },
      };
    }
    return null;
  }),
}));

/* ── Tests ────────────────────────────────────────────────────────────── */

describe("content-hub tools", () => {
  const registry = createMockRegistry(contentHubTools);
  const ctx = createMockContext();

  it("exports 8 tools", () => {
    expect(contentHubTools).toHaveLength(8);
  });

  it("has correct tool names", () => {
    const names = registry.getToolNames();
    expect(names).toContain("blog_list_posts");
    expect(names).toContain("blog_get_post");
    expect(names).toContain("blog_create_draft");
    expect(names).toContain("blog_update_post");
    expect(names).toContain("blog_publish_post");
    expect(names).toContain("blog_get_analytics");
    expect(names).toContain("blog_schedule_post");
    expect(names).toContain("blog_revert_to_draft");
  });

  it("has blog and blog-management categories", () => {
    const blogTools = registry.getToolsByCategory("blog");
    const mgmtTools = registry.getToolsByCategory("blog-management");
    expect(blogTools).toHaveLength(2);
    expect(mgmtTools).toHaveLength(6);
  });

  describe("blog_list_posts", () => {
    it("lists all posts", async () => {
      const result = await registry.call("blog_list_posts", {}, ctx);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Blog Posts");
      expect(text).toContain("Hello World");
    });

    it("returns empty message when no posts found", async () => {
      const result = await registry.call("blog_list_posts", { category: "nonexistent" }, ctx);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("No blog posts found");
    });
  });

  describe("blog_get_post", () => {
    it("returns post by slug", async () => {
      const result = await registry.call("blog_get_post", { slug: "hello-world" }, ctx);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Hello World");
      expect(text).toContain("Test Author");
    });

    it("returns NOT_FOUND for missing slug", async () => {
      const result = await registry.call("blog_get_post", { slug: "nonexistent" }, ctx);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("NOT_FOUND");
    });
  });

  describe("blog_create_draft", () => {
    it("creates a draft post", async () => {
      const result = await registry.call(
        "blog_create_draft",
        { title: "Test Post", content: "# Hello" },
        ctx,
      );
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Draft Created");
      expect(text).toContain("post-1");
    });
  });

  describe("blog_update_post", () => {
    beforeEach(async () => {
      const prisma = (await import("@/lib/prisma")).default;
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValue(mockBlogPost as never);
    });

    it("returns NOT_FOUND for missing post", async () => {
      const prisma = (await import("@/lib/prisma")).default;
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null as never);
      const result = await registry.call(
        "blog_update_post",
        { post_id: "missing", title: "Updated" },
        ctx,
      );
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("NOT_FOUND");
    });

    it("returns PERMISSION_DENIED for wrong user", async () => {
      const prisma = (await import("@/lib/prisma")).default;
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce({
        ...mockBlogPost,
        userId: "other-user",
      } as never);
      const result = await registry.call(
        "blog_update_post",
        { post_id: "post-1", title: "Updated" },
        ctx,
      );
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("PERMISSION_DENIED");
    });

    it("returns no-changes message when no fields provided", async () => {
      const result = await registry.call("blog_update_post", { post_id: "post-1" }, ctx);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("No changes specified");
    });
  });

  describe("blog_publish_post", () => {
    it("returns NOT_FOUND for missing post", async () => {
      const prisma = (await import("@/lib/prisma")).default;
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null as never);
      const result = await registry.call("blog_publish_post", { post_id: "missing" }, ctx);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("NOT_FOUND");
    });

    it("returns INVALID_STATE for already published post", async () => {
      const prisma = (await import("@/lib/prisma")).default;
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce({
        ...mockBlogPost,
        status: "published",
      } as never);
      const result = await registry.call("blog_publish_post", { post_id: "post-1" }, ctx);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("INVALID_STATE");
    });
  });

  describe("blog_revert_to_draft", () => {
    it("returns INVALID_STATE for already draft post", async () => {
      const prisma = (await import("@/lib/prisma")).default;
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(mockBlogPost as never);
      const result = await registry.call("blog_revert_to_draft", { post_id: "post-1" }, ctx);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("INVALID_STATE");
    });
  });
});
