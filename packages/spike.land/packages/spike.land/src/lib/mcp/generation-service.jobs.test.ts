import { JobStatus, McpJobType } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock all external dependencies - CRITICAL: Mock AI APIs to prevent real calls
const {
  mockMcpGenerationJob,
  mockWorkspaceCreditManager,
  mockGeminiClient,
  mockUploadToR2,
  mockLogger,
} = vi
  .hoisted(() => ({
    mockMcpGenerationJob: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    mockWorkspaceCreditManager: {
      hasEnoughCredits: vi.fn(),
      consumeCredits: vi.fn(),
      refundCredits: vi.fn(),
    },
    mockGeminiClient: {
      generateImageWithGemini: vi.fn(),
      modifyImageWithGemini: vi.fn(),
      DEFAULT_MODEL: "gemini-3-pro-image-preview",
    },
    mockUploadToR2: vi.fn(),
    mockLogger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  }));

vi.mock("@/lib/logger", () => ({
  default: mockLogger,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    mcpGenerationJob: mockMcpGenerationJob,
  },
}));

vi.mock("@/lib/credits/workspace-credit-manager", () => ({
  WorkspaceCreditManager: mockWorkspaceCreditManager,
}));

// CRITICAL: Mock the Gemini client to prevent real AI API calls
vi.mock("@/lib/ai/gemini-client", () => ({
  generateImageWithGemini: mockGeminiClient.generateImageWithGemini,
  modifyImageWithGemini: mockGeminiClient.modifyImageWithGemini,
  DEFAULT_MODEL: mockGeminiClient.DEFAULT_MODEL,
}));

vi.mock("@/lib/storage/r2-client", () => ({
  uploadToR2: mockUploadToR2,
}));

// Mock sharp for image metadata
vi.mock("sharp", () => ({
  default: vi.fn().mockReturnValue({
    metadata: vi.fn().mockResolvedValue({ width: 1024, height: 1024 }),
  }),
}));

import {
  createGenerationJob,
  createModificationJob,
  getJob,
  getJobHistory,
} from "./generation-service";

describe("generation-service - job creation & queries", () => {
  const testUserId = "test-user-123";
  const testApiKeyId = "api-key-456";
  const testJobId = "job-789";
  const mockDate = new Date("2024-01-15T12:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations that might have been set by previous tests
    // This is needed because vi.clearAllMocks() only clears call history, not implementations
    mockGeminiClient.generateImageWithGemini.mockReset();
    mockGeminiClient.modifyImageWithGemini.mockReset();
    mockUploadToR2.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(async () => {
    // Flush all pending timers and async operations to prevent state leakage
    // between tests from background processing
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  describe("createGenerationJob", () => {
    it("should create a generation job when user has enough credits", async () => {
      mockMcpGenerationJob.count.mockResolvedValue(0); // No concurrent jobs
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.GENERATE,
        tier: "TIER_1K",
        creditsCost: 2,
        status: JobStatus.PROCESSING,
      });

      const result = await createGenerationJob({
        userId: testUserId,
        apiKeyId: testApiKeyId,
        prompt: "A beautiful sunset",
        tier: "TIER_1K",
      });

      expect(result.success).toBe(true);
      expect(result.jobId).toBe(testJobId);
      expect(result.creditsCost).toBe(2);
      expect(mockWorkspaceCreditManager.consumeCredits).toHaveBeenCalledWith({
        userId: testUserId,
        amount: 2,
        source: "mcp_generation",
        sourceId: "pending",
      });
    });

    it("should reject when user has too many concurrent jobs", async () => {
      mockMcpGenerationJob.count.mockResolvedValue(3); // At max concurrent jobs

      const result = await createGenerationJob({
        userId: testUserId,
        prompt: "A beautiful sunset",
        tier: "TIER_1K",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Too many concurrent jobs");
      expect(mockWorkspaceCreditManager.consumeCredits).not.toHaveBeenCalled();
    });

    it("should reject when credit consumption fails", async () => {
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: false,
        error: "Insufficient credits",
      });

      const result = await createGenerationJob({
        userId: testUserId,
        prompt: "A beautiful sunset",
        tier: "TIER_2K",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient");
    });

    it("should use correct credit costs for each tier", async () => {
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: testJobId,
        status: JobStatus.PROCESSING,
      });

      // Test TIER_1K = 2 tokens
      await createGenerationJob({
        userId: testUserId,
        prompt: "test",
        tier: "TIER_1K",
      });
      expect(mockWorkspaceCreditManager.consumeCredits).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 2 }),
      );

      vi.clearAllMocks();

      // Test TIER_2K = 5 tokens
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: testJobId,
        status: JobStatus.PROCESSING,
      });

      await createGenerationJob({
        userId: testUserId,
        prompt: "test",
        tier: "TIER_2K",
      });
      expect(mockWorkspaceCreditManager.consumeCredits).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 5 }),
      );

      vi.clearAllMocks();

      // Test TIER_4K = 10 tokens
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: testJobId,
        status: JobStatus.PROCESSING,
      });

      await createGenerationJob({
        userId: testUserId,
        prompt: "test",
        tier: "TIER_4K",
      });
      expect(mockWorkspaceCreditManager.consumeCredits).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 10 }),
      );
    });
  });

  describe("createModificationJob", () => {
    it("should create a modification job when user has enough credits", async () => {
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_1K",
        creditsCost: 2,
        status: JobStatus.PROCESSING,
      });

      const result = await createModificationJob({
        userId: testUserId,
        apiKeyId: testApiKeyId,
        prompt: "Add a rainbow",
        tier: "TIER_1K",
        imageData: "base64imagedata",
        mimeType: "image/jpeg",
      });

      expect(result.success).toBe(true);
      expect(result.jobId).toBe(testJobId);
      expect(mockWorkspaceCreditManager.consumeCredits).toHaveBeenCalledWith({
        userId: testUserId,
        amount: 2,
        source: "mcp_generation",
        sourceId: "pending",
      });
    });

    it("should reject when user has too many concurrent jobs", async () => {
      mockMcpGenerationJob.count.mockResolvedValue(3); // At max concurrent jobs

      const result = await createModificationJob({
        userId: testUserId,
        prompt: "Add a rainbow",
        tier: "TIER_1K",
        imageData: "base64imagedata",
        mimeType: "image/jpeg",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Too many concurrent jobs");
      expect(mockWorkspaceCreditManager.consumeCredits).not.toHaveBeenCalled();
    });
  });

  describe("getJob", () => {
    it("should return job details", async () => {
      const mockJob = {
        id: testJobId,
        type: McpJobType.GENERATE,
        tier: "TIER_1K",
        creditsCost: 2,
        status: JobStatus.COMPLETED,
        prompt: "A beautiful sunset",
        outputImageUrl: "https://example.com/image.jpg",
        createdAt: mockDate,
      };

      mockMcpGenerationJob.findFirst.mockResolvedValue(mockJob);

      const result = await getJob(testJobId, testUserId);

      expect(result).toEqual(mockJob);
      expect(mockMcpGenerationJob.findFirst).toHaveBeenCalledWith({
        where: { id: testJobId, userId: testUserId },
        select: expect.any(Object),
      });
    });

    it("should return null for non-existent job", async () => {
      mockMcpGenerationJob.findFirst.mockResolvedValue(null);

      const result = await getJob("nonexistent", testUserId);

      expect(result).toBeNull();
    });

    it("should not return job for wrong user", async () => {
      mockMcpGenerationJob.findFirst.mockResolvedValue(null);

      const result = await getJob(testJobId, "wrong-user");

      expect(result).toBeNull();
    });
  });

  describe("getJobHistory", () => {
    it("should return paginated job history", async () => {
      const mockJobs = [
        {
          id: "job1",
          type: McpJobType.GENERATE,
          tier: "TIER_1K",
          creditsCost: 2,
          status: JobStatus.COMPLETED,
          prompt: "Test prompt 1",
          createdAt: mockDate,
          processingCompletedAt: mockDate,
          apiKey: { name: "Test Key" },
        },
        {
          id: "job2",
          type: McpJobType.MODIFY,
          tier: "TIER_2K",
          creditsCost: 5,
          status: JobStatus.COMPLETED,
          prompt: "Test prompt 2",
          createdAt: mockDate,
          processingCompletedAt: null,
          apiKey: null,
        },
      ];

      mockMcpGenerationJob.findMany.mockResolvedValue(mockJobs);
      mockMcpGenerationJob.count.mockResolvedValue(10);

      const result = await getJobHistory(testUserId, { limit: 20, offset: 0 });

      expect(result.jobs).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.hasMore).toBe(false);
      expect(result.jobs[0]!.apiKeyName).toBe("Test Key");
      expect(result.jobs[1]!.apiKeyName).toBeNull();
    });

    it("should filter by job type", async () => {
      mockMcpGenerationJob.findMany.mockResolvedValue([]);
      mockMcpGenerationJob.count.mockResolvedValue(0);

      await getJobHistory(testUserId, { type: McpJobType.GENERATE });

      expect(mockMcpGenerationJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: testUserId, type: McpJobType.GENERATE },
        }),
      );
    });

    it("should handle pagination correctly", async () => {
      mockMcpGenerationJob.findMany.mockResolvedValue([]);
      mockMcpGenerationJob.count.mockResolvedValue(50);

      const result = await getJobHistory(testUserId, { limit: 20, offset: 0 });

      expect(result.hasMore).toBe(true);
    });

    it("should use default options when none provided", async () => {
      mockMcpGenerationJob.findMany.mockResolvedValue([]);
      mockMcpGenerationJob.count.mockResolvedValue(0);

      const result = await getJobHistory(testUserId);

      expect(result.jobs).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
      // Verify default limit=20 and offset=0
      expect(mockMcpGenerationJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 0,
        }),
      );
    });
  });

  describe("concurrent job limit enforcement", () => {
    it("should enforce MAX_CONCURRENT_JOBS_PER_USER = 3", async () => {
      // Test with exactly 3 concurrent jobs (should be rejected)
      mockMcpGenerationJob.count.mockResolvedValue(3);

      const result = await createGenerationJob({
        userId: testUserId,
        prompt: "test",
        tier: "TIER_1K",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Maximum 3 jobs");
    });

    it("should allow job when under concurrent limit", async () => {
      // Test with 2 concurrent jobs (should be allowed)
      mockMcpGenerationJob.count.mockResolvedValue(2);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: testJobId,
        status: JobStatus.PROCESSING,
      });

      const result = await createGenerationJob({
        userId: testUserId,
        prompt: "test",
        tier: "TIER_1K",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("AI API mocking verification", () => {
    it("should NOT call real Gemini API during tests", async () => {
      // This test verifies that the mock is in place
      // If the real API was called, we would get actual network errors
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: testJobId,
        status: JobStatus.PROCESSING,
      });
      // Set up mock to reject so background processing fails quickly without leaving stale state
      mockGeminiClient.generateImageWithGemini.mockRejectedValue(
        new Error("Mock - not configured for this test"),
      );
      mockMcpGenerationJob.update.mockResolvedValue({});
      mockMcpGenerationJob.findUnique.mockResolvedValue(null);

      // The job creation should succeed without calling the real API
      // (the background processing is not awaited)
      const result = await createGenerationJob({
        userId: testUserId,
        prompt: "test",
        tier: "TIER_1K",
      });

      expect(result.success).toBe(true);
      // Verify the mock Gemini functions are available
      expect(mockGeminiClient.generateImageWithGemini).toBeDefined();
      expect(mockGeminiClient.modifyImageWithGemini).toBeDefined();

      // Wait for background processing to complete to avoid state leakage to next test
      await vi.advanceTimersByTimeAsync(100);
    });
  });

  describe("getJob without userId", () => {
    it("should return job when userId is not provided", async () => {
      const mockJob = {
        id: testJobId,
        type: McpJobType.GENERATE,
        tier: "TIER_1K",
        creditsCost: 2,
        status: JobStatus.COMPLETED,
        prompt: "A beautiful sunset",
        outputImageUrl: "https://example.com/image.jpg",
        createdAt: mockDate,
      };

      mockMcpGenerationJob.findFirst.mockResolvedValue(mockJob);

      // Call getJob without userId
      const result = await getJob(testJobId);

      expect(result).toEqual(mockJob);
      // Verify where clause doesn't include userId
      expect(mockMcpGenerationJob.findFirst).toHaveBeenCalledWith({
        where: { id: testJobId },
        select: expect.any(Object),
      });
    });
  });

  describe("credit consumption edge cases", () => {
    it("should use default error message when consumeCredits returns no error", async () => {
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: false,
        // No error property
      });

      const result = await createGenerationJob({
        userId: testUserId,
        prompt: "A beautiful sunset",
        tier: "TIER_2K",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Insufficient AI credits. Required: 5 credits",
      );
    });

    it("should use default error for modification when consumeCredits returns no error", async () => {
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: false,
        // No error property
      });

      const result = await createModificationJob({
        userId: testUserId,
        prompt: "Add a rainbow",
        tier: "TIER_4K",
        imageData: "base64imagedata",
        mimeType: "image/jpeg",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Insufficient AI credits. Required: 10 credits",
      );
    });
  });

  describe("job creation without apiKeyId", () => {
    it("should create generation job with null apiKeyId when not provided", async () => {
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.GENERATE,
        tier: "TIER_1K",
        creditsCost: 2,
        status: JobStatus.PROCESSING,
      });

      // Call without apiKeyId
      await createGenerationJob({
        userId: testUserId,
        prompt: "A beautiful sunset",
        tier: "TIER_1K",
      });

      expect(mockMcpGenerationJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          apiKeyId: null,
        }),
      });
    });

    it("should create modification job with null apiKeyId when not provided", async () => {
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_1K",
        creditsCost: 2,
        status: JobStatus.PROCESSING,
      });

      // Call without apiKeyId
      await createModificationJob({
        userId: testUserId,
        prompt: "Add a rainbow",
        tier: "TIER_1K",
        imageData: "base64imagedata",
        mimeType: "image/jpeg",
      });

      expect(mockMcpGenerationJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          apiKeyId: null,
        }),
      });
    });
  });
});
