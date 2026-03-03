import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  enhancedImage: {
    findMany: vi.fn(),
  },
  imageEnhancementJob: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

// Mock credits
const mockHasEnoughCredits = vi.fn();
const mockConsumeCredits = vi.fn();
const mockGetBalance = vi.fn();

vi.mock("@/lib/credits/workspace-credit-manager", () => ({
  WorkspaceCreditManager: {
    hasEnoughCredits: (...args: unknown[]) => mockHasEnoughCredits(...args),
    consumeCredits: (...args: unknown[]) => mockConsumeCredits(...args),
    getBalance: (...args: unknown[]) => mockGetBalance(...args),
  },
}));

vi.mock("@/lib/credits/costs", () => ({
  ENHANCEMENT_COSTS: {
    FREE: 0,
    TIER_1K: 2,
    TIER_2K: 5,
    TIER_4K: 10,
  },
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerBatchEnhanceTools } from "./batch-enhance";

describe("batch-enhance tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerBatchEnhanceTools(registry, userId);
  });

  it("should register 3 batch-enhance tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.handlers.has("batch_enhance_images")).toBe(true);
    expect(registry.handlers.has("batch_enhance_cost_preview")).toBe(true);
    expect(registry.handlers.has("batch_enhance_status")).toBe(true);
  });

  describe("batch_enhance_images", () => {
    it("should enhance batch successfully", async () => {
      mockPrisma.enhancedImage.findMany.mockResolvedValue([
        { id: "img-1" },
        { id: "img-2" },
        { id: "img-3" },
      ]);
      mockHasEnoughCredits.mockResolvedValue(true);
      mockConsumeCredits.mockResolvedValue({
        success: true,
        remaining: 94,
      });

      const handler = registry.handlers.get("batch_enhance_images")!;
      const result = await handler({
        image_ids: ["img-1", "img-2", "img-3"],
        tier: "TIER_1K",
      });

      const text = getText(result);
      expect(text).toContain("Batch Enhancement Started!");
      expect(text).toContain("Images:** 3");
      expect(text).toContain("Total Cost:** 6");
      expect(text).toContain("New Balance:** 94");
      expect(mockHasEnoughCredits).toHaveBeenCalledWith(userId, 6);
      expect(mockConsumeCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          amount: 6,
          source: "batch_image_enhancement",
        }),
      );
    });

    it("should return error if images not found", async () => {
      mockPrisma.enhancedImage.findMany.mockResolvedValue([{ id: "img-1" }]); // Only 1 found

      const handler = registry.handlers.get("batch_enhance_images")!;
      const result = await handler({
        image_ids: ["img-1", "img-2"],
        tier: "TIER_1K",
      });

      expect(getText(result)).toContain("VALIDATION_ERROR");
    });

    it("should return error if insufficient credits", async () => {
      mockPrisma.enhancedImage.findMany.mockResolvedValue([
        { id: "img-1" },
        { id: "img-2" },
      ]);
      mockHasEnoughCredits.mockResolvedValue(false);

      const handler = registry.handlers.get("batch_enhance_images")!;
      const result = await handler({
        image_ids: ["img-1", "img-2"],
        tier: "TIER_4K",
      });

      const text = getText(result);
      expect(text).toContain("INSUFFICIENT_CREDITS");
      expect(text).toContain("20"); // 10 * 2 images
    });

    it("should return error if credit consumption fails", async () => {
      mockPrisma.enhancedImage.findMany.mockResolvedValue([{ id: "img-1" }]);
      mockHasEnoughCredits.mockResolvedValue(true);
      mockConsumeCredits.mockResolvedValue({
        success: false,
        remaining: 0,
        error: "Workspace billing error",
      });

      const handler = registry.handlers.get("batch_enhance_images")!;
      const result = await handler({
        image_ids: ["img-1"],
        tier: "TIER_1K",
      });

      const text = getText(result);
      expect(text).toContain("CREDIT_CONSUMPTION_FAILED");
      expect(text).toContain("Workspace billing error");
    });

    it("should fallback error message when consumeResult.error is undefined", async () => {
      mockPrisma.enhancedImage.findMany.mockResolvedValue([{ id: "img-1" }]);
      mockHasEnoughCredits.mockResolvedValue(true);
      mockConsumeCredits.mockResolvedValue({
        success: false,
        remaining: 0,
        error: undefined,
      });

      const handler = registry.handlers.get("batch_enhance_images")!;
      const result = await handler({
        image_ids: ["img-1"],
        tier: "TIER_1K",
      });

      const text = getText(result);
      expect(text).toContain("CREDIT_CONSUMPTION_FAILED");
      expect(text).toContain("Failed to consume credits");
    });

    it("should handle FREE tier with zero cost", async () => {
      mockPrisma.enhancedImage.findMany.mockResolvedValue([{ id: "img-1" }]);
      mockHasEnoughCredits.mockResolvedValue(true);
      mockConsumeCredits.mockResolvedValue({
        success: true,
        remaining: 100,
      });

      const handler = registry.handlers.get("batch_enhance_images")!;
      const result = await handler({
        image_ids: ["img-1"],
        tier: "FREE",
      });

      const text = getText(result);
      expect(text).toContain("Total Cost:** 0");
      expect(mockHasEnoughCredits).toHaveBeenCalledWith(userId, 0);
    });

    it("should calculate TIER_4K costs correctly", async () => {
      mockPrisma.enhancedImage.findMany.mockResolvedValue([
        { id: "img-1" },
        { id: "img-2" },
      ]);
      mockHasEnoughCredits.mockResolvedValue(true);
      mockConsumeCredits.mockResolvedValue({
        success: true,
        remaining: 80,
      });

      const handler = registry.handlers.get("batch_enhance_images")!;
      const result = await handler({
        image_ids: ["img-1", "img-2"],
        tier: "TIER_4K",
      });

      const text = getText(result);
      expect(text).toContain("Total Cost:** 20"); // 10 * 2
      expect(mockConsumeCredits).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 20 }),
      );
    });
  });

  describe("batch_enhance_cost_preview", () => {
    it("should show cost preview with enough credits", async () => {
      mockGetBalance.mockResolvedValue({
        remaining: 50,
        limit: 100,
        used: 50,
        tier: "PRO",
        workspaceId: "ws-1",
      });

      const handler = registry.handlers.get("batch_enhance_cost_preview")!;
      const result = await handler({
        image_ids: ["img-1", "img-2", "img-3"],
        tier: "TIER_2K",
      });

      const text = getText(result);
      expect(text).toContain("Cost Preview");
      expect(text).toContain("Images:** 3");
      expect(text).toContain("Per Image:** 5");
      expect(text).toContain("Total Cost:** 15");
      expect(text).toContain("Current Balance:** 50");
      expect(text).toContain("Can Afford:** Yes");
    });

    it("should show shortfall when insufficient credits", async () => {
      mockGetBalance.mockResolvedValue({
        remaining: 5,
        limit: 100,
        used: 95,
        tier: "FREE",
        workspaceId: "ws-1",
      });

      const handler = registry.handlers.get("batch_enhance_cost_preview")!;
      const result = await handler({
        image_ids: ["img-1", "img-2", "img-3"],
        tier: "TIER_4K",
      });

      const text = getText(result);
      expect(text).toContain("Can Afford:** No");
      expect(text).toContain("Shortfall:** 25"); // 30 - 5
    });

    it("should handle null balance", async () => {
      mockGetBalance.mockResolvedValue(null);

      const handler = registry.handlers.get("batch_enhance_cost_preview")!;
      const result = await handler({
        image_ids: ["img-1"],
        tier: "TIER_1K",
      });

      const text = getText(result);
      expect(text).toContain("Current Balance:** 0");
      expect(text).toContain("Can Afford:** No");
    });

    it("should show FREE tier costs zero", async () => {
      mockGetBalance.mockResolvedValue({
        remaining: 0,
        limit: 0,
        used: 0,
        tier: "FREE",
        workspaceId: "ws-1",
      });

      const handler = registry.handlers.get("batch_enhance_cost_preview")!;
      const result = await handler({
        image_ids: ["img-1", "img-2"],
        tier: "FREE",
      });

      const text = getText(result);
      expect(text).toContain("Per Image:** 0");
      expect(text).toContain("Total Cost:** 0");
      expect(text).toContain("Can Afford:** Yes");
    });
  });

  describe("batch_enhance_status", () => {
    it("should show status with mixed results", async () => {
      mockPrisma.imageEnhancementJob.findMany.mockResolvedValue([
        {
          id: "job-1",
          status: "COMPLETED",
          imageId: "img-1",
          tier: "TIER_1K",
          createdAt: new Date("2025-06-02"),
          processingCompletedAt: new Date(),
        },
        {
          id: "job-2",
          status: "FAILED",
          imageId: "img-2",
          tier: "TIER_1K",
          createdAt: new Date("2025-06-02"),
          processingCompletedAt: null,
        },
        {
          id: "job-3",
          status: "PROCESSING",
          imageId: "img-3",
          tier: "TIER_1K",
          createdAt: new Date("2025-06-02"),
          processingCompletedAt: null,
        },
      ]);

      const handler = registry.handlers.get("batch_enhance_status")!;
      const result = await handler({
        image_ids: ["img-1", "img-2", "img-3"],
      });

      const text = getText(result);
      expect(text).toContain("Batch Enhancement Status");
      expect(text).toContain("Total:** 3");
      expect(text).toContain("Completed:** 1");
      expect(text).toContain("Failed:** 1");
      expect(text).toContain("In Progress:** 1");
    });

    it("should return error if no jobs found", async () => {
      mockPrisma.imageEnhancementJob.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("batch_enhance_status")!;
      const result = await handler({ image_ids: ["img-1"] });

      expect(getText(result)).toContain("NO_JOBS_FOUND");
    });

    it("should show all completed status", async () => {
      mockPrisma.imageEnhancementJob.findMany.mockResolvedValue([
        {
          id: "job-1",
          status: "COMPLETED",
          imageId: "img-1",
          tier: "TIER_2K",
          createdAt: new Date("2025-06-02"),
          processingCompletedAt: new Date(),
        },
        {
          id: "job-2",
          status: "COMPLETED",
          imageId: "img-2",
          tier: "TIER_2K",
          createdAt: new Date("2025-06-02"),
          processingCompletedAt: new Date(),
        },
      ]);

      const handler = registry.handlers.get("batch_enhance_status")!;
      const result = await handler({ image_ids: ["img-1", "img-2"] });

      const text = getText(result);
      expect(text).toContain("Completed:** 2");
      expect(text).toContain("Failed:** 0");
      expect(text).toContain("In Progress:** 0");
    });

    it("should deduplicate by image, keeping most recent job", async () => {
      mockPrisma.imageEnhancementJob.findMany.mockResolvedValue([
        {
          id: "job-new",
          status: "COMPLETED",
          imageId: "img-1",
          tier: "TIER_1K",
          createdAt: new Date("2025-06-02"),
          processingCompletedAt: new Date(),
        },
        {
          id: "job-old",
          status: "FAILED",
          imageId: "img-1",
          tier: "TIER_1K",
          createdAt: new Date("2025-06-01"),
          processingCompletedAt: null,
        },
      ]);

      const handler = registry.handlers.get("batch_enhance_status")!;
      const result = await handler({ image_ids: ["img-1"] });

      const text = getText(result);
      // Only 1 unique image, most recent is COMPLETED
      expect(text).toContain("Total:** 1");
      expect(text).toContain("Completed:** 1");
    });
  });
});
