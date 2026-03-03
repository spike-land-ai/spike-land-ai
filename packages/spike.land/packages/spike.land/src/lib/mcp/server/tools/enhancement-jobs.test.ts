import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  enhancedImage: {
    findUnique: vi.fn(),
  },
  imageEnhancementJob: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

// Mock credits
const mockHasEnoughCredits = vi.fn();
const mockConsumeCredits = vi.fn();
const mockRefundCredits = vi.fn();
const mockGetBalance = vi.fn();

vi.mock("@/lib/credits/workspace-credit-manager", () => ({
  WorkspaceCreditManager: {
    hasEnoughCredits: (...args: unknown[]) => mockHasEnoughCredits(...args),
    consumeCredits: (...args: unknown[]) => mockConsumeCredits(...args),
    refundCredits: (...args: unknown[]) => mockRefundCredits(...args),
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
import { registerEnhancementJobsTools } from "./enhancement-jobs";

describe("enhancement-jobs tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerEnhancementJobsTools(registry, userId);
  });

  it("should register 4 enhancement-jobs tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.handlers.has("enhance_image")).toBe(true);
    expect(registry.handlers.has("cancel_enhancement_job")).toBe(true);
    expect(registry.handlers.has("get_enhancement_job")).toBe(true);
    expect(registry.handlers.has("list_enhancement_jobs")).toBe(true);
  });

  describe("enhance_image", () => {
    it("should start enhancement successfully", async () => {
      mockPrisma.enhancedImage.findUnique.mockResolvedValue({
        id: "img-1",
        userId,
      });
      mockHasEnoughCredits.mockResolvedValue(true);
      mockConsumeCredits.mockResolvedValue({
        success: true,
        remaining: 98,
      });
      mockPrisma.imageEnhancementJob.create.mockResolvedValue({
        id: "job-1",
      });

      const handler = registry.handlers.get("enhance_image")!;
      const result = await handler({
        image_id: "img-1",
        tier: "TIER_1K",
      });

      const text = getText(result);
      expect(text).toContain("Enhancement Started!");
      expect(text).toContain("job-1");
      expect(text).toContain("Credit Cost:** 2");
      expect(mockConsumeCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          amount: 2,
          source: "image_enhancement",
          sourceId: "img-1",
        }),
      );
    });

    it("should handle FREE tier without credit consumption", async () => {
      mockPrisma.enhancedImage.findUnique.mockResolvedValue({
        id: "img-1",
        userId,
      });
      mockPrisma.imageEnhancementJob.create.mockResolvedValue({
        id: "job-free",
      });

      const handler = registry.handlers.get("enhance_image")!;
      const result = await handler({
        image_id: "img-1",
        tier: "FREE",
      });

      const text = getText(result);
      expect(text).toContain("Credit Cost:** 0");
      expect(mockHasEnoughCredits).not.toHaveBeenCalled();
      expect(mockConsumeCredits).not.toHaveBeenCalled();
    });

    it("should return error if image not found", async () => {
      mockPrisma.enhancedImage.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("enhance_image")!;
      const result = await handler({
        image_id: "no-img",
        tier: "TIER_1K",
      });

      expect(getText(result)).toContain("IMAGE_NOT_FOUND");
    });

    it("should return error if image belongs to another user", async () => {
      mockPrisma.enhancedImage.findUnique.mockResolvedValue({
        id: "img-1",
        userId: "other-user",
      });

      const handler = registry.handlers.get("enhance_image")!;
      const result = await handler({
        image_id: "img-1",
        tier: "TIER_1K",
      });

      expect(getText(result)).toContain("IMAGE_NOT_FOUND");
    });

    it("should return error if insufficient credits", async () => {
      mockPrisma.enhancedImage.findUnique.mockResolvedValue({
        id: "img-1",
        userId,
      });
      mockHasEnoughCredits.mockResolvedValue(false);

      const handler = registry.handlers.get("enhance_image")!;
      const result = await handler({
        image_id: "img-1",
        tier: "TIER_4K",
      });

      const text = getText(result);
      expect(text).toContain("INSUFFICIENT_CREDITS");
      expect(text).toContain("10");
    });

    it("should return error if credit consumption fails", async () => {
      mockPrisma.enhancedImage.findUnique.mockResolvedValue({
        id: "img-1",
        userId,
      });
      mockHasEnoughCredits.mockResolvedValue(true);
      mockConsumeCredits.mockResolvedValue({
        success: false,
        remaining: 0,
        error: "Billing error",
      });

      const handler = registry.handlers.get("enhance_image")!;
      const result = await handler({
        image_id: "img-1",
        tier: "TIER_2K",
      });

      expect(getText(result)).toContain("CREDIT_CONSUMPTION_FAILED");
    });
  });

  describe("cancel_enhancement_job", () => {
    it("should cancel PENDING job and refund credits", async () => {
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue({
        id: "job-1",
        userId,
        status: "PENDING",
        creditsCost: 5,
      });
      mockPrisma.imageEnhancementJob.update.mockResolvedValue({});
      mockRefundCredits.mockResolvedValue(true);
      mockGetBalance.mockResolvedValue({ remaining: 105 });

      const handler = registry.handlers.get("cancel_enhancement_job")!;
      const result = await handler({ job_id: "job-1" });

      const text = getText(result);
      expect(text).toContain("Job Cancelled!");
      expect(text).toContain("Credits Refunded:** 5");
      expect(text).toContain("New Balance:** 105");
      expect(mockRefundCredits).toHaveBeenCalledWith(userId, 5);
    });

    it("should cancel PROCESSING job", async () => {
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue({
        id: "job-2",
        userId,
        status: "PROCESSING",
        creditsCost: 10,
      });
      mockPrisma.imageEnhancementJob.update.mockResolvedValue({});
      mockRefundCredits.mockResolvedValue(true);
      mockGetBalance.mockResolvedValue({ remaining: 110 });

      const handler = registry.handlers.get("cancel_enhancement_job")!;
      const result = await handler({ job_id: "job-2" });

      expect(getText(result)).toContain("Job Cancelled!");
    });

    it("should return error for COMPLETED job", async () => {
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue({
        id: "job-3",
        userId,
        status: "COMPLETED",
        creditsCost: 5,
      });

      const handler = registry.handlers.get("cancel_enhancement_job")!;
      const result = await handler({ job_id: "job-3" });

      const text = getText(result);
      expect(text).toContain("INVALID_STATUS");
      expect(text).toContain("COMPLETED");
    });

    it("should return error for CANCELLED job", async () => {
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue({
        id: "job-4",
        userId,
        status: "CANCELLED",
        creditsCost: 5,
      });

      const handler = registry.handlers.get("cancel_enhancement_job")!;
      const result = await handler({ job_id: "job-4" });

      expect(getText(result)).toContain("INVALID_STATUS");
    });

    it("should return error for FAILED job", async () => {
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue({
        id: "job-5",
        userId,
        status: "FAILED",
        creditsCost: 5,
      });

      const handler = registry.handlers.get("cancel_enhancement_job")!;
      const result = await handler({ job_id: "job-5" });

      expect(getText(result)).toContain("INVALID_STATUS");
    });

    it("should return error if job not found", async () => {
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("cancel_enhancement_job")!;
      const result = await handler({ job_id: "no-job" });

      expect(getText(result)).toContain("JOB_NOT_FOUND");
    });

    it("should return error if job belongs to another user", async () => {
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue({
        id: "job-6",
        userId: "other-user",
        status: "PENDING",
        creditsCost: 5,
      });

      const handler = registry.handlers.get("cancel_enhancement_job")!;
      const result = await handler({ job_id: "job-6" });

      expect(getText(result)).toContain("JOB_NOT_FOUND");
    });

    it("should warn if refund fails", async () => {
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue({
        id: "job-7",
        userId,
        status: "PENDING",
        creditsCost: 5,
      });
      mockPrisma.imageEnhancementJob.update.mockResolvedValue({});
      mockRefundCredits.mockResolvedValue(false);

      const handler = registry.handlers.get("cancel_enhancement_job")!;
      const result = await handler({ job_id: "job-7" });

      const text = getText(result);
      expect(text).toContain("REFUND_FAILED");
      expect(text).toContain("contact support");
    });
  });

  describe("get_enhancement_job", () => {
    it("should return job details", async () => {
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue({
        id: "job-1",
        userId,
        status: "COMPLETED",
        tier: "TIER_2K",
        creditsCost: 5,
        enhancedUrl: "https://example.com/enhanced.jpg",
        enhancedWidth: 2048,
        enhancedHeight: 1536,
        errorMessage: null,
        createdAt: new Date("2025-06-01"),
        processingStartedAt: new Date("2025-06-01T00:00:01Z"),
        processingCompletedAt: new Date("2025-06-01T00:00:30Z"),
        image: {
          id: "img-1",
          name: "My Photo",
          originalUrl: "https://example.com/original.jpg",
        },
      });

      const handler = registry.handlers.get("get_enhancement_job")!;
      const result = await handler({ job_id: "job-1" });

      const text = getText(result);
      expect(text).toContain("Enhancement Job: job-1");
      expect(text).toContain("Status:** COMPLETED");
      expect(text).toContain("Tier:** TIER_2K");
      expect(text).toContain("Credits Cost:** 5");
      expect(text).toContain("My Photo");
      expect(text).toContain("Enhanced URL");
      expect(text).toContain("2048x1536");
    });

    it("should show error message for failed job", async () => {
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue({
        id: "job-2",
        userId,
        status: "FAILED",
        tier: "TIER_4K",
        creditsCost: 10,
        enhancedUrl: null,
        enhancedWidth: null,
        enhancedHeight: null,
        errorMessage: "Provider timeout",
        createdAt: new Date("2025-06-01"),
        processingStartedAt: new Date("2025-06-01T00:00:01Z"),
        processingCompletedAt: null,
        image: {
          id: "img-2",
          name: "Failed Photo",
          originalUrl: "https://example.com/fail.jpg",
        },
      });

      const handler = registry.handlers.get("get_enhancement_job")!;
      const result = await handler({ job_id: "job-2" });

      const text = getText(result);
      expect(text).toContain("FAILED");
      expect(text).toContain("Provider timeout");
    });

    it("should return error if job not found", async () => {
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("get_enhancement_job")!;
      const result = await handler({ job_id: "no-job" });

      expect(getText(result)).toContain("JOB_NOT_FOUND");
    });

    it("should return error if job belongs to another user", async () => {
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue({
        id: "job-3",
        userId: "other-user",
        status: "COMPLETED",
        image: { id: "img-1", name: "x", originalUrl: "x" },
      });

      const handler = registry.handlers.get("get_enhancement_job")!;
      const result = await handler({ job_id: "job-3" });

      expect(getText(result)).toContain("JOB_NOT_FOUND");
    });
  });

  describe("list_enhancement_jobs", () => {
    it("should list jobs with default filters", async () => {
      mockPrisma.imageEnhancementJob.findMany.mockResolvedValue([
        {
          id: "job-1",
          status: "COMPLETED",
          tier: "TIER_1K",
          creditsCost: 2,
          imageId: "img-1",
          createdAt: new Date("2025-06-01"),
          enhancedUrl: "https://example.com/1.jpg",
        },
        {
          id: "job-2",
          status: "FAILED",
          tier: "TIER_2K",
          creditsCost: 5,
          imageId: "img-2",
          createdAt: new Date("2025-06-02"),
          enhancedUrl: null,
        },
      ]);

      const handler = registry.handlers.get("list_enhancement_jobs")!;
      const result = await handler({ limit: 20 });

      const text = getText(result);
      expect(text).toContain("Enhancement Jobs (2)");
      expect(text).toContain("job-1");
      expect(text).toContain("COMPLETED");
      expect(text).toContain("job-2");
      expect(text).toContain("FAILED");
      expect(text).toContain("Enhanced"); // job-1 has enhancedUrl
    });

    it("should filter by image_id", async () => {
      mockPrisma.imageEnhancementJob.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("list_enhancement_jobs")!;
      await handler({ image_id: "img-1", limit: 10 });

      expect(mockPrisma.imageEnhancementJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            imageId: "img-1",
          }),
        }),
      );
    });

    it("should filter by status", async () => {
      mockPrisma.imageEnhancementJob.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("list_enhancement_jobs")!;
      await handler({ status: "COMPLETED", limit: 10 });

      expect(mockPrisma.imageEnhancementJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            status: "COMPLETED",
          }),
        }),
      );
    });

    it("should show empty message when no jobs", async () => {
      mockPrisma.imageEnhancementJob.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("list_enhancement_jobs")!;
      const result = await handler({ limit: 20 });

      expect(getText(result)).toContain("Enhancement Jobs (0)");
    });

    it("should respect limit parameter", async () => {
      mockPrisma.imageEnhancementJob.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("list_enhancement_jobs")!;
      await handler({ limit: 5 });

      expect(mockPrisma.imageEnhancementJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it("should filter by both image_id and status", async () => {
      mockPrisma.imageEnhancementJob.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("list_enhancement_jobs")!;
      await handler({ image_id: "img-1", status: "PROCESSING", limit: 10 });

      expect(mockPrisma.imageEnhancementJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            imageId: "img-1",
            status: "PROCESSING",
          }),
        }),
      );
    });
  });

  describe("cancel_enhancement_job - REFUNDED status", () => {
    it("should return error for REFUNDED job", async () => {
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue({
        id: "job-8",
        userId,
        status: "REFUNDED",
        creditsCost: 5,
      });

      const handler = registry.handlers.get("cancel_enhancement_job")!;
      const result = await handler({ job_id: "job-8" });

      expect(getText(result)).toContain("INVALID_STATUS");
      expect(getText(result)).toContain("REFUNDED");
    });
  });

  describe("enhance_image - credit consumption failure with no error message", () => {
    it("should show fallback error when consumeResult.error is undefined", async () => {
      mockPrisma.enhancedImage.findUnique.mockResolvedValue({
        id: "img-1",
        userId,
      });
      mockHasEnoughCredits.mockResolvedValue(true);
      mockConsumeCredits.mockResolvedValue({
        success: false,
        remaining: 0,
      });

      const handler = registry.handlers.get("enhance_image")!;
      const result = await handler({
        image_id: "img-1",
        tier: "TIER_1K",
      });

      expect(getText(result)).toContain("CREDIT_CONSUMPTION_FAILED");
      expect(getText(result)).toContain("Failed to consume credits");
    });
  });

  describe("get_enhancement_job - minimal job details", () => {
    it("should show job without optional fields", async () => {
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue({
        id: "job-min",
        userId,
        status: "PENDING",
        tier: "FREE",
        creditsCost: 0,
        enhancedUrl: null,
        enhancedWidth: null,
        enhancedHeight: null,
        errorMessage: null,
        createdAt: new Date("2025-06-01"),
        processingStartedAt: null,
        processingCompletedAt: null,
        image: {
          id: "img-3",
          name: "Simple Photo",
          originalUrl: "https://example.com/simple.jpg",
        },
      });

      const handler = registry.handlers.get("get_enhancement_job")!;
      const result = await handler({ job_id: "job-min" });

      const text = getText(result);
      expect(text).toContain("Status:** PENDING");
      expect(text).toContain("Simple Photo");
      expect(text).not.toContain("Enhanced URL");
      expect(text).not.toContain("Enhanced Size");
      expect(text).not.toContain("Error:**");
      expect(text).not.toContain("Processing Started");
      expect(text).not.toContain("Processing Completed");
    });
  });

  describe("cancel_enhancement_job - null balance on refund", () => {
    it("should show 0 when getBalance returns null after refund", async () => {
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue({
        id: "job-9",
        userId,
        status: "PROCESSING",
        creditsCost: 5,
      });
      mockPrisma.imageEnhancementJob.update.mockResolvedValue({});
      mockRefundCredits.mockResolvedValue(true);
      mockGetBalance.mockResolvedValue(null);

      const handler = registry.handlers.get("cancel_enhancement_job")!;
      const result = await handler({ job_id: "job-9" });

      const text = getText(result);
      expect(text).toContain("Job Cancelled!");
      expect(text).toContain("New Balance:** 0");
    });
  });
});
