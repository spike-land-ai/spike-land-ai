import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAllPosts = vi.fn();
const mockGetPostsByCategory = vi.fn();
const mockGetPostsByTag = vi.fn();
const mockGetFeaturedPosts = vi.fn();
const mockGetPostBySlug = vi.fn();

vi.mock("@/lib/blog/get-posts", () => ({
  getAllPosts: mockGetAllPosts,
  getPostsByCategory: mockGetPostsByCategory,
  getPostsByTag: mockGetPostsByTag,
  getFeaturedPosts: mockGetFeaturedPosts,
  getPostBySlug: mockGetPostBySlug,
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerBlogTools } from "./blog";

const samplePost = {
  slug: "hello-world",
  readingTime: "5 min read",
  frontmatter: {
    title: "Hello World",
    description: "First blog post",
    date: "2024-06-01",
    category: "engineering",
    tags: ["intro", "welcome"],
    author: "Zoltan",
    featured: false,
  },
};

const samplePostFeatured = {
  slug: "featured-post",
  readingTime: "3 min read",
  frontmatter: {
    title: "Featured Post",
    description: "A featured blog post",
    date: "2024-07-01",
    category: "product",
    tags: ["featured", "news"],
    author: "Admin",
    featured: true,
  },
};

const sampleFullPost = {
  ...samplePost,
  content: "# Hello\n\nThis is the full content of the blog post.",
};

describe("blog tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerBlogTools(registry, userId);
  });

  it("should register 2 blog tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(2);
  });

  describe("blog_list_posts", () => {
    it("should list all posts by default", async () => {
      mockGetAllPosts.mockReturnValue([samplePost, samplePostFeatured]);
      const handler = registry.handlers.get("blog_list_posts")!;
      const result = await handler({});
      expect(getText(result)).toContain("Hello World");
      expect(getText(result)).toContain("Featured Post");
      expect(getText(result)).toContain("Blog Posts (2 of 2)");
      expect(getText(result)).toContain("hello-world");
      expect(getText(result)).toContain("First blog post");
      expect(getText(result)).toContain("engineering");
      expect(getText(result)).toContain("intro, welcome");
      expect(getText(result)).toContain("5 min read");
      expect(getText(result)).toContain("2024-06-01");
    });

    it("should filter by category", async () => {
      mockGetPostsByCategory.mockReturnValue([samplePost]);
      const handler = registry.handlers.get("blog_list_posts")!;
      const result = await handler({ category: "engineering" });
      expect(getText(result)).toContain("Hello World");
      expect(mockGetPostsByCategory).toHaveBeenCalledWith("engineering");
      expect(mockGetAllPosts).not.toHaveBeenCalled();
    });

    it("should filter by tag", async () => {
      mockGetPostsByTag.mockReturnValue([samplePostFeatured]);
      const handler = registry.handlers.get("blog_list_posts")!;
      const result = await handler({ tag: "news" });
      expect(getText(result)).toContain("Featured Post");
      expect(mockGetPostsByTag).toHaveBeenCalledWith("news");
      expect(mockGetAllPosts).not.toHaveBeenCalled();
    });

    it("should filter featured posts", async () => {
      mockGetFeaturedPosts.mockReturnValue([samplePostFeatured]);
      const handler = registry.handlers.get("blog_list_posts")!;
      const result = await handler({ featured: true });
      expect(getText(result)).toContain("Featured Post");
      expect(getText(result)).toContain("Featured");
      expect(mockGetFeaturedPosts).toHaveBeenCalled();
      expect(mockGetAllPosts).not.toHaveBeenCalled();
    });

    it("should return empty message when no posts found", async () => {
      mockGetAllPosts.mockReturnValue([]);
      const handler = registry.handlers.get("blog_list_posts")!;
      const result = await handler({});
      expect(getText(result)).toContain("No blog posts found");
    });

    it("should respect limit and offset for pagination", async () => {
      const manyPosts = [samplePost, samplePostFeatured, {
        ...samplePost,
        slug: "third-post",
        frontmatter: { ...samplePost.frontmatter, title: "Third Post" },
      }];
      mockGetAllPosts.mockReturnValue(manyPosts);
      const handler = registry.handlers.get("blog_list_posts")!;
      const result = await handler({ limit: 1, offset: 1 });
      expect(getText(result)).toContain("Blog Posts (1 of 3)");
      expect(getText(result)).toContain("Featured Post");
    });

    it("should return empty if offset is beyond array length", async () => {
      mockGetAllPosts.mockReturnValue([samplePost]);
      const handler = registry.handlers.get("blog_list_posts")!;
      const result = await handler({ offset: 10 });
      expect(getText(result)).toContain("No blog posts found");
    });

    it("should show Featured marker for featured posts", async () => {
      mockGetAllPosts.mockReturnValue([samplePostFeatured]);
      const handler = registry.handlers.get("blog_list_posts")!;
      const result = await handler({});
      expect(getText(result)).toContain("| Featured");
    });

    it("should not show Featured marker for non-featured posts", async () => {
      mockGetAllPosts.mockReturnValue([samplePost]);
      const handler = registry.handlers.get("blog_list_posts")!;
      const result = await handler({});
      expect(getText(result)).not.toContain("| Featured");
    });

    it("should prioritize category over tag and featured", async () => {
      mockGetPostsByCategory.mockReturnValue([samplePost]);
      const handler = registry.handlers.get("blog_list_posts")!;
      await handler({ category: "engineering", tag: "intro", featured: true });
      expect(mockGetPostsByCategory).toHaveBeenCalledWith("engineering");
      expect(mockGetPostsByTag).not.toHaveBeenCalled();
      expect(mockGetFeaturedPosts).not.toHaveBeenCalled();
    });

    it("should prioritize tag over featured when no category", async () => {
      mockGetPostsByTag.mockReturnValue([samplePost]);
      const handler = registry.handlers.get("blog_list_posts")!;
      await handler({ tag: "intro", featured: true });
      expect(mockGetPostsByTag).toHaveBeenCalledWith("intro");
      expect(mockGetFeaturedPosts).not.toHaveBeenCalled();
    });
  });

  describe("blog_get_post", () => {
    it("should return full post details", async () => {
      mockGetPostBySlug.mockReturnValue(sampleFullPost);
      const handler = registry.handlers.get("blog_get_post")!;
      const result = await handler({ slug: "hello-world" });
      expect(getText(result)).toContain("Hello World");
      expect(getText(result)).toContain("hello-world");
      expect(getText(result)).toContain("Zoltan");
      expect(getText(result)).toContain("2024-06-01");
      expect(getText(result)).toContain("engineering");
      expect(getText(result)).toContain("intro, welcome");
      expect(getText(result)).toContain("5 min read");
      expect(getText(result)).toContain("No");
      expect(getText(result)).toContain("First blog post");
      expect(getText(result)).toContain("# Hello");
      expect(getText(result)).toContain(
        "This is the full content of the blog post.",
      );
    });

    it("should return NOT_FOUND for missing post", async () => {
      mockGetPostBySlug.mockReturnValue(null);
      const handler = registry.handlers.get("blog_get_post")!;
      const result = await handler({ slug: "nonexistent" });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should show Featured: Yes for featured posts", async () => {
      mockGetPostBySlug.mockReturnValue({
        ...samplePostFeatured,
        content: "Featured content",
      });
      const handler = registry.handlers.get("blog_get_post")!;
      const result = await handler({ slug: "featured-post" });
      expect(getText(result)).toContain("**Featured:** Yes");
    });

    it("should show Featured: No for non-featured posts", async () => {
      mockGetPostBySlug.mockReturnValue(sampleFullPost);
      const handler = registry.handlers.get("blog_get_post")!;
      const result = await handler({ slug: "hello-world" });
      expect(getText(result)).toContain("**Featured:** No");
    });
  });
});
