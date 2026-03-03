import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  workspace: { findFirst: vi.fn() },
  creativeSet: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  creativeVariant: { create: vi.fn() },
  creativeFatigueAlert: { findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerCreativeTools } from "./creative";

describe("creative tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCreativeTools(registry, userId);
    mockPrisma.workspace.findFirst.mockResolvedValue({
      id: "ws-1",
      slug: "test-ws",
      name: "Test Workspace",
    });
  });

  it("should register 4 creative tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.handlers.has("creative_generate_variants")).toBe(true);
    expect(registry.handlers.has("creative_detect_fatigue")).toBe(true);
    expect(registry.handlers.has("creative_get_performance")).toBe(true);
    expect(registry.handlers.has("creative_list_sets")).toBe(true);
  });

  describe("creative_generate_variants", () => {
    it("should create a creative set with variants", async () => {
      mockPrisma.creativeSet.create.mockResolvedValue({ id: "cs-1" });
      mockPrisma.creativeVariant.create
        .mockResolvedValueOnce({ id: "cv-1" })
        .mockResolvedValueOnce({ id: "cv-2" })
        .mockResolvedValueOnce({ id: "cv-3" });

      const handler = registry.handlers.get("creative_generate_variants")!;
      const result = await handler({
        workspace_slug: "test-ws",
        content: "Buy our product!",
        variant_count: 3,
      });

      const text = getText(result);
      expect(text).toContain("Creative Set Created");
      expect(text).toContain("cs-1");
      expect(text).toContain("cv-1");
      expect(text).toContain("cv-2");
      expect(text).toContain("cv-3");
      expect(text).toContain("PENDING");
      expect(mockPrisma.creativeVariant.create).toHaveBeenCalledTimes(3);
    });

    it("should include name in output", async () => {
      mockPrisma.creativeSet.create.mockResolvedValue({ id: "cs-2" });
      mockPrisma.creativeVariant.create.mockResolvedValue({ id: "cv-4" });

      const handler = registry.handlers.get("creative_generate_variants")!;
      const result = await handler({
        workspace_slug: "test-ws",
        name: "Summer Campaign",
        content: "Sale now!",
        variant_count: 1,
      });

      const text = getText(result);
      expect(text).toContain("Summer Campaign");
      expect(text).toContain("cs-2");
      expect(text).toContain("cv-4");
    });

    it("should pass content as seed and prompt", async () => {
      mockPrisma.creativeSet.create.mockResolvedValue({ id: "cs-3" });
      mockPrisma.creativeVariant.create.mockResolvedValue({ id: "cv-5" });

      const handler = registry.handlers.get("creative_generate_variants")!;
      await handler({
        workspace_slug: "test-ws",
        name: "Test Set",
        content: "Content",
        variant_count: 1,
      });

      expect(mockPrisma.creativeSet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            seedContent: "Content",
            generationPrompt: "Content",
          }),
        }),
      );
    });
  });

  describe("creative_detect_fatigue", () => {
    it("should return fatigue alerts", async () => {
      mockPrisma.creativeFatigueAlert.findMany.mockResolvedValue([
        {
          variantId: "cv-1",
          ctrDecayPercent: 25,
          daysActive: 14,
          recommendedAction: "Refresh creative content",
          isResolved: false,
          detectedAt: new Date("2025-06-01"),
        },
      ]);

      const handler = registry.handlers.get("creative_detect_fatigue")!;
      const result = await handler({ workspace_slug: "test-ws" });

      const text = getText(result);
      expect(text).toContain("Creative Fatigue Alerts");
      expect(text).toContain("cv-1");
      expect(text).toContain("25%");
      expect(text).toContain("14");
      expect(text).toContain("Refresh creative content");
    });

    it("should return empty message when no alerts", async () => {
      mockPrisma.creativeFatigueAlert.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("creative_detect_fatigue")!;
      const result = await handler({ workspace_slug: "test-ws" });

      expect(getText(result)).toContain("No active fatigue alerts found");
    });

    it("should respect limit parameter", async () => {
      mockPrisma.creativeFatigueAlert.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("creative_detect_fatigue")!;
      await handler({ workspace_slug: "test-ws", limit: 5 });

      expect(mockPrisma.creativeFatigueAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  describe("creative_get_performance", () => {
    it("should return performance metrics for variants", async () => {
      mockPrisma.creativeSet.findFirst.mockResolvedValue({
        id: "cs-1",
        variants: [
          {
            id: "cv-1",
            impressions: 1000,
            clicks: 50,
            conversions: 10,
            performanceHistory: [],
          },
          {
            id: "cv-2",
            impressions: 1000,
            clicks: 80,
            conversions: 15,
            performanceHistory: [],
          },
        ],
      });

      const handler = registry.handlers.get("creative_get_performance")!;
      const result = await handler({
        workspace_slug: "test-ws",
        creative_set_id: "cs-1",
      });

      const text = getText(result);
      expect(text).toContain("Creative Performance");
      expect(text).toContain("cv-1");
      expect(text).toContain("cv-2");
      expect(text).toContain("5.00%");
      expect(text).toContain("8.00%");
    });

    it("should handle variant with zero impressions", async () => {
      mockPrisma.creativeSet.findFirst.mockResolvedValue({
        id: "cs-1",
        variants: [{
          id: "cv-1",
          impressions: 0,
          clicks: 0,
          conversions: 0,
          performanceHistory: [],
        }],
      });

      const handler = registry.handlers.get("creative_get_performance")!;
      const result = await handler({
        workspace_slug: "test-ws",
        creative_set_id: "cs-1",
      });

      const text = getText(result);
      expect(text).toContain("cv-1");
      expect(text).toContain("0.00%");
    });

    it("should return NOT_FOUND for missing creative set", async () => {
      mockPrisma.creativeSet.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("creative_get_performance")!;
      const result = await handler({
        workspace_slug: "test-ws",
        creative_set_id: "nonexistent",
      });

      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should handle zero impressions gracefully", async () => {
      mockPrisma.creativeSet.findFirst.mockResolvedValue({
        id: "cs-1",
        variants: [
          {
            id: "cv-1",
            impressions: 0,
            clicks: 0,
            conversions: 0,
            performanceHistory: [],
          },
        ],
      });

      const handler = registry.handlers.get("creative_get_performance")!;
      const result = await handler({
        workspace_slug: "test-ws",
        creative_set_id: "cs-1",
      });

      expect(getText(result)).toContain("0.00%");
    });
  });

  describe("creative_list_sets", () => {
    it("should list creative sets with variant counts", async () => {
      mockPrisma.creativeSet.findMany.mockResolvedValue([
        {
          id: "cs-1",
          name: "Summer Campaign",
          status: "ACTIVE",
          createdAt: new Date("2025-06-01"),
          _count: { variants: 3 },
        },
        {
          id: "cs-2",
          name: "Winter Campaign",
          status: "DRAFT",
          createdAt: new Date("2025-06-02"),
          _count: { variants: 5 },
        },
      ]);

      const handler = registry.handlers.get("creative_list_sets")!;
      const result = await handler({ workspace_slug: "test-ws" });

      const text = getText(result);
      expect(text).toContain("Creative Sets");
      expect(text).toContain("cs-1");
      expect(text).toContain("Summer Campaign");
      expect(text).toContain("3");
      expect(text).toContain("cs-2");
      expect(text).toContain("Winter Campaign");
      expect(text).toContain("5");
    });

    it("should return empty message when no sets", async () => {
      mockPrisma.creativeSet.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("creative_list_sets")!;
      const result = await handler({ workspace_slug: "test-ws" });

      expect(getText(result)).toContain("No creative sets found");
    });

    it("should respect limit parameter", async () => {
      mockPrisma.creativeSet.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("creative_list_sets")!;
      await handler({ workspace_slug: "test-ws", limit: 5 });

      expect(mockPrisma.creativeSet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });
});
