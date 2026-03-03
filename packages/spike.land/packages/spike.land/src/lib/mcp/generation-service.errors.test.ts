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

import { classifyError } from "./generation-service";

describe("generation-service - classifyError", () => {
  const mockDate = new Date("2024-01-15T12:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    mockGeminiClient.generateImageWithGemini.mockReset();
    mockGeminiClient.modifyImageWithGemini.mockReset();
    mockUploadToR2.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(async () => {
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  describe("classifyError", () => {
    it("should classify timeout errors", () => {
      const result = classifyError(new Error("Request timed out"));

      expect(result.code).toBe("TIMEOUT");
      expect(result.message).toContain("took too long");
    });

    it("should classify timeout errors with 'timeout' keyword", () => {
      const result = classifyError(new Error("Connection timeout after 60s"));

      expect(result.code).toBe("TIMEOUT");
    });

    it("should classify content policy errors", () => {
      const result = classifyError(new Error("Content blocked by policy"));

      expect(result.code).toBe("CONTENT_POLICY");
      expect(result.message).toContain("content policies");
    });

    it("should classify rate limit errors", () => {
      const result = classifyError(new Error("Rate limit exceeded"));

      expect(result.code).toBe("RATE_LIMITED");
      expect(result.message).toContain("temporarily unavailable");
    });

    it("should classify quota errors as rate limited", () => {
      const result = classifyError(new Error("Quota exceeded for the day"));

      expect(result.code).toBe("RATE_LIMITED");
    });

    it("should classify 429 errors as rate limited", () => {
      const result = classifyError(new Error("HTTP 429: Too Many Requests"));

      expect(result.code).toBe("RATE_LIMITED");
    });

    it("should classify auth errors", () => {
      const result = classifyError(new Error("API key invalid"));

      expect(result.code).toBe("AUTH_ERROR");
      expect(result.message).toContain("configuration error");
    });

    it("should classify 401 errors as auth errors", () => {
      const result = classifyError(new Error("HTTP 401 Unauthorized"));

      expect(result.code).toBe("AUTH_ERROR");
    });

    it("should classify invalid image errors", () => {
      const result = classifyError(new Error("Image is invalid or corrupt"));

      expect(result.code).toBe("INVALID_IMAGE");
      expect(result.message).toContain("different format");
    });

    it("should return original message for other errors", () => {
      const result = classifyError(new Error("Some unexpected error"));

      expect(result.code).toBe("GENERATION_ERROR");
      expect(result.message).toBe("Some unexpected error");
    });

    it("should handle non-Error objects", () => {
      const result = classifyError("string error");

      expect(result.code).toBe("UNKNOWN");
      expect(result.message).toContain("unexpected error");
    });

    it("should handle null", () => {
      const result = classifyError(null);

      expect(result.code).toBe("UNKNOWN");
    });

    it("should handle undefined", () => {
      const result = classifyError(undefined);

      expect(result.code).toBe("UNKNOWN");
    });
  });
});
