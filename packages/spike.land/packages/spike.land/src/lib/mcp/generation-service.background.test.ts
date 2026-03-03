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
} from "./generation-service";

describe("generation-service - background processing", () => {
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

  describe("background job processing - generation", () => {
    it("should process generation job successfully and update job status", async () => {
      const mockImageBuffer = Buffer.from("fake-image-data");
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
      mockGeminiClient.generateImageWithGemini.mockResolvedValue(
        mockImageBuffer,
      );
      mockUploadToR2.mockResolvedValue({
        url: "https://r2.example.com/image.jpg",
      });
      mockMcpGenerationJob.update.mockResolvedValue({});

      const result = await createGenerationJob({
        userId: testUserId,
        apiKeyId: testApiKeyId,
        prompt: "A beautiful sunset",
        tier: "TIER_1K",
        negativePrompt: "ugly",
      });

      // Ensure job was created successfully
      expect(result.success).toBe(true);
      expect(result.jobId).toBe(testJobId);

      // Wait for background processing to complete - need to poll until async work finishes
      await vi.waitFor(
        () => {
          expect(mockMcpGenerationJob.update).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                status: JobStatus.COMPLETED,
              }),
            }),
          );
        },
        { timeout: 1000 },
      );

      // Verify Gemini was called with correct params
      expect(mockGeminiClient.generateImageWithGemini).toHaveBeenCalledWith({
        prompt: "A beautiful sunset",
        tier: "1K",
        negativePrompt: "ugly",
      });

      // Verify R2 upload was called
      expect(mockUploadToR2).toHaveBeenCalledWith({
        key: expect.stringContaining(
          `mcp-generated/${testUserId}/${testJobId}`,
        ),
        buffer: mockImageBuffer,
        contentType: "image/jpeg",
      });

      // Verify job was updated with success
      expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
        where: { id: testJobId },
        data: expect.objectContaining({
          status: JobStatus.COMPLETED,
          outputImageUrl: "https://r2.example.com/image.jpg",
        }),
      });
    });

    it("should handle generation job failure and refund credits", async () => {
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
      // Simulate Gemini failure
      mockGeminiClient.generateImageWithGemini.mockRejectedValue(
        new Error("Request timed out"),
      );
      mockMcpGenerationJob.update.mockResolvedValue({});
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        creditsCost: 2,
      });
      mockWorkspaceCreditManager.refundCredits.mockResolvedValue({
        success: true,
      });

      await createGenerationJob({
        userId: testUserId,
        prompt: "A beautiful sunset",
        tier: "TIER_1K",
      });

      // Wait for background processing
      await vi.advanceTimersByTimeAsync(100);

      // Verify job was updated with failure
      expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
        where: { id: testJobId },
        data: expect.objectContaining({
          status: JobStatus.FAILED,
          errorMessage: expect.stringContaining("took too long"),
        }),
      });

      // Verify credits were refunded
      expect(mockWorkspaceCreditManager.refundCredits).toHaveBeenCalledWith(
        testUserId,
        2,
      );

      // Verify job was updated to REFUNDED status
      expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
        where: { id: testJobId },
        data: { status: JobStatus.REFUNDED },
      });
    });

    it("should handle R2 upload failure in generation job", async () => {
      const mockImageBuffer = Buffer.from("fake-image-data");
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
      // Generation succeeds but upload fails
      mockGeminiClient.generateImageWithGemini.mockResolvedValue(
        mockImageBuffer,
      );
      mockUploadToR2.mockRejectedValue(new Error("R2 upload error"));
      mockMcpGenerationJob.update.mockResolvedValue({});
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        creditsCost: 2,
      });
      mockWorkspaceCreditManager.refundCredits.mockResolvedValue({
        success: true,
      });

      await createGenerationJob({
        userId: testUserId,
        prompt: "A beautiful sunset",
        tier: "TIER_1K",
      });

      // Wait for background processing
      await vi.advanceTimersByTimeAsync(100);

      // Verify job was marked as failed
      expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
        where: { id: testJobId },
        data: expect.objectContaining({
          status: JobStatus.FAILED,
        }),
      });

      // Verify credits were refunded
      expect(mockWorkspaceCreditManager.refundCredits).toHaveBeenCalledWith(
        testUserId,
        2,
      );
    });

    it("should handle DB update failure after successful generation upload", async () => {
      const mockImageBuffer = Buffer.from("fake-image-data");
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
      mockGeminiClient.generateImageWithGemini.mockResolvedValue(
        mockImageBuffer,
      );
      mockUploadToR2.mockResolvedValue({
        url: "https://r2.example.com/image.jpg",
      });
      // DB update for COMPLETED status fails
      mockMcpGenerationJob.update.mockRejectedValueOnce(
        new Error("DB error on completion update"),
      ).mockResolvedValue({});
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        creditsCost: 2,
      });
      mockWorkspaceCreditManager.refundCredits.mockResolvedValue({
        success: true,
      });

      await createGenerationJob({
        userId: testUserId,
        prompt: "A beautiful sunset",
        tier: "TIER_1K",
      });

      // Wait for background processing
      await vi.advanceTimersByTimeAsync(100);

      // Verify credits were refunded after the DB update failure
      expect(mockWorkspaceCreditManager.refundCredits).toHaveBeenCalledWith(
        testUserId,
        2,
      );
    });

    it("should not refund when job not found after failure", async () => {
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
      mockGeminiClient.generateImageWithGemini.mockRejectedValue(
        new Error("API key invalid"),
      );
      mockMcpGenerationJob.update.mockResolvedValue({});
      // Job not found when trying to refund
      mockMcpGenerationJob.findUnique.mockResolvedValue(null);

      await createGenerationJob({
        userId: testUserId,
        prompt: "A beautiful sunset",
        tier: "TIER_1K",
      });

      // Wait for background processing
      await vi.advanceTimersByTimeAsync(100);

      // Verify job was updated with failure
      expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
        where: { id: testJobId },
        data: expect.objectContaining({
          status: JobStatus.FAILED,
        }),
      });

      // Verify refund was NOT called since job not found
      expect(mockWorkspaceCreditManager.refundCredits).not.toHaveBeenCalled();
    });
  });

  describe("background job processing - modification", () => {
    it("should process modification job successfully", async () => {
      const mockImageBuffer = Buffer.from("fake-modified-image-data");
      const inputBase64 = Buffer.from("original-image").toString("base64");

      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_2K",
        creditsCost: 5,
        status: JobStatus.PROCESSING,
      });
      // First upload call is for input image, second for output
      mockUploadToR2
        .mockResolvedValueOnce({ url: "https://r2.example.com/input.jpg" })
        .mockResolvedValueOnce({ url: "https://r2.example.com/output.jpg" });
      mockGeminiClient.modifyImageWithGemini.mockResolvedValue(mockImageBuffer);
      mockMcpGenerationJob.update.mockResolvedValue({});

      await createModificationJob({
        userId: testUserId,
        apiKeyId: testApiKeyId,
        prompt: "Add a rainbow",
        tier: "TIER_2K",
        imageData: inputBase64,
        mimeType: "image/png",
      });

      // Wait for background processing
      await vi.advanceTimersByTimeAsync(100);

      // Verify input image was uploaded to R2
      expect(mockUploadToR2).toHaveBeenCalledWith({
        key: expect.stringContaining(
          `mcp-input/${testUserId}/${testJobId}.png`,
        ),
        buffer: expect.any(Buffer),
        contentType: "image/png",
      });

      // Verify job was updated with input image URL
      expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
        where: { id: testJobId },
        data: {
          inputImageUrl: "https://r2.example.com/input.jpg",
          inputImageR2Key: expect.stringContaining("mcp-input"),
        },
      });

      // Verify Gemini modify was called
      expect(mockGeminiClient.modifyImageWithGemini).toHaveBeenCalledWith({
        prompt: "Add a rainbow",
        tier: "2K",
        imageData: inputBase64,
        mimeType: "image/png",
        aspectRatio: "1:1",
      });

      // Verify output was uploaded
      expect(mockUploadToR2).toHaveBeenCalledWith({
        key: expect.stringContaining(
          `mcp-modified/${testUserId}/${testJobId}.jpg`,
        ),
        buffer: mockImageBuffer,
        contentType: "image/jpeg",
      });

      // Verify job was updated with success
      expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
        where: { id: testJobId },
        data: expect.objectContaining({
          status: JobStatus.COMPLETED,
          outputImageUrl: "https://r2.example.com/output.jpg",
        }),
      });
    });

    it("should handle modification job failure and refund credits", async () => {
      const inputBase64 = Buffer.from("original-image").toString("base64");

      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_2K",
        creditsCost: 5,
        status: JobStatus.PROCESSING,
      });
      // Input upload succeeds
      mockUploadToR2.mockResolvedValueOnce({
        url: "https://r2.example.com/input.jpg",
      });
      mockMcpGenerationJob.update.mockResolvedValue({});
      // Modification fails with content policy error
      mockGeminiClient.modifyImageWithGemini.mockRejectedValue(
        new Error("Content blocked by policy"),
      );
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        creditsCost: 5,
      });
      mockWorkspaceCreditManager.refundCredits.mockResolvedValue({
        success: true,
      });

      await createModificationJob({
        userId: testUserId,
        prompt: "Inappropriate content",
        tier: "TIER_2K",
        imageData: inputBase64,
        mimeType: "image/jpeg",
      });

      // Wait for background processing
      await vi.advanceTimersByTimeAsync(100);

      // Verify job was updated with failure
      expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
        where: { id: testJobId },
        data: expect.objectContaining({
          status: JobStatus.FAILED,
          errorMessage: expect.stringContaining("content policies"),
        }),
      });

      // Verify credits were refunded
      expect(mockWorkspaceCreditManager.refundCredits).toHaveBeenCalledWith(
        testUserId,
        5,
      );

      // Verify job was updated to REFUNDED status
      expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
        where: { id: testJobId },
        data: { status: JobStatus.REFUNDED },
      });
    });

    it("should not refund when modification job not found after failure", async () => {
      const inputBase64 = Buffer.from("original-image").toString("base64");

      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_2K",
        creditsCost: 5,
        status: JobStatus.PROCESSING,
      });
      // Input upload succeeds
      mockUploadToR2.mockResolvedValueOnce({
        url: "https://r2.example.com/input.jpg",
      });
      mockMcpGenerationJob.update.mockResolvedValue({});
      // Modification fails
      mockGeminiClient.modifyImageWithGemini.mockRejectedValue(
        new Error("Content blocked by policy"),
      );
      // Job not found when trying to refund
      mockMcpGenerationJob.findUnique.mockResolvedValue(null);

      await createModificationJob({
        userId: testUserId,
        prompt: "Inappropriate content",
        tier: "TIER_2K",
        imageData: inputBase64,
        mimeType: "image/jpeg",
      });

      // Wait for background processing
      await vi.advanceTimersByTimeAsync(100);

      // Verify job was updated with failure
      expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
        where: { id: testJobId },
        data: expect.objectContaining({
          status: JobStatus.FAILED,
        }),
      });

      // Verify refund was NOT called since job not found
      expect(mockWorkspaceCreditManager.refundCredits).not.toHaveBeenCalled();
    });

    it("should handle R2 upload failure for output image in modification job", async () => {
      const inputBase64 = Buffer.from("original-image").toString("base64");
      const mockImageBuffer = Buffer.from("fake-modified-image-data");

      mockMcpGenerationJob.count.mockResolvedValue(0);
      mockWorkspaceCreditManager.consumeCredits.mockResolvedValue({
        success: true,
      });
      mockMcpGenerationJob.create.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        type: McpJobType.MODIFY,
        tier: "TIER_2K",
        creditsCost: 5,
        status: JobStatus.PROCESSING,
      });
      // Input upload succeeds, output upload fails
      mockUploadToR2
        .mockResolvedValueOnce({ url: "https://r2.example.com/input.jpg" })
        .mockRejectedValueOnce(new Error("R2 upload failed for output"));
      mockGeminiClient.modifyImageWithGemini.mockResolvedValue(mockImageBuffer);
      mockMcpGenerationJob.update.mockResolvedValue({});
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        creditsCost: 5,
      });
      mockWorkspaceCreditManager.refundCredits.mockResolvedValue({
        success: true,
      });

      await createModificationJob({
        userId: testUserId,
        prompt: "Add effect",
        tier: "TIER_2K",
        imageData: inputBase64,
        mimeType: "image/jpeg",
      });

      // Wait for background processing
      await vi.advanceTimersByTimeAsync(100);

      // Verify job was marked as failed due to output upload failure
      expect(mockMcpGenerationJob.update).toHaveBeenCalledWith({
        where: { id: testJobId },
        data: expect.objectContaining({
          status: JobStatus.FAILED,
        }),
      });

      // Verify credits were refunded
      expect(mockWorkspaceCreditManager.refundCredits).toHaveBeenCalledWith(
        testUserId,
        5,
      );
    });

    it("should handle DB update failure after successful modification output upload", async () => {
      const inputBase64 = Buffer.from("original-image").toString("base64");
      const mockImageBuffer = Buffer.from("fake-modified-image-data");

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
      // Both uploads succeed
      mockUploadToR2
        .mockResolvedValueOnce({ url: "https://r2.example.com/input.jpg" })
        .mockResolvedValueOnce({ url: "https://r2.example.com/output.jpg" });
      mockGeminiClient.modifyImageWithGemini.mockResolvedValue(mockImageBuffer);

      // processModificationJob calls update multiple times:
      // 1. Update input image URL (succeeds)
      // 2. Update with COMPLETED status (fails - triggers handleModificationJobFailure)
      // 3+ handleModificationJobFailure also calls update (FAILED, REFUNDED status)
      let updateCallCount = 0;
      mockMcpGenerationJob.update.mockImplementation(() => {
        updateCallCount++;
        // Fail on the 2nd call (COMPLETED status update)
        if (updateCallCount === 2) {
          return Promise.reject(new Error("DB write failed on completion"));
        }
        return Promise.resolve({});
      });
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        creditsCost: 2,
      });
      mockWorkspaceCreditManager.refundCredits.mockResolvedValue({
        success: true,
      });

      await createModificationJob({
        userId: testUserId,
        prompt: "Add effect",
        tier: "TIER_1K",
        imageData: inputBase64,
        mimeType: "image/jpeg",
      });

      // Wait for background processing
      await vi.advanceTimersByTimeAsync(100);

      // Verify the failure handler was called and credits refunded
      expect(mockWorkspaceCreditManager.refundCredits).toHaveBeenCalledWith(
        testUserId,
        2,
      );
    });

    it("should handle input image update failure in modification job", async () => {
      const inputBase64 = Buffer.from("original-image").toString("base64");

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
      // Input upload succeeds
      mockUploadToR2.mockResolvedValueOnce({
        url: "https://r2.example.com/input.jpg",
      });
      // But DB update for input image URL fails
      mockMcpGenerationJob.update.mockRejectedValueOnce(
        new Error("DB error updating input URL"),
      ).mockResolvedValue({});
      mockMcpGenerationJob.findUnique.mockResolvedValue({
        id: testJobId,
        userId: testUserId,
        creditsCost: 2,
      });
      mockWorkspaceCreditManager.refundCredits.mockResolvedValue({
        success: true,
      });

      await createModificationJob({
        userId: testUserId,
        prompt: "Add effect",
        tier: "TIER_1K",
        imageData: inputBase64,
        mimeType: "image/jpeg",
      });

      // Wait for background processing
      await vi.advanceTimersByTimeAsync(100);

      // Verify credits were refunded after the input update failure
      expect(mockWorkspaceCreditManager.refundCredits).toHaveBeenCalledWith(
        testUserId,
        2,
      );
    });

    it("should use jpg extension when mimeType has no slash", async () => {
      const mockImageBuffer = Buffer.from("fake-modified-image-data");
      const inputBase64 = Buffer.from("original-image").toString("base64");

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
      mockUploadToR2
        .mockResolvedValueOnce({ url: "https://r2.example.com/input.jpg" })
        .mockResolvedValueOnce({ url: "https://r2.example.com/output.jpg" });
      mockGeminiClient.modifyImageWithGemini.mockResolvedValue(mockImageBuffer);
      mockMcpGenerationJob.update.mockResolvedValue({});

      await createModificationJob({
        userId: testUserId,
        prompt: "Add effect",
        tier: "TIER_1K",
        imageData: inputBase64,
        mimeType: "jpeg", // No slash - should fall back to "jpg"
      });

      // Wait for background processing
      await vi.advanceTimersByTimeAsync(100);

      // Verify input image upload used fallback extension
      expect(mockUploadToR2).toHaveBeenCalledWith({
        key: expect.stringContaining(".jpg"),
        buffer: expect.any(Buffer),
        contentType: "jpeg",
      });
    });
  });

  describe("outer catch handlers for background processing", () => {
    it("should log error when generation job throws unexpected error", async () => {
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

      // Make generateImageWithGemini throw, then make the subsequent update throw
      // to trigger the outer catch handler
      mockGeminiClient.generateImageWithGemini.mockRejectedValue(
        new Error("Generation failed"),
      );
      // Make the job update in the catch block throw an error
      mockMcpGenerationJob.update.mockRejectedValue(
        new Error("Database error during failure update"),
      );

      await createGenerationJob({
        userId: testUserId,
        prompt: "test",
        tier: "TIER_1K",
      });

      // Wait for background processing
      await vi.advanceTimersByTimeAsync(100);

      // Verify the outer catch handler logged the error via logger
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Generation job ${testJobId} failed`),
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it("should log error when modification job throws unexpected error", async () => {
      const inputBase64 = Buffer.from("original-image").toString("base64");

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

      // Make the first upload throw to trigger the outer catch
      mockUploadToR2.mockRejectedValue(new Error("R2 upload failed"));

      await createModificationJob({
        userId: testUserId,
        prompt: "test",
        tier: "TIER_1K",
        imageData: inputBase64,
        mimeType: "image/jpeg",
      });

      // Wait for background processing
      await vi.advanceTimersByTimeAsync(100);

      // Verify the outer catch handler logged the error via logger
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Modification job ${testJobId} failed`),
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });
  });
});
