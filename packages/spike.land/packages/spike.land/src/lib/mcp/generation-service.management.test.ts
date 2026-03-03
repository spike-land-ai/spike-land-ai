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
  cancelMcpJob,
  rerunMcpJob,
} from "./generation-service";

describe("generation-service - job management (cancel & rerun)", () => {
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

  describe("cancelMcpJob", () => {
    it("should cancel a PENDING job and refund credits", async () => {
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        status: JobStatus.PENDING,
        creditsCost: 5,
      });
      mockMcpGenerationJob.update.mockResolvedValue({});
      mockWorkspaceCreditManager.refundCredits.mockResolvedValue({
        success: true,
      });

      const result = await cancelMcpJob(testJobId);

      expect(result.success).toBe(true);
      expect(result.creditsRefunded).toBe(5);
      expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
        where: { id: testJobId },
        data: expect.objectContaining({ status: JobStatus.CANCELLED }),
      });
      expect(mockWorkspaceCreditManager.refundCredits).toHaveBeenCalledWith(
        testUserId,
        5,
      );
    });

    it("should cancel a PROCESSING job", async () => {
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        status: JobStatus.PROCESSING,
        creditsCost: 10,
      });
      mockMcpGenerationJob.update.mockResolvedValue({});
      mockWorkspaceCreditManager.refundCredits.mockResolvedValue({
        success: true,
      });

      const result = await cancelMcpJob(testJobId);

      expect(result.success).toBe(true);
      expect(result.creditsRefunded).toBe(10);
      expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
        where: { id: testJobId },
        data: expect.objectContaining({ status: JobStatus.CANCELLED }),
      });
      expect(mockWorkspaceCreditManager.refundCredits).toHaveBeenCalledWith(
        testUserId,
        10,
      );
    });

    it("should return error for non-existent job", async () => {
      mockMcpGenerationJob.findUnique.mockResolvedValue(null);

      const result = await cancelMcpJob("nonexistent-job");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Job not found");
      expect(mockMcpGenerationJob.update).not.toHaveBeenCalled();
      expect(mockWorkspaceCreditManager.refundCredits).not.toHaveBeenCalled();
    });

    it("should return error for COMPLETED job", async () => {
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        status: JobStatus.COMPLETED,
        creditsCost: 5,
      });

      const result = await cancelMcpJob(testJobId);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot cancel job with status");
      expect(result.error).toContain("COMPLETED");
      expect(mockMcpGenerationJob.update).not.toHaveBeenCalled();
      expect(mockWorkspaceCreditManager.refundCredits).not.toHaveBeenCalled();
    });

    it("should return error for FAILED job", async () => {
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        status: JobStatus.FAILED,
        creditsCost: 5,
      });

      const result = await cancelMcpJob(testJobId);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot cancel job with status");
      expect(result.error).toContain("FAILED");
      expect(mockMcpGenerationJob.update).not.toHaveBeenCalled();
      expect(mockWorkspaceCreditManager.refundCredits).not.toHaveBeenCalled();
    });
  });

  describe("rerunMcpJob", () => {
    it("should rerun a GENERATE job", async () => {
      const newJobId = "new-job-123";
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.GENERATE,
        tier: "TIER_1K",
        creditsCost: 2,
        prompt: "A beautiful sunset",
        apiKeyId: testApiKeyId,
        inputImageUrl: null,
        inputImageR2Key: null,
        geminiModel: "gemini-3-pro-image-preview",
      });
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: newJobId,
        userId: testUserId,
        type: McpJobType.GENERATE,
        tier: "TIER_1K",
        creditsCost: 2,
        status: JobStatus.PROCESSING,
      });

      // Set up mocks for background processing
      const mockImageBuffer = Buffer.from("fake-rerun-image");
      mockGeminiClient.generateImageWithGemini.mockResolvedValue(
        mockImageBuffer,
      );
      mockUploadToR2.mockResolvedValue({
        url: "https://r2.example.com/rerun.jpg",
      });
      mockMcpGenerationJob.update.mockResolvedValue({});

      const result = await rerunMcpJob(testJobId);

      expect(result.success).toBe(true);
      expect(result.newJobId).toBe(newJobId);
      expect(mockWorkspaceCreditManager.consumeCredits).toHaveBeenCalledWith({
        userId: testUserId,
        amount: 2,
        source: "mcp_generation",
        sourceId: "pending",
      });

      // Wait for background processing to trigger
      await vi.advanceTimersByTimeAsync(100);

      expect(mockGeminiClient.generateImageWithGemini).toHaveBeenCalledWith({
        prompt: "A beautiful sunset",
        tier: "1K",
        negativePrompt: undefined,
        aspectRatio: undefined,
      });
    });

    it("should rerun a MODIFY job with input image", async () => {
      const newJobId = "new-modify-job-123";
      const originalInputUrl = "https://r2.example.com/original-input.jpg";
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_2K",
        creditsCost: 5,
        prompt: "Add a rainbow",
        apiKeyId: testApiKeyId,
        inputImageUrl: originalInputUrl,
        inputImageR2Key: "mcp-input/test-user/original.jpg",
        geminiModel: "gemini-3-pro-image-preview",
      });
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: newJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_2K",
        creditsCost: 5,
        status: JobStatus.PROCESSING,
      });

      // Mock fetch for retrieving the original input image
      const originalImageData = Buffer.from("original-image-data");
      const mockResponse = new Response(originalImageData, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
      const fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValue(mockResponse);

      // Set up mocks for background modification processing
      const mockModifiedBuffer = Buffer.from("modified-image-data");
      mockUploadToR2
        .mockResolvedValueOnce({ url: "https://r2.example.com/input.jpg" })
        .mockResolvedValueOnce({ url: "https://r2.example.com/output.jpg" });
      mockGeminiClient.modifyImageWithGemini.mockResolvedValue(
        mockModifiedBuffer,
      );
      mockMcpGenerationJob.update.mockResolvedValue({});

      const result = await rerunMcpJob(testJobId);

      expect(result.success).toBe(true);
      expect(result.newJobId).toBe(newJobId);

      // Wait for background processing
      await vi.advanceTimersByTimeAsync(100);

      expect(fetchSpy).toHaveBeenCalledWith(originalInputUrl);

      fetchSpy.mockRestore();
    });

    it("should return error for non-existent job", async () => {
      mockMcpGenerationJob.findUnique.mockResolvedValue(null);

      const result = await rerunMcpJob("nonexistent-job");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Job not found");
      expect(mockMcpGenerationJob.create).not.toHaveBeenCalled();
    });

    it("should return error when concurrent limit reached", async () => {
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.GENERATE,
        tier: "TIER_1K",
        creditsCost: 2,
        prompt: "test",
      });
      mockMcpGenerationJob.count.mockResolvedValue(3);

      const result = await rerunMcpJob(testJobId);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Too many concurrent jobs");
      expect(mockWorkspaceCreditManager.consumeCredits).not.toHaveBeenCalled();
    });

    it("should return error when credits insufficient", async () => {
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.GENERATE,
        tier: "TIER_1K",
        creditsCost: 2,
        prompt: "test",
      });
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: false,
        error: "Not enough credits",
      });

      const result = await rerunMcpJob(testJobId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not enough credits");
      expect(mockMcpGenerationJob.create).not.toHaveBeenCalled();
    });

    it("should use default error when consumeCredits returns no error string", async () => {
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.GENERATE,
        tier: "TIER_2K",
        creditsCost: 5,
        prompt: "test",
      });
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: false,
      });

      const result = await rerunMcpJob(testJobId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Insufficient AI credits. Required: 5 credits",
      );
    });
  });

  describe("rerunMcpJob - modification reruns", () => {
    it("should skip background processing when input image URL is null for MODIFY job", async () => {
      const newJobId = "new-modify-no-url";
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_1K",
        creditsCost: 2,
        prompt: "Add effect",
        apiKeyId: null,
        inputImageUrl: null,
        inputImageR2Key: null,
        geminiModel: "gemini-3-pro-image-preview",
      });
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: newJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_1K",
        creditsCost: 2,
        status: JobStatus.PROCESSING,
      });

      const result = await rerunMcpJob(testJobId);

      expect(result.success).toBe(true);
      expect(result.newJobId).toBe(newJobId);

      // Wait to confirm no background processing is triggered
      await vi.advanceTimersByTimeAsync(100);

      // Neither generation nor modification processing should have been called
      // because inputImageUrl is null and the else-if branch is skipped
      expect(mockGeminiClient.generateImageWithGemini).not.toHaveBeenCalled();
      expect(mockGeminiClient.modifyImageWithGemini).not.toHaveBeenCalled();
    });

    it("should handle fetch failure for input image", async () => {
      const newJobId = "new-modify-fetch-fail";
      const inputUrl = "https://r2.example.com/input.jpg";
      mockMcpGenerationJob.findUnique
        .mockResolvedValueOnce({
          id: testJobId,
          userId: testUserId,
          type: McpJobType.MODIFY,
          tier: "TIER_1K",
          creditsCost: 2,
          prompt: "Add effect",
          apiKeyId: null,
          inputImageUrl: inputUrl,
          inputImageR2Key: "mcp-input/key.jpg",
          geminiModel: "gemini-3-pro-image-preview",
        })
        // For handleGenerationJobFailure's findUnique call
        .mockResolvedValueOnce({
          id: newJobId,
          userId: testUserId,
          creditsCost: 2,
        });
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: newJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_1K",
        creditsCost: 2,
        status: JobStatus.PROCESSING,
      });
      mockMcpGenerationJob.update.mockResolvedValue({});
      mockWorkspaceCreditManager.refundCredits.mockResolvedValue({
        success: true,
      });

      // Mock fetch to return a non-ok response
      const fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValue(new Response(null, { status: 404 }));

      const result = await rerunMcpJob(testJobId);

      expect(result.success).toBe(true);
      expect(result.newJobId).toBe(newJobId);

      // Wait for background processing using waitFor to handle async microtasks
      await vi.waitFor(
        () => {
          expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
            where: { id: newJobId },
            data: expect.objectContaining({
              status: JobStatus.FAILED,
            }),
          });
        },
        { timeout: 1000 },
      );

      fetchSpy.mockRestore();
    });

    it("should handle fetch network error", async () => {
      const newJobId = "new-modify-network-error";
      const inputUrl = "https://r2.example.com/input.jpg";
      mockMcpGenerationJob.findUnique
        .mockResolvedValueOnce({
          id: testJobId,
          userId: testUserId,
          type: McpJobType.MODIFY,
          tier: "TIER_1K",
          creditsCost: 2,
          prompt: "Add effect",
          apiKeyId: null,
          inputImageUrl: inputUrl,
          inputImageR2Key: "mcp-input/key.jpg",
          geminiModel: "gemini-3-pro-image-preview",
        })
        // For handleGenerationJobFailure's findUnique call
        .mockResolvedValueOnce({
          id: newJobId,
          userId: testUserId,
          creditsCost: 2,
        });
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: newJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_1K",
        creditsCost: 2,
        status: JobStatus.PROCESSING,
      });
      mockMcpGenerationJob.update.mockResolvedValue({});
      mockWorkspaceCreditManager.refundCredits.mockResolvedValue({
        success: true,
      });

      // Mock fetch to throw a network error
      const fetchSpy = vi
        .spyOn(global, "fetch")
        .mockRejectedValue(new Error("Network error"));

      const result = await rerunMcpJob(testJobId);

      expect(result.success).toBe(true);
      expect(result.newJobId).toBe(newJobId);

      // Wait for background processing using waitFor to handle async microtasks
      await vi.waitFor(
        () => {
          expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
            where: { id: newJobId },
            data: expect.objectContaining({
              status: JobStatus.FAILED,
            }),
          });
        },
        { timeout: 1000 },
      );

      fetchSpy.mockRestore();
    });

    it("should log outer catch error when fetchAndProcessModification throws unexpectedly", async () => {
      const newJobId = "new-modify-unexpected-throw";
      const inputUrl = "https://r2.example.com/input.jpg";
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_1K",
        creditsCost: 2,
        prompt: "Add effect",
        apiKeyId: null,
        inputImageUrl: inputUrl,
        inputImageR2Key: "mcp-input/key.jpg",
        geminiModel: "gemini-3-pro-image-preview",
      });
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: newJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_1K",
        creditsCost: 2,
        status: JobStatus.PROCESSING,
      });

      // Mock fetch to return a response where arrayBuffer() throws,
      // which will cause fetchAndProcessModification to throw past the tryCatch
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockRejectedValue(new Error("arrayBuffer failed")),
        headers: new Headers({ "content-type": "image/jpeg" }),
      };
      const fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValue(mockResponse as unknown as Response);

      const result = await rerunMcpJob(testJobId);

      expect(result.success).toBe(true);
      expect(result.newJobId).toBe(newJobId);

      // Wait for the outer catch handler to fire
      await vi.waitFor(
        () => {
          expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(
              `Rerun modification job ${newJobId} failed`,
            ),
            expect.objectContaining({ error: expect.any(Error) }),
          );
        },
        { timeout: 1000 },
      );

      fetchSpy.mockRestore();
    });

    it("should use mimeType fallback to image/jpeg when content-type header is missing", async () => {
      const newJobId = "new-modify-no-content-type";
      const inputUrl = "https://r2.example.com/input.jpg";
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_1K",
        creditsCost: 2,
        prompt: "Add effect",
        apiKeyId: null,
        inputImageUrl: inputUrl,
        inputImageR2Key: "mcp-input/key.jpg",
        geminiModel: "gemini-3-pro-image-preview",
      });
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: newJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_1K",
        creditsCost: 2,
        status: JobStatus.PROCESSING,
      });

      // Mock fetch to return a response with NO content-type header
      const originalImageData = Buffer.from("original-image-data");
      const mockResponse = new Response(originalImageData, {
        status: 200,
        // No content-type header set
      });
      // Remove the content-type header that Response auto-sets
      mockResponse.headers.delete("content-type");
      const fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValue(mockResponse);

      // Set up mocks for the modification processing pipeline
      const mockModifiedBuffer = Buffer.from("modified-image-data");
      mockUploadToR2
        .mockResolvedValueOnce({ url: "https://r2.example.com/input.jpg" })
        .mockResolvedValueOnce({ url: "https://r2.example.com/output.jpg" });
      mockGeminiClient.modifyImageWithGemini.mockResolvedValue(
        mockModifiedBuffer,
      );
      mockMcpGenerationJob.update.mockResolvedValue({});

      const result = await rerunMcpJob(testJobId);

      expect(result.success).toBe(true);
      expect(result.newJobId).toBe(newJobId);

      // Wait for background processing to complete
      await vi.waitFor(
        () => {
          expect(mockGeminiClient.modifyImageWithGemini).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Verify the mimeType fallback to "image/jpeg" was used
      expect(mockGeminiClient.modifyImageWithGemini).toHaveBeenCalledWith(
        expect.objectContaining({
          mimeType: "image/jpeg",
        }),
      );

      fetchSpy.mockRestore();
    });

    it("should log outer catch when rerun GENERATE processGenerationJob throws", async () => {
      const newJobId = "new-gen-outer-catch";
      // First findUnique call is from rerunMcpJob itself (L650)
      mockMcpGenerationJob.findUnique
        .mockResolvedValueOnce({
          id: testJobId,
          userId: testUserId,
          type: McpJobType.GENERATE,
          tier: "TIER_1K",
          creditsCost: 2,
          prompt: "A sunset",
          apiKeyId: null,
          inputImageUrl: null,
          inputImageR2Key: null,
          geminiModel: "gemini-3-pro-image-preview",
        })
        // Second findUnique call is from handleGenerationJobFailure (L326)
        // Return a job so we enter the refund block
        .mockResolvedValueOnce({
          id: newJobId,
          userId: testUserId,
          creditsCost: 2,
        });
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: newJobId,
        userId: testUserId,
        type: McpJobType.GENERATE,
        tier: "TIER_1K",
        creditsCost: 2,
        status: JobStatus.PROCESSING,
      });

      // Make generation fail to trigger handleGenerationJobFailure
      mockGeminiClient.generateImageWithGemini.mockRejectedValue(
        new Error("Generation API error"),
      );
      mockMcpGenerationJob.update.mockResolvedValue({});
      // Make refundCredits throw — this is NOT wrapped in tryCatch in
      // handleGenerationJobFailure (L333), so the error propagates to
      // the outer .catch() at L707-709
      mockWorkspaceCreditManager.refundCredits.mockRejectedValue(
        new Error("Credit service down"),
      );

      const result = await rerunMcpJob(testJobId);

      expect(result.success).toBe(true);
      expect(result.newJobId).toBe(newJobId);

      // Wait for the outer catch to fire
      await vi.waitFor(
        () => {
          expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Rerun generation job ${newJobId} failed`),
            expect.objectContaining({ error: expect.any(Error) }),
          );
        },
        { timeout: 1000 },
      );
    });

    it("should log outer catch when processModificationJob throws inside fetchAndProcessModification", async () => {
      const newJobId = "new-modify-inner-throw";
      const inputUrl = "https://r2.example.com/input.jpg";
      // First findUnique is from rerunMcpJob (L650)
      mockMcpGenerationJob.findUnique
        .mockResolvedValueOnce({
          id: testJobId,
          userId: testUserId,
          type: McpJobType.MODIFY,
          tier: "TIER_1K",
          creditsCost: 2,
          prompt: "Add effect",
          apiKeyId: null,
          inputImageUrl: inputUrl,
          inputImageR2Key: "mcp-input/key.jpg",
          geminiModel: "gemini-3-pro-image-preview",
        })
        // Second findUnique is from handleModificationJobFailure (L490)
        // Return a job so we enter the refund block
        .mockResolvedValueOnce({
          id: newJobId,
          userId: testUserId,
          creditsCost: 2,
        });
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: newJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_1K",
        creditsCost: 2,
        status: JobStatus.PROCESSING,
      });

      // Mock fetch to return a valid response so we get past the fetch step
      const originalImageData = Buffer.from("original-image-data");
      const mockFetchResponse = new Response(originalImageData, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
      const fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValue(mockFetchResponse);

      // Make input upload fail in processModificationJob to trigger
      // handleModificationJobFailure
      mockUploadToR2.mockRejectedValue(new Error("R2 completely down"));
      mockMcpGenerationJob.update.mockResolvedValue({});
      // Make refundCredits throw — this is NOT wrapped in tryCatch in
      // handleModificationJobFailure (L497), so the error propagates to
      // processModificationJob, then to the outer .catch() at L763-765
      mockWorkspaceCreditManager.refundCredits.mockRejectedValue(
        new Error("Credit service down"),
      );

      const result = await rerunMcpJob(testJobId);

      expect(result.success).toBe(true);
      expect(result.newJobId).toBe(newJobId);

      // Wait for the outer catch to fire
      await vi.waitFor(
        () => {
          expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(
              `Rerun modification job ${newJobId} failed`,
            ),
            expect.objectContaining({ error: expect.any(Error) }),
          );
        },
        { timeout: 1000 },
      );

      fetchSpy.mockRestore();
    });

    it("should call handleGenerationJobFailure when inputImageUrl is null in fetchAndProcessModification", async () => {
      // This test covers the defensive null guard at L732-737.
      // We use a getter that returns truthy for the first two accesses
      // (L694 in create data, L710 condition check) and null for the third
      // (L732 inside fetchAndProcessModification).
      const newJobId = "new-modify-null-guard";
      let inputImageUrlCallCount = 0;
      const jobWithDynamicUrl = {
        id: testJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_1K",
        creditsCost: 2,
        prompt: "Add effect",
        apiKeyId: null,
        get inputImageUrl(): string | null {
          inputImageUrlCallCount++;
          // Accesses 1-2 (L694 create data + L710 condition) return truthy
          // Access 3 (L732 null guard inside fetchAndProcessModification) returns null
          return inputImageUrlCallCount <= 2
            ? "https://r2.example.com/input.jpg"
            : null;
        },
        inputImageR2Key: "mcp-input/key.jpg",
        geminiModel: "gemini-3-pro-image-preview",
      };

      // Reset findUnique to clear any leftover mockResolvedValueOnce queue
      // from previous tests (vi.clearAllMocks doesn't clear implementations)
      mockMcpGenerationJob.findUnique.mockReset();
      mockMcpGenerationJob.findUnique
        .mockResolvedValueOnce(jobWithDynamicUrl)
        // For handleGenerationJobFailure's findUnique call
        .mockResolvedValueOnce({
          id: newJobId,
          userId: testUserId,
          creditsCost: 2,
        });
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: newJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_1K",
        creditsCost: 2,
        status: JobStatus.PROCESSING,
      });
      mockMcpGenerationJob.update.mockResolvedValue({});
      mockWorkspaceCreditManager.refundCredits.mockResolvedValue({
        success: true,
      });

      const result = await rerunMcpJob(testJobId);

      expect(result.success).toBe(true);
      expect(result.newJobId).toBe(newJobId);

      // Wait for the null guard to trigger handleGenerationJobFailure
      // and the full refund flow to complete
      await vi.waitFor(
        () => {
          expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
            where: { id: newJobId },
            data: expect.objectContaining({
              status: JobStatus.FAILED,
              errorMessage: expect.stringContaining(
                "No input image URL available",
              ),
            }),
          });
          // Verify credits were refunded (inside waitFor to handle async timing)
          expect(
            mockWorkspaceCreditManager.refundCredits,
          ).toHaveBeenCalledWith(testUserId, 2);
        },
        { timeout: 1000 },
      );
    });

    it("should process successful modification rerun flow end-to-end", async () => {
      const newJobId = "new-modify-success-flow";
      const inputUrl = "https://r2.example.com/original-input.jpg";
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_2K",
        creditsCost: 5,
        prompt: "Add a rainbow",
        apiKeyId: testApiKeyId,
        inputImageUrl: inputUrl,
        inputImageR2Key: "mcp-input/test-user/original.jpg",
        geminiModel: "gemini-3-pro-image-preview",
      });
      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: newJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_2K",
        creditsCost: 5,
        status: JobStatus.PROCESSING,
      });

      // Mock fetch to return original image data
      const originalImageData = Buffer.from("original-image-data");
      const mockFetchResponse = new Response(originalImageData, {
        status: 200,
        headers: { "content-type": "image/png" },
      });
      const fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValue(mockFetchResponse);

      // Set up mocks for the full modification pipeline
      const mockModifiedBuffer = Buffer.from("modified-image-data");
      mockUploadToR2
        .mockResolvedValueOnce({ url: "https://r2.example.com/new-input.jpg" })
        .mockResolvedValueOnce({
          url: "https://r2.example.com/new-output.jpg",
        });
      mockGeminiClient.modifyImageWithGemini.mockResolvedValue(
        mockModifiedBuffer,
      );
      mockMcpGenerationJob.update.mockResolvedValue({});

      const result = await rerunMcpJob(testJobId);

      expect(result.success).toBe(true);
      expect(result.newJobId).toBe(newJobId);

      // Wait for full background processing
      await vi.waitFor(
        () => {
          expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
            where: { id: newJobId },
            data: expect.objectContaining({
              status: JobStatus.COMPLETED,
            }),
          });
        },
        { timeout: 1000 },
      );

      // Verify processModificationJob was called via modifyImageWithGemini
      expect(mockGeminiClient.modifyImageWithGemini).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Add a rainbow",
          tier: "2K",
          mimeType: "image/png",
        }),
      );

      fetchSpy.mockRestore();
    });
  });
});
