import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateGenerationJob,
  mockCreateModificationJob,
  mockPrisma,
  mockFetch,
} = vi.hoisted(() => {
  const mockCreateGenerationJob = vi.fn();
  const mockCreateModificationJob = vi.fn();
  const mockPrisma = {
    mcpGenerationJob: { findUnique: vi.fn() },
  };
  const mockFetch = vi.fn();
  return {
    mockCreateGenerationJob,
    mockCreateModificationJob,
    mockPrisma,
    mockFetch,
  };
});

vi.mock("@/lib/mcp/generation-service", () => ({
  createGenerationJob: (...args: unknown[]) => mockCreateGenerationJob(...args),
  createModificationJob: (...args: unknown[]) => mockCreateModificationJob(...args),
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

vi.stubGlobal("fetch", mockFetch);

import { createMockRegistry, getText } from "../__test-utils__";
import { registerImageTools } from "./image";

describe("image tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerImageTools(registry, userId);
  });

  it("should register 3 image tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.handlers.has("generate_image")).toBe(true);
    expect(registry.handlers.has("modify_image")).toBe(true);
    expect(registry.handlers.has("check_job")).toBe(true);
  });

  describe("generate_image", () => {
    it("should generate image with wait", async () => {
      mockCreateGenerationJob.mockResolvedValue({
        success: true,
        jobId: "job-1",
        creditsCost: 2,
      });
      mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue({
        id: "job-1",
        status: "COMPLETED",
        outputImageUrl: "https://example.com/image.jpg",
        outputWidth: 1024,
        outputHeight: 1024,
        creditsCost: 2,
        errorMessage: null,
        type: "GENERATE",
        prompt: "a cat",
      });
      const handler = registry.handlers.get("generate_image")!;
      const result = await handler({
        prompt: "a cat",
        wait_for_completion: true,
      });
      expect(getText(result)).toContain("Image generated");
      expect(getText(result)).toContain("job-1");
    });

    it("should return job ID without wait", async () => {
      mockCreateGenerationJob.mockResolvedValue({
        success: true,
        jobId: "job-2",
        creditsCost: 2,
      });
      const handler = registry.handlers.get("generate_image")!;
      const result = await handler({
        prompt: "a dog",
        wait_for_completion: false,
      });
      expect(getText(result)).toContain("Generation started");
      expect(getText(result)).toContain("job-2");
    });

    it("should return error on failure", async () => {
      mockCreateGenerationJob.mockResolvedValue({
        success: false,
        error: "Insufficient credits",
      });
      const handler = registry.handlers.get("generate_image")!;
      const result = await handler({ prompt: "test" });
      expect(getText(result)).toContain("Insufficient credits");
    });

    it("should return error when waitForJobCompletion returns FAILED", async () => {
      mockCreateGenerationJob.mockResolvedValue({
        success: true,
        jobId: "job-fail",
        creditsCost: 2,
      });
      mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue({
        id: "job-fail",
        status: "FAILED",
        outputImageUrl: null,
        outputWidth: null,
        outputHeight: null,
        creditsCost: 0,
        errorMessage: "GPU out of memory",
        type: "GENERATE",
        prompt: "test",
      });
      const handler = registry.handlers.get("generate_image")!;
      const result = await handler({
        prompt: "test",
        wait_for_completion: true,
      });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("GPU out of memory");
    });

    it("should handle exception in createGenerationJob", async () => {
      mockCreateGenerationJob.mockRejectedValue(
        new Error("Service unavailable"),
      );
      const handler = registry.handlers.get("generate_image")!;
      const result = await handler({
        prompt: "test",
        wait_for_completion: false,
      });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("Service unavailable");
    });

    it("should return error when result.success is false but jobId exists", async () => {
      mockCreateGenerationJob.mockResolvedValue({
        success: false,
        jobId: "job-orphan",
        error: "Quota exceeded",
      });
      const handler = registry.handlers.get("generate_image")!;
      const result = await handler({ prompt: "test" });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("Quota exceeded");
    });

    it("should return 'Unknown error' when generate result has no error message", async () => {
      mockCreateGenerationJob.mockResolvedValue({
        success: false,
        jobId: null,
        error: "",
      });
      const handler = registry.handlers.get("generate_image")!;
      const result = await handler({ prompt: "test" });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("Unknown error");
    });

    it("should return 'Unknown error' when FAILED status has no errorMessage", async () => {
      mockCreateGenerationJob.mockResolvedValue({
        success: true,
        jobId: "job-no-msg",
        creditsCost: 2,
      });
      mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue({
        id: "job-no-msg",
        status: "FAILED",
        outputImageUrl: null,
        outputWidth: null,
        outputHeight: null,
        creditsCost: 0,
        errorMessage: null,
        type: "GENERATE",
        prompt: "test",
      });
      const handler = registry.handlers.get("generate_image")!;
      const result = await handler({
        prompt: "test",
        wait_for_completion: true,
      });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("Unknown error");
    });

    it("should handle non-Error throw in catch block", async () => {
      mockCreateGenerationJob.mockRejectedValue("string error");
      const handler = registry.handlers.get("generate_image")!;
      const result = await handler({ prompt: "test" });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("Unknown");
    });

    it("should pass negative_prompt to createGenerationJob", async () => {
      mockCreateGenerationJob.mockResolvedValue({
        success: true,
        jobId: "job-neg",
        creditsCost: 2,
      });
      mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue({
        id: "job-neg",
        status: "COMPLETED",
        outputImageUrl: "https://example.com/img.jpg",
        outputWidth: 1024,
        outputHeight: 1024,
        creditsCost: 2,
        errorMessage: null,
        type: "GENERATE",
        prompt: "a cat",
      });
      const handler = registry.handlers.get("generate_image")!;
      await handler({
        prompt: "a cat",
        negative_prompt: "no blur",
        wait_for_completion: true,
      });
      expect(mockCreateGenerationJob).toHaveBeenCalledWith(
        expect.objectContaining({ negativePrompt: "no blur" }),
      );
    });

    it("should pass aspect_ratio to createGenerationJob", async () => {
      mockCreateGenerationJob.mockResolvedValue({
        success: true,
        jobId: "job-ar",
        creditsCost: 2,
      });
      mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue({
        id: "job-ar",
        status: "COMPLETED",
        outputImageUrl: "https://example.com/img.jpg",
        outputWidth: 1920,
        outputHeight: 1080,
        creditsCost: 2,
        errorMessage: null,
        type: "GENERATE",
        prompt: "landscape",
      });
      const handler = registry.handlers.get("generate_image")!;
      await handler({
        prompt: "landscape",
        aspect_ratio: "16:9",
        wait_for_completion: true,
      });
      expect(mockCreateGenerationJob).toHaveBeenCalledWith(
        expect.objectContaining({ aspectRatio: "16:9" }),
      );
    });

    it("should handle waitForJobCompletion timeout", async () => {
      vi.useFakeTimers();
      try {
        mockCreateGenerationJob.mockResolvedValue({
          success: true,
          jobId: "job-timeout",
          creditsCost: 2,
        });
        // Always return PENDING status, causing timeout after maxAttempts
        mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue({
          id: "job-timeout",
          status: "PENDING",
          outputImageUrl: null,
          outputWidth: null,
          outputHeight: null,
          creditsCost: 2,
          errorMessage: null,
          type: "GENERATE",
          prompt: "test",
        });
        const handler = registry.handlers.get("generate_image")!;
        const resultPromise = handler({
          prompt: "test",
          wait_for_completion: true,
          tier: "TIER_1K",
        });

        // Advance timers to get through all 60 iterations (60 * 2000ms)
        for (let i = 0; i < 60; i++) {
          await vi.advanceTimersByTimeAsync(2000);
        }

        const result = await resultPromise;
        expect((result as { isError?: boolean; }).isError).toBe(true);
        expect(getText(result)).toContain("Job timed out");
      } finally {
        vi.useRealTimers();
      }
    });

    it("should handle waitForJobCompletion job not found", async () => {
      mockCreateGenerationJob.mockResolvedValue({
        success: true,
        jobId: "job-missing",
        creditsCost: 2,
      });
      mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("generate_image")!;
      const result = await handler({
        prompt: "test",
        wait_for_completion: true,
      });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("Job not found");
    });

    it("should handle waitForJobCompletion with REFUNDED status", async () => {
      mockCreateGenerationJob.mockResolvedValue({
        success: true,
        jobId: "job-refund",
        creditsCost: 2,
      });
      mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue({
        id: "job-refund",
        status: "REFUNDED",
        outputImageUrl: null,
        outputWidth: null,
        outputHeight: null,
        creditsCost: 0,
        errorMessage: "Refunded due to safety filter",
        type: "GENERATE",
        prompt: "test",
      });
      const handler = registry.handlers.get("generate_image")!;
      const result = await handler({
        prompt: "test",
        wait_for_completion: true,
      });
      // REFUNDED is a terminal status (not FAILED), so it returns the success path
      expect(getText(result)).toContain("Image generated");
      expect(getText(result)).toContain("job-refund");
      // Not an error
      expect((result as { isError?: boolean; }).isError).toBeUndefined();
    });
  });

  describe("modify_image", () => {
    it("should require image source", async () => {
      const handler = registry.handlers.get("modify_image")!;
      const result = await handler({ prompt: "make it blue" });
      expect(getText(result)).toContain("image_url or image_base64 required");
    });

    it("should modify with base64", async () => {
      mockCreateModificationJob.mockResolvedValue({
        success: true,
        jobId: "job-3",
        creditsCost: 2,
      });
      mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue({
        id: "job-3",
        status: "COMPLETED",
        outputImageUrl: "https://example.com/modified.jpg",
        outputWidth: 1024,
        outputHeight: 1024,
        creditsCost: 2,
        errorMessage: null,
        type: "MODIFY",
        prompt: "blue",
      });
      const handler = registry.handlers.get("modify_image")!;
      const result = await handler({
        prompt: "make it blue",
        image_base64: "base64data",
        wait_for_completion: true,
      });
      expect(getText(result)).toContain("Image modified");
    });

    it("should modify with image_url", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer),
        headers: { get: () => "image/png" },
      });
      mockCreateModificationJob.mockResolvedValue({
        success: true,
        jobId: "job-url",
        creditsCost: 2,
      });
      mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue({
        id: "job-url",
        status: "COMPLETED",
        outputImageUrl: "https://example.com/modified.jpg",
        outputWidth: 512,
        outputHeight: 512,
        creditsCost: 2,
        errorMessage: null,
        type: "MODIFY",
        prompt: "sharpen",
      });
      const handler = registry.handlers.get("modify_image")!;
      const result = await handler({
        prompt: "sharpen",
        image_url: "https://example.com/input.png",
        wait_for_completion: true,
      });
      expect(getText(result)).toContain("Image modified");
    });

    it("should return error when fetch fails for image_url", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: "Not Found",
      });
      const handler = registry.handlers.get("modify_image")!;
      const result = await handler({
        prompt: "sharpen",
        image_url: "https://example.com/missing.png",
      });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("Failed to fetch image");
    });

    it("should return error when modification job fails", async () => {
      mockCreateModificationJob.mockResolvedValue({
        success: false,
        error: "No credits",
      });
      const handler = registry.handlers.get("modify_image")!;
      const result = await handler({
        prompt: "test",
        image_base64: "base64data",
        wait_for_completion: false,
      });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("No credits");
    });

    it("should return job ID without wait", async () => {
      mockCreateModificationJob.mockResolvedValue({
        success: true,
        jobId: "job-nowait",
        creditsCost: 2,
      });
      const handler = registry.handlers.get("modify_image")!;
      const result = await handler({
        prompt: "test",
        image_base64: "base64data",
        wait_for_completion: false,
      });
      expect(getText(result)).toContain("Modification started");
      expect(getText(result)).toContain("job-nowait");
    });

    it("should return error when waitForJobCompletion returns FAILED", async () => {
      mockCreateModificationJob.mockResolvedValue({
        success: true,
        jobId: "job-modfail",
        creditsCost: 2,
      });
      mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue({
        id: "job-modfail",
        status: "FAILED",
        outputImageUrl: null,
        outputWidth: null,
        outputHeight: null,
        creditsCost: 0,
        errorMessage: "Processing error",
        type: "MODIFY",
        prompt: "test",
      });
      const handler = registry.handlers.get("modify_image")!;
      const result = await handler({
        prompt: "test",
        image_base64: "base64data",
        wait_for_completion: true,
      });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("Processing error");
    });

    it("should handle exception in modification flow", async () => {
      mockCreateModificationJob.mockRejectedValue(
        new Error("Modification service down"),
      );
      const handler = registry.handlers.get("modify_image")!;
      const result = await handler({
        prompt: "test",
        image_base64: "base64data",
      });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("Modification service down");
    });

    it("should return error when modify result.success is false but jobId exists", async () => {
      mockCreateModificationJob.mockResolvedValue({
        success: false,
        jobId: "job-mod-orphan",
        error: "Rate limited",
      });
      const handler = registry.handlers.get("modify_image")!;
      const result = await handler({
        prompt: "test",
        image_base64: "base64data",
        wait_for_completion: false,
      });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("Rate limited");
    });

    it("should return 'Unknown error' when modify result has no error message", async () => {
      mockCreateModificationJob.mockResolvedValue({
        success: false,
        jobId: null,
        error: "",
      });
      const handler = registry.handlers.get("modify_image")!;
      const result = await handler({
        prompt: "test",
        image_base64: "base64data",
      });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("Unknown error");
    });

    it("should return 'Unknown error' when modify FAILED status has no errorMessage", async () => {
      mockCreateModificationJob.mockResolvedValue({
        success: true,
        jobId: "job-mod-nomsg",
        creditsCost: 2,
      });
      mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue({
        id: "job-mod-nomsg",
        status: "FAILED",
        outputImageUrl: null,
        outputWidth: null,
        outputHeight: null,
        creditsCost: 0,
        errorMessage: null,
        type: "MODIFY",
        prompt: "test",
      });
      const handler = registry.handlers.get("modify_image")!;
      const result = await handler({
        prompt: "test",
        image_base64: "base64data",
        wait_for_completion: true,
      });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("Unknown error");
    });

    it("should handle non-Error throw in modify catch block", async () => {
      mockCreateModificationJob.mockRejectedValue("string error");
      const handler = registry.handlers.get("modify_image")!;
      const result = await handler({
        prompt: "test",
        image_base64: "base64data",
      });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("Unknown");
    });

    it("should fallback to mime_type when content-type header returns null", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0xff, 0xd8]).buffer),
        headers: { get: () => null },
      });
      mockCreateModificationJob.mockResolvedValue({
        success: true,
        jobId: "job-ct",
        creditsCost: 2,
      });
      mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue({
        id: "job-ct",
        status: "COMPLETED",
        outputImageUrl: "https://example.com/modified.jpg",
        outputWidth: 512,
        outputHeight: 512,
        creditsCost: 2,
        errorMessage: null,
        type: "MODIFY",
        prompt: "sharpen",
      });
      const handler = registry.handlers.get("modify_image")!;
      const result = await handler({
        prompt: "sharpen",
        image_url: "https://example.com/input.jpg",
        mime_type: "image/jpeg",
        wait_for_completion: true,
      });
      expect(getText(result)).toContain("Image modified");
      // When content-type is null, falls back to mime_type (image/jpeg)
      expect(mockCreateModificationJob).toHaveBeenCalledWith(
        expect.objectContaining({ mimeType: "image/jpeg" }),
      );
    });
  });

  describe("check_job", () => {
    it("should return completed job", async () => {
      mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue({
        id: "job-1",
        type: "GENERATE",
        status: "COMPLETED",
        prompt: "a cat",
        creditsCost: 2,
        outputImageUrl: "https://example.com/image.jpg",
        outputWidth: 1024,
        outputHeight: 1024,
        errorMessage: null,
      });
      const handler = registry.handlers.get("check_job")!;
      const result = await handler({ job_id: "job-1" });
      expect(getText(result)).toContain("COMPLETED");
      expect(getText(result)).toContain("Image URL");
    });

    it("should return not found", async () => {
      mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("check_job")!;
      const result = await handler({ job_id: "nope" });
      expect(getText(result)).toContain("Job not found");
    });

    it("should return failed job with error", async () => {
      mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue({
        id: "job-2",
        type: "GENERATE",
        status: "FAILED",
        prompt: "test",
        creditsCost: 0,
        outputImageUrl: null,
        outputWidth: null,
        outputHeight: null,
        errorMessage: "Model timeout",
      });
      const handler = registry.handlers.get("check_job")!;
      const result = await handler({ job_id: "job-2" });
      expect(getText(result)).toContain("FAILED");
      expect(getText(result)).toContain("Model timeout");
    });

    it("should return pending job without image or error details", async () => {
      mockPrisma.mcpGenerationJob.findUnique.mockResolvedValue({
        id: "job-3",
        type: "GENERATE",
        status: "PENDING",
        prompt: "landscape",
        creditsCost: 2,
        outputImageUrl: null,
        outputWidth: null,
        outputHeight: null,
        errorMessage: null,
      });
      const handler = registry.handlers.get("check_job")!;
      const result = await handler({ job_id: "job-3" });
      expect(getText(result)).toContain("PENDING");
      expect(getText(result)).not.toContain("Image URL");
      expect(getText(result)).not.toContain("Error:");
    });

    it("should handle check_job exception", async () => {
      mockPrisma.mcpGenerationJob.findUnique.mockRejectedValue(
        new Error("DB connection lost"),
      );
      const handler = registry.handlers.get("check_job")!;
      const result = await handler({ job_id: "job-err" });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("DB connection lost");
    });

    it("should handle non-Error throw in check_job catch block", async () => {
      mockPrisma.mcpGenerationJob.findUnique.mockRejectedValue(
        "db string error",
      );
      const handler = registry.handlers.get("check_job")!;
      const result = await handler({ job_id: "job-str-err" });
      expect((result as { isError?: boolean; }).isError).toBe(true);
      expect(getText(result)).toContain("Unknown");
    });
  });
});
