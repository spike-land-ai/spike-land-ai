import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks (vi.mock factories must not reference outer variables) ---

vi.mock("@/lib/prisma", () => ({
  default: {
    mcpGenerationJob: {
      count: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/credits/workspace-credit-manager", () => ({
  WorkspaceCreditManager: {
    refundCredits: vi.fn(),
  },
}));

vi.mock("@/lib/ai/gemini-client", () => ({
  generateImageWithGemini: vi.fn(),
  modifyImageWithGemini: vi.fn(),
}));

vi.mock("@/lib/ai/aspect-ratio", () => ({
  detectAspectRatio: () => "1:1" as const,
}));

vi.mock("@/lib/images/image-dimensions", () => ({
  getImageDimensionsFromBuffer: vi.fn(),
}));

vi.mock("@/lib/storage/r2-client", () => ({
  uploadToR2: vi.fn(),
}));

vi.mock("./error-classifier", () => ({
  classifyError: (err: unknown) => ({
    message: err instanceof Error ? err.message : "Unknown error",
    code: "INTERNAL_ERROR",
    retryable: false,
  }),
}));

import prisma from "@/lib/prisma";
import { WorkspaceCreditManager } from "@/lib/credits/workspace-credit-manager";
import { generateImageWithGemini, modifyImageWithGemini } from "@/lib/ai/gemini-client";
import { getImageDimensionsFromBuffer } from "@/lib/images/image-dimensions";
import type { ImageDimensions } from "@/lib/images/image-dimensions";
import { uploadToR2 } from "@/lib/storage/r2-client";
import type { UploadImageResult } from "@/lib/storage/r2-client";

import {
  checkConcurrentJobLimit,
  classifyError,
  fetchAndProcessModification,
  handleGenerationJobFailure,
  handleModificationJobFailure,
  MAX_CONCURRENT_JOBS_PER_USER,
  processGenerationJob,
  processModificationJob,
} from "./generation-helpers";

// Typed mock helpers
function makeUploadResult(url: string): UploadImageResult {
  return { success: true, key: "mock-key", url };
}

function makeDimensions(width: number, height: number): ImageDimensions {
  return { width, height, format: "jpeg" as const };
}

// Typed mock accessors
// Cast Prisma model methods to vi.Mock since vi.mocked() can't pierce the deep Prisma client types
const mockPrismaJob = prisma.mcpGenerationJob as unknown as {
  count: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
};
const mockRefundCredits = vi.mocked(WorkspaceCreditManager.refundCredits);
const mockGenerateImageWithGemini = vi.mocked(generateImageWithGemini);
const mockModifyImageWithGemini = vi.mocked(modifyImageWithGemini);
const mockGetImageDimensions = vi.mocked(getImageDimensionsFromBuffer);
const mockUploadToR2 = vi.mocked(uploadToR2);

describe("generation-helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaJob.update.mockResolvedValue({});
    mockPrismaJob.findUnique.mockResolvedValue(null);
    mockRefundCredits.mockResolvedValue(true);
  });

  describe("MAX_CONCURRENT_JOBS_PER_USER", () => {
    it("should be 3", () => {
      expect(MAX_CONCURRENT_JOBS_PER_USER).toBe(3);
    });
  });

  describe("classifyError", () => {
    it("should return message, code, and retryable from classifier", () => {
      const result = classifyError(new Error("test error"));
      expect(result).toEqual({
        message: "test error",
        code: "INTERNAL_ERROR",
        retryable: false,
      });
    });

    it("should handle non-Error values", () => {
      const result = classifyError("string error");
      expect(result).toHaveProperty("code");
      expect(result).toHaveProperty("message");
    });
  });

  describe("checkConcurrentJobLimit", () => {
    it("should return true when under the limit", async () => {
      mockPrismaJob.count.mockResolvedValue(2);

      const result = await checkConcurrentJobLimit("user-1");

      expect(result).toBe(true);
      expect(mockPrismaJob.count).toHaveBeenCalledWith({
        where: { userId: "user-1", status: "PROCESSING" },
      });
    });

    it("should return false when at the limit", async () => {
      mockPrismaJob.count.mockResolvedValue(3);

      const result = await checkConcurrentJobLimit("user-1");

      expect(result).toBe(false);
    });

    it("should return false when over the limit", async () => {
      mockPrismaJob.count.mockResolvedValue(5);

      const result = await checkConcurrentJobLimit("user-1");

      expect(result).toBe(false);
    });
  });

  describe("handleGenerationJobFailure", () => {
    it("should update job status to FAILED and refund credits", async () => {
      mockPrismaJob.findUnique.mockResolvedValue({
        id: "job-1",
        userId: "user-1",
        creditsCost: 5,
      });

      await handleGenerationJobFailure("job-1", new Error("generation failed"));

      // Should update to FAILED
      expect(mockPrismaJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "job-1" },
          data: expect.objectContaining({
            status: "FAILED",
            errorMessage: "generation failed",
          }),
        }),
      );

      // Should refund
      expect(mockRefundCredits).toHaveBeenCalledWith("user-1", 5);

      // Should update to REFUNDED
      expect(mockPrismaJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "job-1" },
          data: { status: "REFUNDED" },
        }),
      );
    });

    it("should not refund if job not found", async () => {
      mockPrismaJob.findUnique.mockResolvedValue(null);

      await handleGenerationJobFailure("job-1", new Error("failed"));

      expect(mockRefundCredits).not.toHaveBeenCalled();
    });
  });

  describe("handleModificationJobFailure", () => {
    it("should update job to FAILED and refund just like generation", async () => {
      mockPrismaJob.findUnique.mockResolvedValue({
        id: "job-2",
        userId: "user-2",
        creditsCost: 10,
      });

      await handleModificationJobFailure("job-2", new Error("modify failed"));

      expect(mockPrismaJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "job-2" },
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
      expect(mockRefundCredits).toHaveBeenCalledWith("user-2", 10);
    });
  });

  describe("processGenerationJob", () => {
    const params = {
      prompt: "a cat",
      tier: "1K" as const,
      userId: "user-1",
    };

    it("should generate image, upload to R2, and update job on success", async () => {
      const fakeBuffer = Buffer.from("fake-image");
      mockGenerateImageWithGemini.mockResolvedValue(fakeBuffer);
      mockGetImageDimensions.mockReturnValue(makeDimensions(512, 512));
      mockUploadToR2.mockResolvedValue(makeUploadResult("https://r2.example.com/img.jpg"));

      await processGenerationJob("job-1", params);

      expect(mockGenerateImageWithGemini).toHaveBeenCalledWith({
        prompt: "a cat",
        tier: "1K",
        negativePrompt: undefined,
        aspectRatio: undefined,
      });
      expect(mockUploadToR2).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.stringContaining("mcp-generated/user-1/job-1"),
          buffer: fakeBuffer,
          contentType: "image/jpeg",
        }),
      );
      expect(mockPrismaJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "job-1" },
          data: expect.objectContaining({
            status: "COMPLETED",
            outputImageUrl: "https://r2.example.com/img.jpg",
            outputWidth: 512,
            outputHeight: 512,
          }),
        }),
      );
    });

    it("should handle generation failure", async () => {
      mockGenerateImageWithGemini.mockRejectedValue(new Error("API down"));
      mockPrismaJob.findUnique.mockResolvedValue({
        id: "job-1",
        userId: "user-1",
        creditsCost: 2,
      });

      await processGenerationJob("job-1", params);

      expect(mockPrismaJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
      expect(mockRefundCredits).toHaveBeenCalled();
    });

    it("should handle upload failure", async () => {
      mockGenerateImageWithGemini.mockResolvedValue(Buffer.from("img"));
      mockGetImageDimensions.mockReturnValue(null);
      mockUploadToR2.mockRejectedValue(new Error("R2 down"));
      mockPrismaJob.findUnique.mockResolvedValue({
        id: "job-1",
        userId: "user-1",
        creditsCost: 2,
      });

      await processGenerationJob("job-1", params);

      expect(mockPrismaJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
    });

    it("should use default dimensions when image-dimensions returns null", async () => {
      mockGenerateImageWithGemini.mockResolvedValue(Buffer.from("img"));
      mockGetImageDimensions.mockReturnValue(null);
      mockUploadToR2.mockResolvedValue(makeUploadResult("https://r2.example.com/img.jpg"));

      await processGenerationJob("job-1", params);

      expect(mockPrismaJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            outputWidth: 1024,
            outputHeight: 1024,
          }),
        }),
      );
    });

    it("should handle DB update failure after upload", async () => {
      mockGenerateImageWithGemini.mockResolvedValue(Buffer.from("img"));
      mockGetImageDimensions.mockReturnValue(makeDimensions(512, 512));
      mockUploadToR2.mockResolvedValue(makeUploadResult("https://r2.example.com/img.jpg"));
      // First update (completion) fails, second update (failure) succeeds
      mockPrismaJob.update
        .mockRejectedValueOnce(new Error("DB down"))
        .mockResolvedValue({});
      mockPrismaJob.findUnique.mockResolvedValue({
        id: "job-1",
        userId: "user-1",
        creditsCost: 2,
      });

      await processGenerationJob("job-1", params);

      // Should have attempted to handle the failure
      expect(mockPrismaJob.update).toHaveBeenCalledTimes(3);
    });
  });

  describe("processModificationJob", () => {
    const params = {
      prompt: "make it blue",
      tier: "2K" as const,
      imageData: Buffer.from("original-image").toString("base64"),
      mimeType: "image/png",
      userId: "user-1",
    };

    it("should upload input, modify, upload output, and update job", async () => {
      const outputBuffer = Buffer.from("modified-image");
      mockUploadToR2
        .mockResolvedValueOnce(makeUploadResult("https://r2.example.com/input.png"))
        .mockResolvedValueOnce(makeUploadResult("https://r2.example.com/output.jpg"));
      mockGetImageDimensions
        .mockReturnValueOnce(makeDimensions(800, 600))
        .mockReturnValueOnce(makeDimensions(800, 600));
      mockModifyImageWithGemini.mockResolvedValue(outputBuffer);

      await processModificationJob("job-2", params);

      // Input upload
      expect(mockUploadToR2).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.stringContaining("mcp-input/user-1/job-2"),
          contentType: "image/png",
        }),
      );

      // Output upload
      expect(mockUploadToR2).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.stringContaining("mcp-modified/user-1/job-2"),
          contentType: "image/jpeg",
        }),
      );

      // Final update
      expect(mockPrismaJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "COMPLETED",
            outputImageUrl: "https://r2.example.com/output.jpg",
          }),
        }),
      );
    });

    it("should handle input upload failure", async () => {
      mockGetImageDimensions.mockReturnValue(makeDimensions(800, 600));
      mockUploadToR2.mockRejectedValueOnce(new Error("R2 input upload failed"));
      mockPrismaJob.findUnique.mockResolvedValue({
        id: "job-2",
        userId: "user-1",
        creditsCost: 5,
      });

      await processModificationJob("job-2", params);

      expect(mockPrismaJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
    });

    it("should handle modification API failure", async () => {
      mockGetImageDimensions.mockReturnValue(makeDimensions(800, 600));
      mockUploadToR2.mockResolvedValueOnce(makeUploadResult("https://r2.example.com/input.png"));
      mockModifyImageWithGemini.mockRejectedValue(new Error("Gemini API error"));
      mockPrismaJob.findUnique.mockResolvedValue({
        id: "job-2",
        userId: "user-1",
        creditsCost: 5,
      });

      await processModificationJob("job-2", params);

      expect(mockPrismaJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
    });

    it("should use default dimensions when header parsing returns null", async () => {
      mockGetImageDimensions.mockReturnValue(null);
      mockUploadToR2
        .mockResolvedValueOnce(makeUploadResult("https://r2.example.com/input.png"))
        .mockResolvedValueOnce(makeUploadResult("https://r2.example.com/output.jpg"));
      mockModifyImageWithGemini.mockResolvedValue(Buffer.from("modified"));

      await processModificationJob("job-2", params);

      expect(mockPrismaJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            outputWidth: 1024,
            outputHeight: 1024,
          }),
        }),
      );
    });

    it("should extract file extension from mimeType", async () => {
      mockGetImageDimensions.mockReturnValue(makeDimensions(512, 512));
      mockUploadToR2
        .mockResolvedValueOnce(makeUploadResult("https://r2.example.com/input.webp"))
        .mockResolvedValueOnce(makeUploadResult("https://r2.example.com/output.jpg"));
      mockModifyImageWithGemini.mockResolvedValue(Buffer.from("modified"));

      const webpParams = { ...params, mimeType: "image/webp" };
      await processModificationJob("job-2", webpParams);

      expect(mockUploadToR2).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.stringContaining(".webp"),
        }),
      );
    });
  });

  describe("fetchAndProcessModification", () => {
    const originalJob = {
      inputImageUrl: "https://example.com/original.jpg",
      prompt: "enhance this",
      tier: "TIER_2K",
      userId: "user-1",
    };

    it("should fail if no input image URL", async () => {
      mockPrismaJob.findUnique.mockResolvedValue({
        id: "new-job",
        userId: "user-1",
        creditsCost: 5,
      });

      await fetchAndProcessModification("new-job", {
        ...originalJob,
        inputImageUrl: null,
      });

      expect(mockPrismaJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
    });

    it("should fail if fetch returns non-ok response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 404 }),
      );
      mockPrismaJob.findUnique.mockResolvedValue({
        id: "new-job",
        userId: "user-1",
        creditsCost: 5,
      });

      await fetchAndProcessModification("new-job", originalJob);

      expect(mockPrismaJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );

      vi.restoreAllMocks();
    });

    it("should fail if fetch throws", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
      mockPrismaJob.findUnique.mockResolvedValue({
        id: "new-job",
        userId: "user-1",
        creditsCost: 5,
      });

      await fetchAndProcessModification("new-job", originalJob);

      expect(mockPrismaJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );

      vi.restoreAllMocks();
    });

    it("should convert tier format from TIER_2K to 2K", async () => {
      const imageData = Buffer.from("fake-image");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(imageData, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        }),
      );
      mockGetImageDimensions.mockReturnValue(makeDimensions(512, 512));
      mockUploadToR2.mockResolvedValue(makeUploadResult("https://r2.example.com/img.jpg"));
      mockModifyImageWithGemini.mockResolvedValue(Buffer.from("modified"));

      await fetchAndProcessModification("new-job", originalJob);

      // Give the async processModificationJob a tick to start
      await new Promise(r => setTimeout(r, 50));

      // The modification should be called with tier "2K" (stripped "TIER_")
      expect(mockModifyImageWithGemini).toHaveBeenCalledWith(
        expect.objectContaining({ tier: "2K" }),
      );

      vi.restoreAllMocks();
    });
  });
});
