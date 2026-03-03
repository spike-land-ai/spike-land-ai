import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  pageBlock: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

const mockValidateBlockContent = vi.fn();
const mockGetBlockTypeDescriptions = vi.fn();
vi.mock("@/lib/dynamic-pages/block-schemas", () => ({
  validateBlockContent: (...args: unknown[]) => mockValidateBlockContent(...args),
  getBlockTypeDescriptions: (...args: unknown[]) => mockGetBlockTypeDescriptions(...args),
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerBlocksTools } from "./blocks";

const now = new Date("2025-01-15T12:00:00Z");

describe("blocks tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerBlocksTools(registry, userId);
  });

  it("should register 6 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(6);
    expect(registry.handlers.has("blocks_add")).toBe(true);
    expect(registry.handlers.has("blocks_update")).toBe(true);
    expect(registry.handlers.has("blocks_delete")).toBe(true);
    expect(registry.handlers.has("blocks_reorder")).toBe(true);
    expect(registry.handlers.has("blocks_list_types")).toBe(true);
    expect(registry.handlers.has("blocks_get")).toBe(true);
  });

  // ── blocks_add ────────────────────────────────────────────────────────────

  describe("blocks_add", () => {
    it("should add a block successfully with auto sort order", async () => {
      mockValidateBlockContent.mockReturnValue({
        success: true,
        data: { headline: "Hello World" },
      });
      mockPrisma.pageBlock.findFirst.mockResolvedValue({ sortOrder: 2 });
      mockPrisma.pageBlock.create.mockResolvedValue({
        id: "block-1",
        pageId: "page-1",
        blockType: "HERO",
        variant: null,
        sortOrder: 3,
        isVisible: true,
        createdAt: now,
      });

      const handler = registry.handlers.get("blocks_add")!;
      const result = await handler({
        pageId: "page-1",
        blockType: "HERO",
        content: { headline: "Hello World" },
      });

      const text = getText(result);
      expect(text).toContain("Block Created");
      expect(text).toContain("block-1");
      expect(text).toContain("page-1");
      expect(text).toContain("HERO");
      expect(text).toContain("Sort Order:** 3");
      expect(text).toContain("Visible:** Yes");
    });

    it("should add a block with explicit sort order", async () => {
      mockValidateBlockContent.mockReturnValue({
        success: true,
        data: { headline: "CTA" },
      });
      mockPrisma.pageBlock.create.mockResolvedValue({
        id: "block-2",
        pageId: "page-1",
        blockType: "CTA",
        variant: "centered",
        sortOrder: 5,
        isVisible: true,
        createdAt: now,
      });

      const handler = registry.handlers.get("blocks_add")!;
      const result = await handler({
        pageId: "page-1",
        blockType: "CTA",
        content: { headline: "CTA" },
        variant: "centered",
        sortOrder: 5,
      });

      const text = getText(result);
      expect(text).toContain("Block Created");
      expect(text).toContain("Sort Order:** 5");
      expect(text).toContain("centered");
      // findFirst should not be called when sortOrder is explicitly provided
      expect(mockPrisma.pageBlock.findFirst).not.toHaveBeenCalled();
    });

    it("should auto-assign sort order 0 when no blocks exist", async () => {
      mockValidateBlockContent.mockReturnValue({
        success: true,
        data: { headline: "First" },
      });
      mockPrisma.pageBlock.findFirst.mockResolvedValue(null);
      mockPrisma.pageBlock.create.mockResolvedValue({
        id: "block-1",
        pageId: "page-1",
        blockType: "HERO",
        variant: null,
        sortOrder: 0,
        isVisible: true,
        createdAt: now,
      });

      const handler = registry.handlers.get("blocks_add")!;
      await handler({
        pageId: "page-1",
        blockType: "HERO",
        content: { headline: "First" },
      });

      expect(mockPrisma.pageBlock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sortOrder: 0 }),
        }),
      );
    });

    it("should add a block with isVisible: false", async () => {
      mockValidateBlockContent.mockReturnValue({
        success: true,
        data: { headline: "Hidden" },
      });
      mockPrisma.pageBlock.findFirst.mockResolvedValue(null);
      mockPrisma.pageBlock.create.mockResolvedValue({
        id: "block-hidden",
        pageId: "page-1",
        blockType: "HERO",
        variant: null,
        sortOrder: 0,
        isVisible: false,
        createdAt: now,
      });

      const handler = registry.handlers.get("blocks_add")!;
      const result = await handler({
        pageId: "page-1",
        blockType: "HERO",
        content: { headline: "Hidden" },
        isVisible: false,
      });

      const text = getText(result);
      expect(text).toContain("Visible:** No");
    });

    it("should reject invalid content", async () => {
      mockValidateBlockContent.mockReturnValue({
        success: false,
        error: "Missing required field: headline",
      });

      const handler = registry.handlers.get("blocks_add")!;
      const result = await handler({
        pageId: "page-1",
        blockType: "HERO",
        content: {},
      });

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("Missing required field: headline");
      expect(mockPrisma.pageBlock.create).not.toHaveBeenCalled();
    });
  });

  // ── blocks_update ─────────────────────────────────────────────────────────

  describe("blocks_update", () => {
    it("should update a block successfully", async () => {
      mockPrisma.pageBlock.findUnique.mockResolvedValue({
        id: "block-1",
        blockType: "HERO",
      });
      mockValidateBlockContent.mockReturnValue({
        success: true,
        data: { headline: "Updated" },
      });
      mockPrisma.pageBlock.update.mockResolvedValue({
        id: "block-1",
        pageId: "page-1",
        blockType: "HERO",
        variant: "dark",
        sortOrder: 0,
        isVisible: true,
        updatedAt: now,
      });

      const handler = registry.handlers.get("blocks_update")!;
      const result = await handler({
        blockId: "block-1",
        content: { headline: "Updated" },
        variant: "dark",
      });

      const text = getText(result);
      expect(text).toContain("Block Updated");
      expect(text).toContain("block-1");
      expect(text).toContain("dark");
    });

    it("should return NOT_FOUND when block does not exist", async () => {
      mockPrisma.pageBlock.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("blocks_update")!;
      const result = await handler({ blockId: "nonexistent" });

      const text = getText(result);
      expect(text).toContain("NOT_FOUND");
      expect(text).toContain("nonexistent");
    });

    it("should reject invalid content on update", async () => {
      mockPrisma.pageBlock.findUnique.mockResolvedValue({
        id: "block-1",
        blockType: "HERO",
      });
      mockValidateBlockContent.mockReturnValue({
        success: false,
        error: "Invalid headline type",
      });

      const handler = registry.handlers.get("blocks_update")!;
      const result = await handler({
        blockId: "block-1",
        content: { headline: 123 },
      });

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("Invalid headline type");
      expect(mockPrisma.pageBlock.update).not.toHaveBeenCalled();
    });

    it("should update visibility without validating content", async () => {
      mockPrisma.pageBlock.findUnique.mockResolvedValue({
        id: "block-1",
        blockType: "HERO",
      });
      mockPrisma.pageBlock.update.mockResolvedValue({
        id: "block-1",
        pageId: "page-1",
        blockType: "HERO",
        variant: null,
        sortOrder: 0,
        isVisible: false,
        updatedAt: now,
      });

      const handler = registry.handlers.get("blocks_update")!;
      const result = await handler({
        blockId: "block-1",
        isVisible: false,
      });

      const text = getText(result);
      expect(text).toContain("Block Updated");
      expect(text).toContain("Visible:** No");
      expect(mockValidateBlockContent).not.toHaveBeenCalled();
    });
  });

  // ── blocks_delete ─────────────────────────────────────────────────────────

  describe("blocks_delete", () => {
    it("should delete a block successfully", async () => {
      mockPrisma.pageBlock.delete.mockResolvedValue({});

      const handler = registry.handlers.get("blocks_delete")!;
      const result = await handler({ blockId: "block-1" });

      const text = getText(result);
      expect(text).toContain("Block Deleted");
      expect(text).toContain("block-1");
      expect(mockPrisma.pageBlock.delete).toHaveBeenCalledWith({
        where: { id: "block-1" },
      });
    });
  });

  // ── blocks_reorder ────────────────────────────────────────────────────────

  describe("blocks_reorder", () => {
    it("should reorder blocks using a transaction", async () => {
      mockPrisma.$transaction.mockResolvedValue([]);

      const handler = registry.handlers.get("blocks_reorder")!;
      const result = await handler({
        pageId: "page-1",
        blockIds: ["block-c", "block-a", "block-b"],
      });

      const text = getText(result);
      expect(text).toContain("Blocks Reordered");
      expect(text).toContain("page-1");
      expect(text).toContain("0: block-c");
      expect(text).toContain("1: block-a");
      expect(text).toContain("2: block-b");
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ── blocks_list_types ─────────────────────────────────────────────────────

  describe("blocks_list_types", () => {
    it("should return all block type descriptions", async () => {
      mockGetBlockTypeDescriptions.mockReturnValue({
        HERO: "A hero banner section",
        CTA: "Call to action section",
        FAQ: "Frequently asked questions",
      });

      const handler = registry.handlers.get("blocks_list_types")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("Available Block Types");
      expect(text).toContain("HERO");
      expect(text).toContain("A hero banner section");
      expect(text).toContain("CTA");
      expect(text).toContain("FAQ");
    });
  });

  // ── blocks_get ────────────────────────────────────────────────────────────

  describe("blocks_get", () => {
    it("should return full block details", async () => {
      mockPrisma.pageBlock.findUnique.mockResolvedValue({
        id: "block-1",
        pageId: "page-1",
        blockType: "HERO",
        variant: "dark",
        sortOrder: 0,
        isVisible: true,
        createdAt: now,
        updatedAt: now,
        content: { headline: "Hello", subheadline: "World" },
      });

      const handler = registry.handlers.get("blocks_get")!;
      const result = await handler({ blockId: "block-1" });

      const text = getText(result);
      expect(text).toContain("Block Details");
      expect(text).toContain("block-1");
      expect(text).toContain("page-1");
      expect(text).toContain("HERO");
      expect(text).toContain("dark");
      expect(text).toContain("Visible:** Yes");
      expect(text).toContain("\"headline\"");
      expect(text).toContain("\"Hello\"");
    });

    it("should display variant as 'none' and visible as 'No' when applicable", async () => {
      mockPrisma.pageBlock.findUnique.mockResolvedValue({
        id: "block-2",
        pageId: "page-1",
        blockType: "CTA",
        variant: null,
        sortOrder: 1,
        isVisible: false,
        createdAt: now,
        updatedAt: now,
        content: { text: "Click me" },
      });

      const handler = registry.handlers.get("blocks_get")!;
      const result = await handler({ blockId: "block-2" });

      const text = getText(result);
      expect(text).toContain("Block Details");
      expect(text).toContain("Variant:** none");
      expect(text).toContain("Visible:** No");
    });

    it("should return NOT_FOUND when block does not exist", async () => {
      mockPrisma.pageBlock.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("blocks_get")!;
      const result = await handler({ blockId: "nonexistent" });

      const text = getText(result);
      expect(text).toContain("NOT_FOUND");
      expect(text).toContain("nonexistent");
    });
  });
});
