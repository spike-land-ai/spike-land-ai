import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  dynamicPage: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  pageVersion: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

const mockIsReservedSlug = vi.fn();
vi.mock("@/lib/dynamic-pages/block-schemas", () => ({
  isReservedSlug: (...args: unknown[]) => mockIsReservedSlug(...args),
  RESERVED_SLUGS: ["store", "admin", "api", "auth"],
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerPagesTools } from "./pages";

const now = new Date("2025-01-15T12:00:00Z");

describe("pages tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerPagesTools(registry, userId);
  });

  it("should register 7 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(7);
    expect(registry.handlers.has("pages_create")).toBe(true);
    expect(registry.handlers.has("pages_get")).toBe(true);
    expect(registry.handlers.has("pages_list")).toBe(true);
    expect(registry.handlers.has("pages_update")).toBe(true);
    expect(registry.handlers.has("pages_delete")).toBe(true);
    expect(registry.handlers.has("pages_publish")).toBe(true);
    expect(registry.handlers.has("pages_clone")).toBe(true);
  });

  // ── pages_create ──────────────────────────────────────────────────────────

  describe("pages_create", () => {
    it("should create a page successfully", async () => {
      mockIsReservedSlug.mockReturnValue(false);
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(null);
      mockPrisma.dynamicPage.create.mockResolvedValue({
        id: "page-1",
        slug: "my-page",
        title: "My Page",
        layout: "LANDING",
        status: "DRAFT",
        createdAt: now,
      });

      const handler = registry.handlers.get("pages_create")!;
      const result = await handler({
        slug: "my-page",
        title: "My Page",
      });

      const text = getText(result);
      expect(text).toContain("Page Created");
      expect(text).toContain("page-1");
      expect(text).toContain("my-page");
      expect(text).toContain("My Page");
      expect(text).toContain("LANDING");
      expect(text).toContain("DRAFT");
      expect(mockPrisma.dynamicPage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: "my-page",
            title: "My Page",
            userId,
          }),
        }),
      );
    });

    it("should reject reserved slugs", async () => {
      mockIsReservedSlug.mockReturnValue(true);

      const handler = registry.handlers.get("pages_create")!;
      const result = await handler({
        slug: "store",
        title: "Store Page",
      });

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("reserved");
      expect(mockPrisma.dynamicPage.create).not.toHaveBeenCalled();
    });

    it("should reject duplicate slugs", async () => {
      mockIsReservedSlug.mockReturnValue(false);
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({ id: "existing" });

      const handler = registry.handlers.get("pages_create")!;
      const result = await handler({
        slug: "taken-slug",
        title: "Duplicate Page",
      });

      const text = getText(result);
      expect(text).toContain("CONFLICT");
      expect(text).toContain("already exists");
      expect(mockPrisma.dynamicPage.create).not.toHaveBeenCalled();
    });

    it("should create a page with all optional fields", async () => {
      mockIsReservedSlug.mockReturnValue(false);
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(null);
      mockPrisma.dynamicPage.create.mockResolvedValue({
        id: "page-full",
        slug: "full-page",
        title: "Full Page",
        layout: "GALLERY",
        status: "DRAFT",
        createdAt: now,
      });

      const handler = registry.handlers.get("pages_create")!;
      await handler({
        slug: "full-page",
        title: "Full Page",
        description: "Full desc",
        layout: "GALLERY",
        themeData: { dark: true },
        tags: ["a", "b"],
        customCss: ".body { color: red; }",
      });

      expect(mockPrisma.dynamicPage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: "Full desc",
            layout: "GALLERY",
            themeData: { dark: true },
            tags: ["a", "b"],
            customCss: ".body { color: red; }",
          }),
        }),
      );
    });
  });

  // ── pages_get ─────────────────────────────────────────────────────────────

  describe("pages_get", () => {
    const fullPage = {
      id: "page-1",
      slug: "my-page",
      title: "My Page",
      layout: "LANDING",
      status: "PUBLISHED",
      description: "A test page",
      tags: ["test", "demo"],
      viewCount: 42,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
      blocks: [
        {
          sortOrder: 0,
          blockType: "HERO",
          variant: null,
          isVisible: true,
        },
        {
          sortOrder: 1,
          blockType: "CTA",
          variant: "centered",
          isVisible: false,
        },
      ],
    };

    it("should get a page by slug", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(fullPage);

      const handler = registry.handlers.get("pages_get")!;
      const result = await handler({ slug: "my-page" });

      const text = getText(result);
      expect(text).toContain("My Page");
      expect(text).toContain("page-1");
      expect(text).toContain("LANDING");
      expect(text).toContain("PUBLISHED");
      expect(text).toContain("A test page");
      expect(text).toContain("test, demo");
      expect(text).toContain("42");
      expect(text).toContain("Blocks:** 2");
      expect(text).toContain("HERO");
      expect(text).toContain("CTA");
      expect(text).toContain("(centered)");
      expect(text).toContain("[hidden]");
    });

    it("should get a page by id", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(fullPage);

      const handler = registry.handlers.get("pages_get")!;
      const result = await handler({ pageId: "page-1" });

      const text = getText(result);
      expect(text).toContain("My Page");
      expect(mockPrisma.dynamicPage.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "page-1" } }),
      );
    });

    it("should return NOT_FOUND when page does not exist", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("pages_get")!;
      const result = await handler({ slug: "nonexistent" });

      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should return VALIDATION_ERROR when no params provided", async () => {
      const handler = registry.handlers.get("pages_get")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("slug or pageId");
    });
  });

  // ── pages_list ────────────────────────────────────────────────────────────

  describe("pages_list", () => {
    it("should list pages successfully", async () => {
      const pages = [
        {
          id: "page-1",
          slug: "first",
          title: "First Page",
          layout: "LANDING",
          status: "PUBLISHED",
          viewCount: 10,
          publishedAt: now,
          updatedAt: now,
        },
        {
          id: "page-2",
          slug: "second",
          title: "Second Page",
          layout: "ARTICLE",
          status: "DRAFT",
          viewCount: 0,
          publishedAt: null,
          updatedAt: now,
        },
      ];
      mockPrisma.dynamicPage.findMany.mockResolvedValue(pages);
      mockPrisma.dynamicPage.count.mockResolvedValue(2);

      const handler = registry.handlers.get("pages_list")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("Pages (2 of 2)");
      expect(text).toContain("First Page");
      expect(text).toContain("Second Page");
      expect(text).toContain("LANDING");
      expect(text).toContain("ARTICLE");
    });

    it("should return empty message when no pages match", async () => {
      mockPrisma.dynamicPage.findMany.mockResolvedValue([]);
      mockPrisma.dynamicPage.count.mockResolvedValue(0);

      const handler = registry.handlers.get("pages_list")!;
      const result = await handler({ status: "ARCHIVED" });

      expect(getText(result)).toContain("No pages found");
    });

    it("should apply search filter with OR condition", async () => {
      mockPrisma.dynamicPage.findMany.mockResolvedValue([]);
      mockPrisma.dynamicPage.count.mockResolvedValue(0);

      const handler = registry.handlers.get("pages_list")!;
      await handler({ search: "hello" });

      expect(mockPrisma.dynamicPage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            OR: [
              { title: { contains: "hello", mode: "insensitive" } },
              { description: { contains: "hello", mode: "insensitive" } },
            ],
          }),
        }),
      );
    });

    it("should apply status and layout filters", async () => {
      mockPrisma.dynamicPage.findMany.mockResolvedValue([]);
      mockPrisma.dynamicPage.count.mockResolvedValue(0);

      const handler = registry.handlers.get("pages_list")!;
      await handler({ status: "PUBLISHED", layout: "STORE" });

      expect(mockPrisma.dynamicPage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            status: "PUBLISHED",
            layout: "STORE",
          }),
        }),
      );
    });

    it("should apply pagination filters", async () => {
      mockPrisma.dynamicPage.findMany.mockResolvedValue([]);
      mockPrisma.dynamicPage.count.mockResolvedValue(0);

      const handler = registry.handlers.get("pages_list")!;
      await handler({ page: 2, pageSize: 10 });

      expect(mockPrisma.dynamicPage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  // ── pages_update ──────────────────────────────────────────────────────────

  describe("pages_update", () => {
    it("should update a page and create a version snapshot", async () => {
      const currentPage = {
        id: "page-1",
        slug: "my-page",
        title: "Old Title",
        description: null,
        layout: "LANDING",
        themeData: null,
        tags: [],
        customCss: null,
        seoTitle: null,
        seoDescription: null,
        ogImageUrl: null,
      };
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(currentPage);
      mockPrisma.pageVersion.findFirst.mockResolvedValue({ version: 2 });
      mockPrisma.pageVersion.create.mockResolvedValue({});
      mockPrisma.dynamicPage.update.mockResolvedValue({
        id: "page-1",
        slug: "my-page",
        title: "New Title",
        layout: "LANDING",
        status: "DRAFT",
        updatedAt: now,
      });

      const handler = registry.handlers.get("pages_update")!;
      const result = await handler({
        pageId: "page-1",
        title: "New Title",
      });

      const text = getText(result);
      expect(text).toContain("Page Updated");
      expect(text).toContain("v3 snapshot saved");
      expect(text).toContain("New Title");
      expect(mockPrisma.pageVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pageId: "page-1",
            version: 3,
            changedBy: userId,
          }),
        }),
      );
    });

    it("should return NOT_FOUND when page does not exist", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("pages_update")!;
      const result = await handler({ pageId: "nonexistent" });

      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should include themeData, seoDescription, and ogImageUrl in update payload", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({
        id: "page-1",
        title: "Title",
        description: null,
        layout: "LANDING",
        themeData: null,
        tags: [],
        customCss: null,
        seoTitle: null,
        seoDescription: null,
        ogImageUrl: null,
      });
      mockPrisma.pageVersion.findFirst.mockResolvedValue(null);
      mockPrisma.pageVersion.create.mockResolvedValue({});
      mockPrisma.dynamicPage.update.mockResolvedValue({
        id: "page-1",
        slug: "my-page",
        title: "Title",
        layout: "LANDING",
        status: "DRAFT",
        updatedAt: now,
      });

      const handler = registry.handlers.get("pages_update")!;
      await handler({
        pageId: "page-1",
        themeData: { primary: "#ff0000" },
        seoDescription: "My SEO desc",
        ogImageUrl: "https://example.com/og.png",
      });

      expect(mockPrisma.dynamicPage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            themeData: { primary: "#ff0000" },
            seoDescription: "My SEO desc",
            ogImageUrl: "https://example.com/og.png",
          }),
        }),
      );
    });

    it("should include description, layout, tags, customCss, and seoTitle in update payload", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({
        id: "page-1",
        title: "Title",
        description: "Old desc",
        layout: "LANDING",
        themeData: null,
        tags: ["old"],
        customCss: null,
        seoTitle: null,
        seoDescription: null,
        ogImageUrl: null,
      });
      mockPrisma.pageVersion.findFirst.mockResolvedValue(null);
      mockPrisma.pageVersion.create.mockResolvedValue({});
      mockPrisma.dynamicPage.update.mockResolvedValue({
        id: "page-1",
        slug: "my-page",
        title: "Title",
        layout: "GALLERY",
        status: "DRAFT",
        updatedAt: now,
      });

      const handler = registry.handlers.get("pages_update")!;
      await handler({
        pageId: "page-1",
        description: "New desc",
        layout: "GALLERY",
        tags: ["new", "tags"],
        customCss: ".body { color: blue; }",
        seoTitle: "SEO Title",
      });

      expect(mockPrisma.dynamicPage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: "New desc",
            layout: "GALLERY",
            tags: ["new", "tags"],
            customCss: ".body { color: blue; }",
            seoTitle: "SEO Title",
          }),
        }),
      );
    });

    it("should default to version 1 when no prior versions exist", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({
        id: "page-1",
        title: "Title",
        description: null,
        layout: "LANDING",
        themeData: null,
        tags: [],
        customCss: null,
        seoTitle: null,
        seoDescription: null,
        ogImageUrl: null,
      });
      mockPrisma.pageVersion.findFirst.mockResolvedValue(null);
      mockPrisma.pageVersion.create.mockResolvedValue({});
      mockPrisma.dynamicPage.update.mockResolvedValue({
        id: "page-1",
        slug: "my-page",
        title: "Updated",
        layout: "LANDING",
        status: "DRAFT",
        updatedAt: now,
      });

      const handler = registry.handlers.get("pages_update")!;
      const result = await handler({ pageId: "page-1", title: "Updated" });

      const text = getText(result);
      expect(text).toContain("v1 snapshot saved");
      expect(mockPrisma.pageVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: 1 }),
        }),
      );
    });
  });

  // ── pages_delete ──────────────────────────────────────────────────────────

  describe("pages_delete", () => {
    it("should archive a page (soft-delete)", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({
        id: "page-1",
        slug: "my-page",
        title: "My Page",
      });
      mockPrisma.dynamicPage.update.mockResolvedValue({});

      const handler = registry.handlers.get("pages_delete")!;
      const result = await handler({ pageId: "page-1" });

      const text = getText(result);
      expect(text).toContain("Page Archived");
      expect(text).toContain("page-1");
      expect(text).toContain("my-page");
      expect(text).toContain("ARCHIVED");
      expect(mockPrisma.dynamicPage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "page-1" },
          data: { status: "ARCHIVED" },
        }),
      );
    });

    it("should return NOT_FOUND when page does not exist", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("pages_delete")!;
      const result = await handler({ pageId: "nonexistent" });

      expect(getText(result)).toContain("NOT_FOUND");
    });
  });

  // ── pages_publish ─────────────────────────────────────────────────────────

  describe("pages_publish", () => {
    it("should publish a page successfully", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({
        id: "page-1",
        slug: "my-page",
        title: "My Page",
        status: "DRAFT",
      });
      mockPrisma.dynamicPage.update.mockResolvedValue({
        id: "page-1",
        slug: "my-page",
        title: "My Page",
        status: "PUBLISHED",
        publishedAt: now,
      });

      const handler = registry.handlers.get("pages_publish")!;
      const result = await handler({ pageId: "page-1" });

      const text = getText(result);
      expect(text).toContain("Page Published");
      expect(text).toContain("PUBLISHED");
      expect(text).toContain("/p/my-page");
    });

    it("should return NOT_FOUND when page does not exist", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("pages_publish")!;
      const result = await handler({ pageId: "nonexistent" });

      expect(getText(result)).toContain("NOT_FOUND");
    });
  });

  // ── pages_clone ───────────────────────────────────────────────────────────

  describe("pages_clone", () => {
    it("should clone a page with all its blocks", async () => {
      mockIsReservedSlug.mockReturnValue(false);
      // First findUnique: check slug uniqueness (returns null = available)
      // Second findUnique: fetch source page
      mockPrisma.dynamicPage.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "source-1",
          slug: "original",
          title: "Original Page",
          description: "Desc",
          layout: "LANDING",
          status: "PUBLISHED",
          themeData: { color: "blue" },
          tags: ["tag1"],
          customCss: null,
          seoTitle: null,
          seoDescription: null,
          ogImageUrl: null,
          blocks: [
            {
              blockType: "HERO",
              variant: null,
              content: { headline: "Hello" },
              sortOrder: 0,
              isVisible: true,
            },
          ],
        });
      mockPrisma.dynamicPage.create.mockResolvedValue({
        id: "clone-1",
        slug: "cloned-page",
        title: "Original Page",
        layout: "LANDING",
        status: "DRAFT",
        createdAt: now,
        _count: { blocks: 1 },
      });

      const handler = registry.handlers.get("pages_clone")!;
      const result = await handler({
        pageId: "source-1",
        newSlug: "cloned-page",
      });

      const text = getText(result);
      expect(text).toContain("Page Cloned");
      expect(text).toContain("source-1");
      expect(text).toContain("clone-1");
      expect(text).toContain("cloned-page");
      expect(text).toContain("Blocks Copied:** 1");
    });

    it("should reject reserved slugs for clone", async () => {
      mockIsReservedSlug.mockReturnValue(true);

      const handler = registry.handlers.get("pages_clone")!;
      const result = await handler({
        pageId: "source-1",
        newSlug: "admin",
      });

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("reserved");
    });

    it("should reject duplicate slugs for clone", async () => {
      mockIsReservedSlug.mockReturnValue(false);
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({ id: "existing" });

      const handler = registry.handlers.get("pages_clone")!;
      const result = await handler({
        pageId: "source-1",
        newSlug: "taken-slug",
      });

      const text = getText(result);
      expect(text).toContain("CONFLICT");
      expect(text).toContain("already exists");
    });

    it("should return NOT_FOUND when source page does not exist", async () => {
      mockIsReservedSlug.mockReturnValue(false);
      mockPrisma.dynamicPage.findUnique
        .mockResolvedValueOnce(null) // slug check
        .mockResolvedValueOnce(null); // source lookup

      const handler = registry.handlers.get("pages_clone")!;
      const result = await handler({
        pageId: "nonexistent",
        newSlug: "new-page",
      });

      expect(getText(result)).toContain("NOT_FOUND");
      expect(getText(result)).toContain("Source page not found");
    });
  });
});
