import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeImage,
  analyzeImageV2,
  analyzeImageWithGemini,
  getDefaultAnalysis,
} from "./gemini-analysis";
import { getGeminiClient } from "./gemini-client";
import { buildDynamicEnhancementPrompt } from "./gemini-prompts";

vi.mock("./gemini-client", () => ({
  getGeminiClient: vi.fn(),
}));

vi.mock("./gemini-prompts", () => ({
  buildDynamicEnhancementPrompt: vi.fn().mockReturnValue("mock prompt"),
}));

vi.mock("@/lib/try-catch", () => ({
  tryCatch: vi.fn(async (p) => {
    try {
      const data = await p;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }),
}));

describe("gemini-analysis", () => {
  const mockGenerateContent = vi.fn();
  const mockAi = { models: { generateContent: mockGenerateContent } };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(getGeminiClient).mockResolvedValue(
      mockAi as unknown as Awaited<ReturnType<typeof getGeminiClient>>,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getDefaultAnalysis", () => {
    it("returns expected default structure", () => {
      const result = getDefaultAnalysis();
      expect(result.mainSubject).toBe("General image");
      expect(result.defects.isLowResolution).toBe(true);
      expect(result.defects.isDark).toBe(false);
      expect(result.cropping.isCroppingNeeded).toBe(false);
    });
  });

  describe("analyzeImageV2", () => {
    it("returns default analysis immediately if disabled via config", async () => {
      const result = await analyzeImageV2("img", "image/jpeg", {
        enabled: false,
      });
      expect(result.description).toBe("Analysis skipped");
      expect(result.structuredAnalysis.mainSubject).toBe("General image");
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it("parses valid JSON response successfully", async () => {
      const mockJson = {
        mainSubject: "Test subject",
        imageStyle: "sketch",
        defects: {
          isDark: true,
          isBlurry: false,
          hasColorCast: true,
          colorCastType: "red",
        },
        lightingCondition: "dim",
        cropping: {
          isCroppingNeeded: true,
          suggestedCrop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
          cropReason: "black bars",
        },
      };

      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: { parts: [{ text: JSON.stringify(mockJson) }] },
          },
        ],
      });

      // We don't advance timers here, just await the promise since generateContent resolves immediately
      const result = await analyzeImageV2("img", "image/jpeg");

      expect(result.description).toBe("Test subject");
      expect(result.quality).toBe("medium"); // 2 defects -> medium
      expect(result.structuredAnalysis.defects.isDark).toBe(true);
      expect(result.structuredAnalysis.defects.colorCastType).toBe("red");
      expect(result.structuredAnalysis.cropping.suggestedCrop?.x).toBe(0.1);
    });

    it("strips markdown from response before parsing", async () => {
      const mockJson = {
        mainSubject: "markdown test",
        imageStyle: "photograph",
        defects: {},
      };

      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: `\`\`\`json\n${JSON.stringify(mockJson)}\n\`\`\``,
                },
              ],
            },
          },
        ],
      });

      const result = await analyzeImageV2("img", "image/jpeg");
      expect(result.structuredAnalysis.mainSubject).toBe("markdown test");
    });

    it("handles invalid styles and types with defaults", async () => {
      const mockJson = {
        mainSubject: "test",
        imageStyle: "invalid_style",
        defects: { colorCastType: "invalid_color" },
      };
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: { parts: [{ text: JSON.stringify(mockJson) }] },
          },
        ],
      });

      const result = await analyzeImageV2("img", "image/jpeg");
      expect(result.structuredAnalysis.imageStyle).toBe("photograph");
      expect(result.structuredAnalysis.defects.colorCastType).toBeUndefined();
    });

    it("falls back to default analysis on API error", async () => {
      mockGenerateContent.mockRejectedValue(new Error("API failed"));
      const result = await analyzeImageV2("img", "image/jpeg");
      expect(result.description).toBe("General image");
      expect(result.structuredAnalysis.defects.isLowResolution).toBe(true);
    });

    it("falls back to default analysis on empty text response", async () => {
      mockGenerateContent.mockResolvedValue({ candidates: [] });
      const result = await analyzeImageV2("img", "image/jpeg");
      expect(result.structuredAnalysis.mainSubject).toBe("General image");
    });

    it("handles timeout correctly", async () => {
      // Let the generateContent hang
      mockGenerateContent.mockImplementation(() => new Promise(() => {}));

      const promise = analyzeImageV2("img", "image/jpeg");

      // Advance past the timeout
      await vi.advanceTimersByTimeAsync(30000); // ANALYSIS_TIMEOUT_MS is probably 15-30s

      const result = await promise;
      expect(result.structuredAnalysis.mainSubject).toBe("General image");
    });

    it("calculates quality correctly based on defect count", async () => {
      const createWithDefects = async (isDark: boolean, isBlurry: boolean, hasNoise: boolean) => {
        mockGenerateContent.mockResolvedValueOnce({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      defects: { isDark, isBlurry, hasNoise },
                    }),
                  },
                ],
              },
            },
          ],
        });
        return await analyzeImageV2("img", "image/jpeg");
      };

      const high = await createWithDefects(false, false, false);
      expect(high.quality).toBe("high");

      const medium = await createWithDefects(true, false, false);
      expect(medium.quality).toBe("medium");

      const low = await createWithDefects(true, true, true);
      expect(low.quality).toBe("low");
    });
  });

  describe("analyzeImage (legacy)", () => {
    it("calls analyzeImageV2 and transforms result", async () => {
      const mockAnalysis = {
        description: "Legacy wrapper",
        quality: "low",
        structuredAnalysis: {
          imageStyle: "sketch",
          defects: {
            isDark: true,
            isOverexposed: true,
            isBlurry: true,
            hasNoise: true,
            hasVHSArtifacts: true,
            isLowResolution: true,
            hasColorCast: true,
          },
        },
      };

      // We'll mock generateContent so analyzeImageV2 returns this
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mockAnalysis.structuredAnalysis) }],
            },
          },
        ],
      });

      const result = await analyzeImage("img", "image/jpeg");

      expect(result.description).toBe("Unknown subject"); // mainSubject wasn't in mock, default used by V2
      expect(result.quality).toBe("low");
      expect(result.enhancementPrompt).toBe("mock prompt");
      expect(buildDynamicEnhancementPrompt).toHaveBeenCalled();

      // Check that all improvements were mapped
      const i = result.suggestedImprovements;
      expect(i).toContain("photorealistic conversion");
      expect(i).toContain("exposure correction");
      expect(i).toContain("highlight recovery");
      expect(i).toContain("sharpening");
      expect(i).toContain("noise reduction");
      expect(i).toContain("artifact removal");
      expect(i).toContain("resolution enhancement");
      expect(i).toContain("color correction");
      expect(i).toContain("color optimization");
      expect(i).toContain("detail enhancement");
    });
  });

  describe("analyzeImageWithGemini", () => {
    it("sends single image properly", async () => {
      mockGenerateContent.mockResolvedValue({ text: "analysis result" });

      const result = await analyzeImageWithGemini("img-data", "test prompt");
      expect(result).toBe("analysis result");
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: "image/jpeg", data: "img-data" } },
                { text: "test prompt" },
              ],
            },
          ],
        }),
      );
    });

    it("sends multiple images properly", async () => {
      mockGenerateContent.mockResolvedValue({ text: "multi analysis" });

      const result = await analyzeImageWithGemini(["img1", "img2"], "test prompt");
      expect(result).toBe("multi analysis");
      const callArg = mockGenerateContent.mock.calls[0]![0];
      const parts = callArg.contents![0].parts;
      expect(parts).toHaveLength(3);
      expect(parts[0].inlineData.data).toBe("img1");
      expect(parts[1].inlineData.data).toBe("img2");
      expect(parts[2].text).toBe("test prompt");
    });

    it("throws on API error", async () => {
      mockGenerateContent.mockRejectedValue(new Error("vision failed"));
      await expect(analyzeImageWithGemini("img", "prompt")).rejects.toThrow(
        "Gemini vision analysis failed: vision failed",
      );
    });

    it("throws if no text returned", async () => {
      mockGenerateContent.mockResolvedValue({ text: null });
      await expect(analyzeImageWithGemini("img", "prompt")).rejects.toThrow(
        "No response from Gemini vision analysis",
      );
    });
  });
});
