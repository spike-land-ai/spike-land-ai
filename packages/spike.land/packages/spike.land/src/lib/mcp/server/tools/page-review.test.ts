import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  dynamicPage: { findFirst: vi.fn() },
  toolInvocation: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerPageReviewTools } from "./page-review";

function makePage(overrides: Record<string, unknown> = {}) {
  return {
    id: "page-1",
    slug: "about",
    title: "About Us",
    description: "Learn about our company",
    status: "PUBLISHED",
    layout: "default",
    seoTitle: null as string | null,
    seoDescription: null as string | null,
    tags: [] as string[],
    customCss: null as string | null,
    viewCount: 42,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-06-15"),
    blocks: [] as Array<
      { blockType: string; content: unknown; sortOrder: number; }
    >,
    ...overrides,
  };
}

describe("page review tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerPageReviewTools(registry, "user-123");
    mockPrisma.toolInvocation.create.mockResolvedValue({});
  });

  afterEach(() => vi.unstubAllEnvs());

  it("registers 1 tool", () => {
    expect(registry.register).toHaveBeenCalledTimes(1);
    expect(registry.handlers.has("page_review")).toBe(true);
  });

  describe("page_review", () => {
    const handler = () => registry.handlers.get("page_review")!;

    describe("general review (default)", () => {
      it("returns general review for an existing page", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            blocks: [
              {
                blockType: "text",
                content: "<p>We build great things.</p>",
                sortOrder: 0,
              },
            ],
          }),
        );

        const result = await handler()({ route: "/about" });
        const text = getText(result);

        expect(text).toContain("General Review");
        expect(text).toContain("/about");
        expect(text).toContain("About Us");
        expect(text).toContain("Yes"); // status = PUBLISHED
        expect(text).toContain("Word Count");
        expect(text).toContain("42"); // viewCount
        expect(mockPrisma.dynamicPage.findFirst).toHaveBeenCalledWith({
          where: { slug: "about" },
          include: {
            blocks: {
              select: { blockType: true, content: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        });
      });

      it("shows tags when present", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            tags: ["nextjs", "react", "typescript"],
            blocks: [
              { blockType: "text", content: "<p>Content</p>", sortOrder: 0 },
            ],
          }),
        );

        const result = await handler()({ route: "/about" });
        const text = getText(result);

        expect(text).toContain("nextjs, react, typescript");
      });

      it("shows draft status correctly", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            slug: "draft-page",
            title: "Draft",
            description: null,
            status: "DRAFT",
            viewCount: 0,
          }),
        );

        const result = await handler()({ route: "/draft-page" });
        const text = getText(result);

        expect(text).toContain("No"); // DRAFT → Published: No
        expect(text).toContain("(none)"); // no description
        expect(text).toContain("DRAFT");
      });
    });

    describe("page not found (static route analysis)", () => {
      it("returns static route analysis when page not in DB", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(null);

        const result = await handler()({ route: "/blog/my-post" });
        const text = getText(result);

        expect(text).toContain("Route Analysis");
        expect(text).toContain("static/built-in route");
        expect(text).toContain("/blog");
        expect(text).toContain("Matched known prefix");
      });

      it("handles unknown route prefix", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(null);

        const result = await handler()({ route: "/unknown/path" });
        const text = getText(result);

        expect(text).toContain("Route Analysis");
        expect(text).toContain("No known route prefix matched");
      });
    });

    describe("content review type", () => {
      it("reports on title and description lengths", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            slug: "products",
            title: "Products", // 8 chars, short
            description: "Our products page", // 17 chars, short
            blocks: [
              {
                blockType: "heading",
                content: "<h1>Products</h1>",
                sortOrder: 0,
              },
              {
                blockType: "text",
                content: "<p>Some content here.</p>",
                sortOrder: 1,
              },
            ],
          }),
        );

        const result = await handler()({
          route: "/products",
          reviewType: "content",
        });
        const text = getText(result);

        expect(text).toContain("Content Review");
        expect(text).toContain("Title Analysis");
        expect(text).toContain("Short");
        expect(text).toContain("Description Analysis");
        expect(text).toContain("Block count: 2");
        expect(text).toContain("Block types:");
      });

      it("reports missing description", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            slug: "empty",
            title: "Empty Page",
            description: null,
            status: "DRAFT",
          }),
        );

        const result = await handler()({
          route: "/empty",
          reviewType: "content",
        });
        const text = getText(result);

        expect(text).toContain("Missing -- add a description");
        expect(text).toContain("SEO title: not set");
        expect(text).toContain("SEO description: not set");
      });

      it("reports good title length", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            slug: "good",
            title: "A Very Good Title That Is Exactly In The Ideal Range!!", // 55 chars
            description: "A".repeat(155), // 155 chars, good
            blocks: [
              { blockType: "text", content: "<p>Hello</p>", sortOrder: 0 },
            ],
          }),
        );

        const result = await handler()({
          route: "/good",
          reviewType: "content",
        });
        const text = getText(result);

        expect(text).toContain("Good");
      });

      it("reports long title and long description", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            slug: "long-meta",
            title: "A".repeat(65), // > 60, long
            description: "B".repeat(165), // > 160, long
            blocks: [],
          }),
        );

        const result = await handler()({
          route: "/long-meta",
          reviewType: "content",
        });
        const text = getText(result);

        expect(text).toContain("Long");
        expect(text).toContain("65 chars");
        expect(text).toContain("165 chars");
      });

      it("handles object content in blocks via extractBlockContent", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            slug: "obj-content",
            title: "Object Content Test",
            blocks: [
              {
                blockType: "json",
                content: { headline: "Hello World" },
                sortOrder: 0,
              },
              { blockType: "text", content: null, sortOrder: 1 },
            ],
          }),
        );

        const result = await handler()({
          route: "/obj-content",
          reviewType: "content",
        });
        const text = getText(result);
        expect(text).toContain("Content Review");
      });

      it("includes SEO info when set", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            slug: "seo-page",
            seoTitle: "Custom SEO Title",
            seoDescription: "A custom meta description for search engines",
          }),
        );

        const result = await handler()({
          route: "/seo-page",
          reviewType: "content",
        });
        const text = getText(result);

        expect(text).toContain("SEO title: 16 chars");
        expect(text).toContain("SEO description: 44 chars");
      });
    });

    describe("accessibility review type", () => {
      it("detects images missing alt text", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            slug: "gallery-page",
            title: "Gallery",
            blocks: [
              {
                type: "html",
                content: "<img src=\"a.jpg\" alt=\"Photo A\"><img src=\"b.jpg\"><p>Text</p>",
                order: 0,
              },
            ],
          }),
        );

        const result = await handler()({
          route: "/gallery-page",
          reviewType: "accessibility",
        });
        const text = getText(result);

        expect(text).toContain("Accessibility Review");
        expect(text).toContain("Images found: 2");
        expect(text).toContain("Images with alt text: 1");
        expect(text).toContain("Add descriptive alt text");
      });

      it("reports clean accessibility for well-structured content", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            slug: "clean-page",
            title: "Clean Page",
            blocks: [
              {
                type: "html",
                content: "<img src=\"x.jpg\" alt=\"Description\">",
                order: 0,
              },
            ],
          }),
        );

        const result = await handler()({
          route: "/clean-page",
          reviewType: "accessibility",
        });
        const text = getText(result);

        expect(text).toContain("All images have alt text");
      });

      it("includes custom CSS warning when present", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            slug: "styled-page",
            customCss: ".custom { color: red; }",
            blocks: [],
          }),
        );

        const result = await handler()({
          route: "/styled-page",
          reviewType: "accessibility",
        });
        const text = getText(result);

        expect(text).toContain("Custom CSS detected");
        expect(text).toContain("screen reader");
      });

      it("includes semantic HTML suggestions", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({ slug: "basic", blocks: [] }),
        );

        const result = await handler()({
          route: "/basic",
          reviewType: "accessibility",
        });
        const text = getText(result);

        expect(text).toContain("focus indicators");
        expect(text).toContain("landmark roles");
        expect(text).toContain("skip-to-content");
      });
    });

    describe("performance review type", () => {
      it("reports content size and image count", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            slug: "perf-page",
            title: "Performance Test",
            blocks: [
              {
                type: "html",
                content: "<p>Some content</p><img src=\"a.jpg\"><img src=\"b.jpg\">",
                order: 0,
              },
            ],
          }),
        );

        const result = await handler()({
          route: "/perf-page",
          reviewType: "performance",
        });
        const text = getText(result);

        expect(text).toContain("Performance Review");
        expect(text).toContain("Estimated content size");
        expect(text).toContain("KB");
        expect(text).toContain("Image count: 2");
      });

      it("suggests lazy loading for many images", async () => {
        const manyImages = Array.from(
          { length: 12 },
          (_, i) => `<img src="img-${i}.jpg">`,
        ).join("");
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            slug: "many-images",
            title: "Many Images",
            blocks: [{ blockType: "html", content: manyImages, sortOrder: 0 }],
          }),
        );

        const result = await handler()({
          route: "/many-images",
          reviewType: "performance",
        });
        const text = getText(result);

        expect(text).toContain("lazy loading");
        expect(text).toContain("Image count: 12");
      });

      it("suggests pagination for many blocks", async () => {
        const manyBlocks = Array.from({ length: 25 }, (_, i) => ({
          blockType: "text",
          content: `<p>Block ${i}</p>`,
          sortOrder: i,
        }));
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            slug: "many-blocks",
            title: "Many Blocks",
            blocks: manyBlocks,
          }),
        );

        const result = await handler()({
          route: "/many-blocks",
          reviewType: "performance",
        });
        const text = getText(result);

        expect(text).toContain("Many blocks");
        expect(text).toContain("Block count: 25");
      });

      it("suggests lazy loading or pagination for large content (>100KB)", async () => {
        const hugeContent = "<p>" + "x".repeat(110_000) + "</p>";
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            slug: "huge-page",
            title: "Huge Page",
            blocks: [{ blockType: "text", content: hugeContent, sortOrder: 0 }],
          }),
        );

        const result = await handler()({
          route: "/huge-page",
          reviewType: "performance",
        });
        const text = getText(result);

        expect(text).toContain("exceeds 100KB");
      });

      it("reports no concerns for small content with no images", async () => {
        mockPrisma.dynamicPage.findFirst.mockResolvedValue(
          makePage({
            slug: "minimal",
            title: "Minimal",
            blocks: [{
              blockType: "text",
              content: "<p>Just text.</p>",
              sortOrder: 0,
            }],
          }),
        );

        const result = await handler()({
          route: "/minimal",
          reviewType: "performance",
        });
        const text = getText(result);

        expect(text).toContain("No major performance concerns");
      });
    });
  });
});
