import { beforeEach, describe, expect, it, vi } from "vitest";

// Prisma mock — must be defined before any module imports that use @/lib/prisma
const mockPrisma = {
  dynamicPage: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerPageTemplateTools } from "./page-templates";

describe("page template tools", () => {
  const userId = "user-abc-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerPageTemplateTools(registry, userId);
  });

  // ── Registration ───────────────────────────────────────────────────────────

  it("should register exactly 4 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.handlers.has("pages_list_templates")).toBe(true);
    expect(registry.handlers.has("pages_apply_template")).toBe(true);
    expect(registry.handlers.has("pages_get_seo")).toBe(true);
    expect(registry.handlers.has("pages_set_seo")).toBe(true);
  });

  // ── pages_list_templates ───────────────────────────────────────────────────

  describe("pages_list_templates", () => {
    it("should list all templates when no category filter is provided", async () => {
      const handler = registry.handlers.get("pages_list_templates")!;
      const result = await handler({});
      const text = getText(result);
      // 9 templates in the catalogue
      expect(text).toContain("All Page Templates");
      expect(text).toContain("Hero Landing");
      expect(text).toContain("Blank Canvas");
      expect(text).toContain("Portfolio Grid");
    });

    it("should filter templates by category", async () => {
      const handler = registry.handlers.get("pages_list_templates")!;
      const result = await handler({ category: "marketing" });
      const text = getText(result);
      expect(text).toContain("Page Templates — marketing");
      expect(text).toContain("Product Page");
      expect(text).toContain("Event Landing");
      // Should NOT include landing-only templates
      expect(text).not.toContain("Portfolio Grid");
      expect(text).not.toContain("Blank Canvas");
    });

    it("should return 'blank' category with the blank template", async () => {
      const handler = registry.handlers.get("pages_list_templates")!;
      const result = await handler({ category: "blank" });
      const text = getText(result);
      expect(text).toContain("tpl-blank");
      expect(text).toContain("Blank Canvas");
      expect(text).toContain("(none)");
    });

    it("should show template IDs, layouts, and block lists", async () => {
      const handler = registry.handlers.get("pages_list_templates")!;
      const result = await handler({ category: "landing" });
      const text = getText(result);
      expect(text).toContain("tpl-landing-hero");
      expect(text).toContain("LANDING");
      expect(text).toContain("HERO");
      expect(text).toContain("CTA");
    });
  });

  // ── pages_apply_template ───────────────────────────────────────────────────

  describe("pages_apply_template", () => {
    it("should apply a valid template to an owned page", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({
        id: "page-1",
        title: "My Page",
        slug: "my-page",
        userId,
      });
      mockPrisma.dynamicPage.update.mockResolvedValue({});

      const handler = registry.handlers.get("pages_apply_template")!;
      const result = await handler({
        page_id: "page-1",
        template_id: "tpl-landing-hero",
      });

      const text = getText(result);
      expect(text).toContain("Template Applied");
      expect(text).toContain("My Page");
      expect(text).toContain("tpl-landing-hero");
      expect(text).toContain("Hero Landing");
      expect(text).toContain("LANDING");
      expect(mockPrisma.dynamicPage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "page-1" },
          data: expect.objectContaining({ layout: "LANDING" }),
        }),
      );
    });

    it("should return NOT_FOUND when template_id does not exist", async () => {
      const handler = registry.handlers.get("pages_apply_template")!;
      const result = await handler({
        page_id: "page-1",
        template_id: "tpl-does-not-exist",
      });

      const text = getText(result);
      expect(text).toContain("NOT_FOUND");
      expect(text).toContain("pages_list_templates");
      expect(mockPrisma.dynamicPage.findUnique).not.toHaveBeenCalled();
    });

    it("should return NOT_FOUND when page_id does not exist in the database", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("pages_apply_template")!;
      const result = await handler({
        page_id: "nonexistent-page",
        template_id: "tpl-blank",
      });

      const text = getText(result);
      expect(text).toContain("NOT_FOUND");
      expect(text).toContain("Page not found");
      expect(mockPrisma.dynamicPage.update).not.toHaveBeenCalled();
    });

    it("should return PERMISSION_DENIED when the page belongs to another user", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({
        id: "page-2",
        title: "Their Page",
        slug: "their-page",
        userId: "other-user-999",
      });

      const handler = registry.handlers.get("pages_apply_template")!;
      const result = await handler({
        page_id: "page-2",
        template_id: "tpl-blank",
      });

      const text = getText(result);
      expect(text).toContain("PERMISSION_DENIED");
      expect(mockPrisma.dynamicPage.update).not.toHaveBeenCalled();
    });
  });

  // ── pages_get_seo ──────────────────────────────────────────────────────────

  describe("pages_get_seo", () => {
    it("should return a GOOD SEO score for a well-configured page", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({
        id: "page-1",
        title: "My Awesome Page",
        slug: "my-awesome-page",
        userId,
        seoTitle: "My Awesome Page — Best Resource Online",
        seoDescription:
          "Discover why My Awesome Page is the best resource you will find online. Detailed guides and examples for every level.",
        ogImageUrl: "https://example.com/og-image.png",
        description: "A page about awesome things.",
      });

      const handler = registry.handlers.get("pages_get_seo")!;
      const result = await handler({ page_id: "page-1" });
      const text = getText(result);

      expect(text).toContain("SEO Analysis");
      expect(text).toContain("My Awesome Page");
      expect(text).toContain("/100");
      // OG image is set
      expect(text).toContain("https://example.com/og-image.png");
    });

    it("should flag MISSING title and description for a bare page", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({
        id: "page-2",
        title: "X",
        slug: "x",
        userId,
        seoTitle: null,
        seoDescription: null,
        ogImageUrl: null,
        description: null,
      });

      const handler = registry.handlers.get("pages_get_seo")!;
      const result = await handler({ page_id: "page-2" });
      const text = getText(result);

      expect(text).toContain("SEO Analysis");
      // Short title triggers TOO_SHORT
      expect(text).toContain("TOO_SHORT");
      // No description
      expect(text).toContain("MISSING");
      // No OG image
      expect(text).toContain("NOT SET");
      // Should recommend improvements
      expect(text).toContain("pages_set_seo");
    });

    it("should return NOT_FOUND when page does not exist", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("pages_get_seo")!;
      const result = await handler({ page_id: "ghost-page" });
      const text = getText(result);

      expect(text).toContain("NOT_FOUND");
    });

    it("should return PERMISSION_DENIED when the page belongs to another user", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({
        id: "page-3",
        title: "Their Page",
        slug: "their-page",
        userId: "other-user-999",
        seoTitle: null,
        seoDescription: null,
        ogImageUrl: null,
        description: null,
      });

      const handler = registry.handlers.get("pages_get_seo")!;
      const result = await handler({ page_id: "page-3" });
      const text = getText(result);

      expect(text).toContain("PERMISSION_DENIED");
    });
  });

  // ── pages_set_seo ──────────────────────────────────────────────────────────

  describe("pages_set_seo", () => {
    it("should update all SEO fields on an owned page", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({
        id: "page-1",
        title: "My Page",
        slug: "my-page",
        userId,
      });
      mockPrisma.dynamicPage.update.mockResolvedValue({});

      const handler = registry.handlers.get("pages_set_seo")!;
      const result = await handler({
        page_id: "page-1",
        title: "My Page | Best Resource",
        description: "Discover the best resource for your needs online today.",
        keywords: ["resource", "guide", "help"],
        og_image: "https://example.com/og.png",
      });

      const text = getText(result);
      expect(text).toContain("SEO Metadata Updated");
      expect(text).toContain("My Page | Best Resource");
      expect(text).toContain("resource, guide, help");
      expect(text).toContain("https://example.com/og.png");
      expect(mockPrisma.dynamicPage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "page-1" },
          data: expect.objectContaining({
            seoTitle: "My Page | Best Resource",
            seoDescription: "Discover the best resource for your needs online today.",
            tags: ["resource", "guide", "help"],
            ogImageUrl: "https://example.com/og.png",
          }),
        }),
      );
    });

    it("should update only the title when that is the sole provided field", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({
        id: "page-1",
        title: "My Page",
        slug: "my-page",
        userId,
      });
      mockPrisma.dynamicPage.update.mockResolvedValue({});

      const handler = registry.handlers.get("pages_set_seo")!;
      const result = await handler({
        page_id: "page-1",
        title: "Updated Title",
      });

      const text = getText(result);
      expect(text).toContain("SEO Metadata Updated");
      expect(text).toContain("Updated Title");
      expect(mockPrisma.dynamicPage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { seoTitle: "Updated Title" },
        }),
      );
    });

    it("should return an error when no SEO fields are provided", async () => {
      const handler = registry.handlers.get("pages_set_seo")!;
      const result = await handler({ page_id: "page-1" });
      const text = getText(result);

      expect(text).toContain("No changes specified");
      expect(mockPrisma.dynamicPage.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.dynamicPage.update).not.toHaveBeenCalled();
    });

    it("should return NOT_FOUND when the page does not exist", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("pages_set_seo")!;
      const result = await handler({
        page_id: "ghost-page",
        title: "Ghost Title",
      });

      const text = getText(result);
      expect(text).toContain("NOT_FOUND");
      expect(mockPrisma.dynamicPage.update).not.toHaveBeenCalled();
    });

    it("should return PERMISSION_DENIED when the page belongs to another user", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({
        id: "page-9",
        title: "Their Page",
        slug: "their-page",
        userId: "other-user-999",
      });

      const handler = registry.handlers.get("pages_set_seo")!;
      const result = await handler({
        page_id: "page-9",
        description: "Sneaky description",
      });

      const text = getText(result);
      expect(text).toContain("PERMISSION_DENIED");
      expect(mockPrisma.dynamicPage.update).not.toHaveBeenCalled();
    });

    it("should handle a database error via safeToolCall", async () => {
      mockPrisma.dynamicPage.findUnique.mockRejectedValue(
        new Error("Connection timeout"),
      );

      const handler = registry.handlers.get("pages_set_seo")!;
      const result = await handler({
        page_id: "page-1",
        title: "Title",
      });

      const text = getText(result);
      expect(text).toContain("Error");
      expect(text).toContain("Connection timeout");
      expect(isError(result)).toBe(true);
    });
  });
});
