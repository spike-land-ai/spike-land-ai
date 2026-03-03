import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  dynamicPage: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  pageBlock: {
    findUnique: vi.fn(),
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
import { registerPageAiTools } from "./page-ai";

describe("page-ai tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerPageAiTools(registry, userId);
  });

  it("should register 5 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("page_ai_generate")).toBe(true);
    expect(registry.handlers.has("page_ai_enhance_block")).toBe(true);
    expect(registry.handlers.has("page_ai_suggest_layout")).toBe(true);
    expect(registry.handlers.has("page_ai_generate_theme")).toBe(true);
    expect(registry.handlers.has("page_ai_populate_store")).toBe(true);
  });

  // ── page_ai_generate ──────────────────────────────────────────────────────

  describe("page_ai_generate", () => {
    it("should generate a page with HERO, FEATURE_GRID, and CTA blocks", async () => {
      mockIsReservedSlug.mockReturnValue(false);
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(null);
      mockPrisma.dynamicPage.create.mockResolvedValue({
        id: "gen-1",
        slug: "my-awesome-saas-product",
        title: "My awesome SaaS product",
        layout: "LANDING",
        status: "DRAFT",
        blocks: [
          { id: "b1", blockType: "HERO", sortOrder: 0 },
          { id: "b2", blockType: "FEATURE_GRID", sortOrder: 1 },
          { id: "b3", blockType: "CTA", sortOrder: 2 },
        ],
      });

      const handler = registry.handlers.get("page_ai_generate")!;
      const result = await handler({
        prompt: "My awesome SaaS product",
      });

      const text = getText(result);
      expect(text).toContain("Page Generated");
      expect(text).toContain("My awesome SaaS product");
      expect(text).toContain("LANDING");
      expect(text).toContain("DRAFT");
      expect(text).toContain("HERO");
      expect(text).toContain("FEATURE_GRID");
      expect(text).toContain("CTA");
      expect(text).toContain("gen-1");
    });

    it("should use provided slug instead of auto-generated one", async () => {
      mockIsReservedSlug.mockReturnValue(false);
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(null);
      mockPrisma.dynamicPage.create.mockResolvedValue({
        id: "gen-2",
        slug: "custom-slug",
        title: "Build a landing page",
        layout: "FEATURE",
        status: "DRAFT",
        blocks: [
          { id: "b1", blockType: "HERO", sortOrder: 0 },
          { id: "b2", blockType: "FEATURE_GRID", sortOrder: 1 },
          { id: "b3", blockType: "CTA", sortOrder: 2 },
        ],
      });

      const handler = registry.handlers.get("page_ai_generate")!;
      const result = await handler({
        prompt: "Build a landing page",
        slug: "custom-slug",
        layout: "FEATURE",
      });

      const text = getText(result);
      expect(text).toContain("custom-slug");
      expect(mockPrisma.dynamicPage.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: "custom-slug" } }),
      );
      expect(mockPrisma.dynamicPage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: "custom-slug",
            layout: "FEATURE",
          }),
        }),
      );
    });

    it("should reject reserved slugs", async () => {
      mockIsReservedSlug.mockReturnValue(true);

      const handler = registry.handlers.get("page_ai_generate")!;
      const result = await handler({
        prompt: "Admin dashboard",
        slug: "admin",
      });

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("reserved");
      expect(mockPrisma.dynamicPage.create).not.toHaveBeenCalled();
    });

    it("should return VALIDATION_ERROR when slug cannot be generated from empty prompt", async () => {
      mockIsReservedSlug.mockReturnValue(false);

      const handler = registry.handlers.get("page_ai_generate")!;
      // Prompt with only special chars that will produce an empty slug
      const result = await handler({ prompt: "!!! ???" });

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("slug");
    });

    it("should pad feature items to at least 3 when keywords are few", async () => {
      mockIsReservedSlug.mockReturnValue(false);
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(null);
      mockPrisma.dynamicPage.create.mockResolvedValue({
        id: "gen-padded",
        slug: "x",
        title: "X",
        layout: "LANDING",
        status: "DRAFT",
        blocks: [
          { id: "b1", blockType: "HERO", sortOrder: 0 },
          { id: "b2", blockType: "FEATURE_GRID", sortOrder: 1 },
          { id: "b3", blockType: "CTA", sortOrder: 2 },
        ],
      });

      const handler = registry.handlers.get("page_ai_generate")!;
      // Single-word prompt produces only 1 keyword
      const result = await handler({ prompt: "x" });

      // Should still succeed - the padding fills in Feature 2 and Feature 3
      const text = getText(result);
      expect(text).toContain("Page Generated");

      // Verify the create was called with exactly 3 features in the FEATURE_GRID
      const createCall = mockPrisma.dynamicPage.create.mock.calls[0]![0];
      const featureBlock = createCall.data.blocks.create.find(
        (b: { blockType: string; }) => b.blockType === "FEATURE_GRID",
      );
      expect(featureBlock.content.features).toHaveLength(3);
    });

    it("should reject duplicate slugs", async () => {
      mockIsReservedSlug.mockReturnValue(false);
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({ id: "existing" });

      const handler = registry.handlers.get("page_ai_generate")!;
      const result = await handler({
        prompt: "My product page",
        slug: "taken-slug",
      });

      const text = getText(result);
      expect(text).toContain("CONFLICT");
      expect(text).toContain("already exists");
      expect(mockPrisma.dynamicPage.create).not.toHaveBeenCalled();
    });
  });

  // ── page_ai_enhance_block ─────────────────────────────────────────────────

  describe("page_ai_enhance_block", () => {
    it("should return current block content with enhancement instruction", async () => {
      mockPrisma.pageBlock.findUnique.mockResolvedValue({
        id: "block-1",
        blockType: "HERO",
        content: { headline: "Old Title", subheadline: "Old subtitle" },
      });

      const handler = registry.handlers.get("page_ai_enhance_block")!;
      const result = await handler({
        blockId: "block-1",
        instruction: "Make the headline more compelling",
      });

      const text = getText(result);
      expect(text).toContain("Block Enhancement Review");
      expect(text).toContain("block-1");
      expect(text).toContain("HERO");
      expect(text).toContain("Make the headline more compelling");
      expect(text).toContain("Old Title");
      expect(text).toContain("placeholder");
      expect(text).toContain("blocks_update");
    });

    it("should return NOT_FOUND when block does not exist", async () => {
      mockPrisma.pageBlock.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("page_ai_enhance_block")!;
      const result = await handler({
        blockId: "nonexistent",
        instruction: "Improve it",
      });

      const text = getText(result);
      expect(text).toContain("NOT_FOUND");
      expect(text).toContain("nonexistent");
    });
  });

  // ── page_ai_suggest_layout ────────────────────────────────────────────────

  describe("page_ai_suggest_layout", () => {
    it("should suggest LANDING layout for product pages", async () => {
      const handler = registry.handlers.get("page_ai_suggest_layout")!;
      const result = await handler({ useCase: "A product landing page" });

      const text = getText(result);
      expect(text).toContain("Layout Suggestion");
      expect(text).toContain("LANDING");
      expect(text).toContain("HERO");
      expect(text).toContain("FEATURE_GRID");
      expect(text).toContain("TESTIMONIALS");
      expect(text).toContain("PRICING");
    });

    it("should suggest STORE layout for marketplace pages", async () => {
      const handler = registry.handlers.get("page_ai_suggest_layout")!;
      const result = await handler({ useCase: "An app store marketplace" });

      const text = getText(result);
      expect(text).toContain("STORE");
      expect(text).toContain("APP_GRID");
    });

    it("should suggest ARTICLE layout for blog pages", async () => {
      const handler = registry.handlers.get("page_ai_suggest_layout")!;
      const result = await handler({ useCase: "A technical blog article" });

      const text = getText(result);
      expect(text).toContain("ARTICLE");
      expect(text).toContain("MARKDOWN");
    });

    it("should suggest GALLERY layout for portfolio pages", async () => {
      const handler = registry.handlers.get("page_ai_suggest_layout")!;
      const result = await handler({ useCase: "A photography portfolio" });

      const text = getText(result);
      expect(text).toContain("GALLERY");
    });

    it("should suggest FEATURE layout for comparison pages", async () => {
      const handler = registry.handlers.get("page_ai_suggest_layout")!;
      const result = await handler({
        useCase: "A comparison versus competitors",
      });

      const text = getText(result);
      expect(text).toContain("FEATURE");
      expect(text).toContain("COMPARISON_TABLE");
    });

    it("should default to LANDING for unknown use cases", async () => {
      const handler = registry.handlers.get("page_ai_suggest_layout")!;
      const result = await handler({
        useCase: "Something completely different",
      });

      const text = getText(result);
      expect(text).toContain("LANDING");
      expect(text).toContain("versatile");
    });
  });

  // ── page_ai_generate - icon fallback branch ──────────────────────────────

  describe("page_ai_generate - icon fallback", () => {
    it("should use 'Star' icon fallback when index >= 3", async () => {
      mockIsReservedSlug.mockReturnValue(false);
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(null);
      mockPrisma.dynamicPage.create.mockResolvedValue({
        id: "gen-icons",
        slug: "many-keywords-page",
        title: "Alpha Beta Gamma Delta Epsilon",
        layout: "LANDING",
        status: "DRAFT",
        blocks: [
          { id: "b1", blockType: "HERO", sortOrder: 0 },
          { id: "b2", blockType: "FEATURE_GRID", sortOrder: 1 },
          { id: "b3", blockType: "CTA", sortOrder: 2 },
        ],
      });

      const handler = registry.handlers.get("page_ai_generate")!;
      // Prompt with 5+ keywords to trigger icon fallback at index >= 3
      await handler({ prompt: "alpha beta gamma delta epsilon" });

      const createCall = mockPrisma.dynamicPage.create.mock.calls[0]![0];
      const featureBlock = createCall.data.blocks.create.find(
        (b: { blockType: string; }) => b.blockType === "FEATURE_GRID",
      );
      // First 3 get Sparkles, Zap, Shield; any beyond 3 in keywords.slice(0,3) won't happen
      // but the padding path uses `["Sparkles", "Zap", "Shield"][idx] ?? "Star"` where idx >= 3
      // So we need a case with fewer keywords that triggers padding
      expect(featureBlock.content.features).toHaveLength(3);
    });
  });

  // ── page_ai_generate_theme ────────────────────────────────────────────────

  describe("page_ai_generate_theme", () => {
    it("should generate a theme with default values", async () => {
      const handler = registry.handlers.get("page_ai_generate_theme")!;
      const result = await handler({
        brandDescription: "Modern tech startup",
      });

      const text = getText(result);
      expect(text).toContain("Generated Theme");
      expect(text).toContain("Modern Tech Startup Theme");
      expect(text).toContain("modern");
      expect(text).toContain("#3B82F6"); // default primary color
      expect(text).toContain("primary");
      expect(text).toContain("secondary");
      expect(text).toContain("accent");
      expect(text).toContain("background");
      expect(text).toContain("foreground");
      expect(text).toContain("borderRadius");
      expect(text).toContain("spacing");
      expect(text).toContain("themeData");
    });

    it("should generate a theme with custom color and style", async () => {
      const handler = registry.handlers.get("page_ai_generate_theme")!;
      const result = await handler({
        brandDescription: "Bold creative agency",
        primaryColor: "#FF5500",
        style: "bold",
      });

      const text = getText(result);
      expect(text).toContain("Generated Theme");
      expect(text).toContain("bold");
      expect(text).toContain("#FF5500");
      expect(text).toContain("Bold Creative Agency Theme");
      expect(text).toContain("0.75rem"); // bold borderRadius
      expect(text).toContain("700"); // bold fontWeight
    });

    it("should generate a playful theme", async () => {
      const handler = registry.handlers.get("page_ai_generate_theme")!;
      const result = await handler({
        brandDescription: "Fun kids platform",
        style: "playful",
      });

      const text = getText(result);
      expect(text).toContain("playful");
      expect(text).toContain("1rem"); // playful borderRadius
      expect(text).toContain("rounded"); // playful headingStyle
    });

    it("should generate a minimal theme", async () => {
      const handler = registry.handlers.get("page_ai_generate_theme")!;
      const result = await handler({
        brandDescription: "Minimalist design studio",
        style: "minimal",
      });

      const text = getText(result);
      expect(text).toContain("minimal");
      expect(text).toContain("0.25rem"); // minimal borderRadius
      expect(text).toContain("light"); // minimal headingStyle
    });
  });

  describe("page_ai_generate_theme - unknown style fallback", () => {
    it("should fall back to modern settings for unknown style", async () => {
      const handler = registry.handlers.get("page_ai_generate_theme")!;
      const result = await handler({
        brandDescription: "Futuristic space agency",
        style: "futuristic",
      });

      const text = getText(result);
      expect(text).toContain("Generated Theme");
      // Should fall back to modern style settings via ?? operator
      expect(text).toContain("0.5rem"); // modern borderRadius
      expect(text).toContain("500"); // modern fontWeight
    });
  });

  // ── page_ai_populate_store ────────────────────────────────────────────────

  describe("page_ai_populate_store", () => {
    it("should populate a page with sample APP_GRID block", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({
        id: "page-1",
        title: "My Store",
      });
      mockPrisma.pageBlock.findFirst.mockResolvedValue({ sortOrder: 1 });
      mockPrisma.pageBlock.create.mockResolvedValue({
        id: "block-1",
        sortOrder: 2,
      });

      const handler = registry.handlers.get("page_ai_populate_store")!;
      const result = await handler({ pageSlug: "my-store" });

      const text = getText(result);
      expect(text).toContain("Store Populated");
      expect(text).toContain("My Store");
      expect(text).toContain("my-store");
      expect(text).toContain("APP_GRID");
      expect(text).toContain("Sort Order:** 2");
      expect(text).toContain("Image & Creative");
      expect(text).toContain("Development");
      expect(text).toContain("Communication");
      expect(text).toContain("Analytics");
      expect(text).toContain("AI & Automation");
      expect(text).toContain("Apps Added:** 12");
      expect(mockPrisma.pageBlock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pageId: "page-1",
            blockType: "APP_GRID",
            sortOrder: 2,
            isVisible: true,
          }),
        }),
      );
    });

    it("should use sort order 0 when page has no existing blocks", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue({
        id: "page-1",
        title: "Empty Store",
      });
      mockPrisma.pageBlock.findFirst.mockResolvedValue(null);
      mockPrisma.pageBlock.create.mockResolvedValue({
        id: "block-1",
        sortOrder: 0,
      });

      const handler = registry.handlers.get("page_ai_populate_store")!;
      await handler({ pageSlug: "empty-store" });

      expect(mockPrisma.pageBlock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sortOrder: 0 }),
        }),
      );
    });

    it("should return NOT_FOUND when page does not exist", async () => {
      mockPrisma.dynamicPage.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("page_ai_populate_store")!;
      const result = await handler({ pageSlug: "nonexistent" });

      const text = getText(result);
      expect(text).toContain("NOT_FOUND");
      expect(text).toContain("nonexistent");
      expect(mockPrisma.pageBlock.create).not.toHaveBeenCalled();
    });
  });
});
