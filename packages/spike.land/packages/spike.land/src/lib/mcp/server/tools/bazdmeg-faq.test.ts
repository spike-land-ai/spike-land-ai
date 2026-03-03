import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockIsAdminByUserId, mockPrisma } = vi.hoisted(() => ({
  mockIsAdminByUserId: vi.fn<(userId: string) => Promise<boolean>>(),
  mockPrisma: {
    bazdmegFaqEntry: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/admin-middleware", () => ({
  isAdminByUserId: mockIsAdminByUserId,
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerBazdmegFaqTools } from "./bazdmeg-faq";

describe("bazdmeg-faq tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdminByUserId.mockResolvedValue(true);
    registry = createMockRegistry();
    registerBazdmegFaqTools(registry, userId);
  });

  it("should register 4 bazdmeg FAQ tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
  });

  describe("bazdmeg_faq_list", () => {
    it("should list published FAQ entries", async () => {
      mockPrisma.bazdmegFaqEntry.findMany.mockResolvedValue([
        {
          id: "f1",
          question: "What is BAZDMEG?",
          answer: "A methodology",
          category: "general",
          isPublished: true,
          helpfulCount: 5,
        },
      ]);
      const handler = registry.handlers.get("bazdmeg_faq_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("What is BAZDMEG?");
      expect(getText(result)).toContain("1 entries");
      expect(mockPrisma.bazdmegFaqEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublished: true },
        }),
      );
    });

    it("should filter by category", async () => {
      mockPrisma.bazdmegFaqEntry.findMany.mockResolvedValue([
        {
          id: "f2",
          question: "How to test?",
          answer: "Write tests",
          category: "testing",
          isPublished: true,
          helpfulCount: 2,
        },
      ]);
      const handler = registry.handlers.get("bazdmeg_faq_list")!;
      const result = await handler({ category: "testing" });
      expect(getText(result)).toContain("How to test?");
      expect(mockPrisma.bazdmegFaqEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublished: true, category: "testing" },
        }),
      );
    });

    it("should return empty message when no entries", async () => {
      mockPrisma.bazdmegFaqEntry.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("bazdmeg_faq_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("No FAQ entries found");
    });

    it("should ignore include_unpublished for non-admin users", async () => {
      mockIsAdminByUserId.mockResolvedValue(false);
      mockPrisma.bazdmegFaqEntry.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("bazdmeg_faq_list")!;
      await handler({ include_unpublished: true });
      expect(mockPrisma.bazdmegFaqEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublished: true },
        }),
      );
    });
  });

  describe("bazdmeg_faq_create", () => {
    it("should create a FAQ entry", async () => {
      mockPrisma.bazdmegFaqEntry.create.mockResolvedValue({
        id: "new-1",
        question: "New question?",
        answer: "New answer",
        category: "general",
        sortOrder: 0,
      });
      const handler = registry.handlers.get("bazdmeg_faq_create")!;
      const result = await handler({
        question: "New question?",
        answer: "New answer",
      });
      expect(getText(result)).toContain("FAQ entry created");
      expect(getText(result)).toContain("new-1");
    });

    it("should reject non-admin users", async () => {
      mockIsAdminByUserId.mockResolvedValue(false);
      const handler = registry.handlers.get("bazdmeg_faq_create")!;
      const result = await handler({ question: "New?", answer: "Nope" });
      expect(getText(result)).toContain("Forbidden");
    });
  });

  describe("bazdmeg_faq_update", () => {
    it("should update a FAQ entry", async () => {
      mockPrisma.bazdmegFaqEntry.update.mockResolvedValue({
        id: "f1",
        question: "Updated question?",
        answer: "Updated answer",
      });
      const handler = registry.handlers.get("bazdmeg_faq_update")!;
      const result = await handler({ id: "f1", question: "Updated question?" });
      expect(getText(result)).toContain("FAQ entry updated");
    });

    it("should reject non-admin users", async () => {
      mockIsAdminByUserId.mockResolvedValue(false);
      const handler = registry.handlers.get("bazdmeg_faq_update")!;
      const result = await handler({ id: "f1", question: "Nope" });
      expect(getText(result)).toContain("Forbidden");
    });

    it("should only include defined fields in update data", async () => {
      mockPrisma.bazdmegFaqEntry.update.mockResolvedValue({
        id: "f1",
        question: "Original question",
      });
      const handler = registry.handlers.get("bazdmeg_faq_update")!;
      // Only pass answer — question, category, sort_order, is_published should be omitted
      await handler({ id: "f1", answer: "New answer" });
      expect(mockPrisma.bazdmegFaqEntry.update).toHaveBeenCalledWith({
        where: { id: "f1" },
        data: { answer: "New answer" },
      });
    });

    it("should include all fields when all are provided", async () => {
      mockPrisma.bazdmegFaqEntry.update.mockResolvedValue({
        id: "f1",
        question: "Updated Q",
      });
      const handler = registry.handlers.get("bazdmeg_faq_update")!;
      await handler({
        id: "f1",
        question: "Updated Q",
        answer: "Updated A",
        category: "testing",
        sort_order: 5,
        is_published: false,
      });
      expect(mockPrisma.bazdmegFaqEntry.update).toHaveBeenCalledWith({
        where: { id: "f1" },
        data: {
          question: "Updated Q",
          answer: "Updated A",
          category: "testing",
          sortOrder: 5,
          isPublished: false,
        },
      });
    });

    it("should handle update with only category", async () => {
      mockPrisma.bazdmegFaqEntry.update.mockResolvedValue({
        id: "f1",
        question: "Some Q",
      });
      const handler = registry.handlers.get("bazdmeg_faq_update")!;
      await handler({ id: "f1", category: "methodology" });
      expect(mockPrisma.bazdmegFaqEntry.update).toHaveBeenCalledWith({
        where: { id: "f1" },
        data: { category: "methodology" },
      });
    });

    it("should handle update with only sort_order", async () => {
      mockPrisma.bazdmegFaqEntry.update.mockResolvedValue({
        id: "f1",
        question: "Some Q",
      });
      const handler = registry.handlers.get("bazdmeg_faq_update")!;
      await handler({ id: "f1", sort_order: 10 });
      expect(mockPrisma.bazdmegFaqEntry.update).toHaveBeenCalledWith({
        where: { id: "f1" },
        data: { sortOrder: 10 },
      });
    });

    it("should handle update with only is_published", async () => {
      mockPrisma.bazdmegFaqEntry.update.mockResolvedValue({
        id: "f1",
        question: "Some Q",
      });
      const handler = registry.handlers.get("bazdmeg_faq_update")!;
      await handler({ id: "f1", is_published: true });
      expect(mockPrisma.bazdmegFaqEntry.update).toHaveBeenCalledWith({
        where: { id: "f1" },
        data: { isPublished: true },
      });
    });
  });

  describe("bazdmeg_faq_delete", () => {
    it("should delete a FAQ entry", async () => {
      mockPrisma.bazdmegFaqEntry.delete.mockResolvedValue({ id: "f1" });
      const handler = registry.handlers.get("bazdmeg_faq_delete")!;
      const result = await handler({ id: "f1" });
      expect(getText(result)).toContain("FAQ entry deleted");
    });

    it("should reject non-admin users", async () => {
      mockIsAdminByUserId.mockResolvedValue(false);
      const handler = registry.handlers.get("bazdmeg_faq_delete")!;
      const result = await handler({ id: "f1" });
      expect(getText(result)).toContain("Forbidden");
    });
  });

  describe("bazdmeg_faq_list - include_unpublished for admin", () => {
    it("should show unpublished entries when admin requests", async () => {
      mockIsAdminByUserId.mockResolvedValue(true);
      mockPrisma.bazdmegFaqEntry.findMany.mockResolvedValue([
        {
          id: "f1",
          question: "Published?",
          answer: "Yes",
          category: "general",
          isPublished: true,
          helpfulCount: 1,
        },
        {
          id: "f2",
          question: "Draft?",
          answer: "No",
          category: "general",
          isPublished: false,
          helpfulCount: 0,
        },
      ]);
      const handler = registry.handlers.get("bazdmeg_faq_list")!;
      const result = await handler({ include_unpublished: true });
      expect(getText(result)).toContain("2 entries");
      // Should NOT filter by isPublished when admin requests unpublished
      expect(mockPrisma.bazdmegFaqEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it("should include unpublished when admin and category filter", async () => {
      mockIsAdminByUserId.mockResolvedValue(true);
      mockPrisma.bazdmegFaqEntry.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("bazdmeg_faq_list")!;
      await handler({ include_unpublished: true, category: "testing" });
      expect(mockPrisma.bazdmegFaqEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: "testing" },
        }),
      );
    });

    it("should not include_unpublished when flag is false even for admin", async () => {
      mockIsAdminByUserId.mockResolvedValue(true);
      mockPrisma.bazdmegFaqEntry.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("bazdmeg_faq_list")!;
      await handler({ include_unpublished: false });
      expect(mockPrisma.bazdmegFaqEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublished: true },
        }),
      );
    });
  });
});
