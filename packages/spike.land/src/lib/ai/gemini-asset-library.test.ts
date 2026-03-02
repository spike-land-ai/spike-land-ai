import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeAssetForLibrary } from "./gemini-asset-library";
import { getGeminiClient } from "./gemini-client";

vi.mock("./gemini-client", () => ({
  getGeminiClient: vi.fn(),
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

describe("gemini-asset-library", () => {
  const mockGenerateContent = vi.fn();
  const mockAi = { models: { generateContent: mockGenerateContent } };
  const mockBuffer = Buffer.from("test");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGeminiClient).mockResolvedValue(
      mockAi as unknown as Awaited<ReturnType<typeof getGeminiClient>>,
    );
  });

  it("parses valid JSON response successfully", async () => {
    const mockJson = {
      altText: "A beautiful sunset",
      qualityScore: 85,
      suggestedTags: ["sunset", "nature", "landscape"],
      analysisDetails: {
        mainSubject: "Sun setting over ocean",
        imageStyle: "photo",
        technicalQuality: "sharp",
        colorPalette: ["#FFAA00", "#0000FF"],
        detectedObjects: ["sun", "water"],
      },
    };

    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockJson) });

    const result = await analyzeAssetForLibrary(mockBuffer, "image/jpeg");

    expect(result.altText).toBe("A beautiful sunset");
    expect(result.qualityScore).toBe(85);
    expect(result.suggestedTags).toEqual(["sunset", "nature", "landscape"]);
    expect(result.analysisDetails.imageStyle).toBe("photo");
    expect(result.analysisDetails.colorPalette).toEqual(["#FFAA00", "#0000FF"]);
  });

  it("strips markdown from response before parsing json", async () => {
    const mockJson = {
      altText: "Testing markdown",
      qualityScore: 50,
    };

    mockGenerateContent.mockResolvedValue({
      text: `\`\`\`json\n${JSON.stringify(mockJson)}\n\`\`\``,
    });

    const result = await analyzeAssetForLibrary(mockBuffer, "image/png");

    expect(result.altText).toBe("Testing markdown");
    expect(result.qualityScore).toBe(50);
    expect(result.analysisDetails.mainSubject).toBe("Unknown");
  });

  it("clamps quality score between 0 and 100", async () => {
    const mockJson = {
      qualityScore: 150,
    };

    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockJson) });

    const result = await analyzeAssetForLibrary(mockBuffer, "image/jpeg");

    expect(result.qualityScore).toBe(100);
  });

  it("handles negative quality score by clamping to 0", async () => {
    const mockJson = {
      qualityScore: -10,
    };

    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockJson) });

    const result = await analyzeAssetForLibrary(mockBuffer, "image/jpeg");

    expect(result.qualityScore).toBe(0);
  });

  it("defaults to 50 for invalid quality score", async () => {
    const mockJson = {
      qualityScore: "not-a-number",
    };

    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockJson) });

    const result = await analyzeAssetForLibrary(mockBuffer, "image/jpeg");

    expect(result.qualityScore).toBe(50);
  });

  it("slices tags to maximum of 7", async () => {
    const mockJson = {
      suggestedTags: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
      analysisDetails: {
        detectedObjects: ["a", "b", "c", "d", "e", "f", "g", "h"],
      },
    };

    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockJson) });

    const result = await analyzeAssetForLibrary(mockBuffer, "image/jpeg");

    expect(result.suggestedTags).toHaveLength(7);
    expect(result.suggestedTags).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(result.analysisDetails.detectedObjects).toHaveLength(7);
  });

  it("handles non-array tags and objects safely", async () => {
    const mockJson = {
      suggestedTags: "just one string",
      analysisDetails: {
        detectedObjects: "not an array",
      },
    };

    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockJson) });

    const result = await analyzeAssetForLibrary(mockBuffer, "image/jpeg");

    expect(result.suggestedTags).toEqual([]);
    expect(result.analysisDetails.detectedObjects).toBeUndefined();
  });

  it('handles invalid imageStyle by falling back to "other"', async () => {
    const mockJson = {
      analysisDetails: {
        imageStyle: "unsupported_style",
      },
    };

    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockJson) });

    const result = await analyzeAssetForLibrary(mockBuffer, "image/jpeg");

    expect(result.analysisDetails.imageStyle).toBe("other");
  });

  it("throws error if API call fails", async () => {
    mockGenerateContent.mockRejectedValue(new Error("API failure"));

    await expect(analyzeAssetForLibrary(mockBuffer, "image/jpeg")).rejects.toThrow(
      "Asset analysis failed: API failure",
    );
  });

  it("throws error if empty text response is returned", async () => {
    mockGenerateContent.mockResolvedValue({ text: "" });

    await expect(analyzeAssetForLibrary(mockBuffer, "image/jpeg")).rejects.toThrow(
      "No analysis response from Gemini",
    );
  });

  it("throws error if JSON parsing fails", async () => {
    mockGenerateContent.mockResolvedValue({ text: "{ invalid json" });

    await expect(analyzeAssetForLibrary(mockBuffer, "image/jpeg")).rejects.toThrow(
      "Failed to parse asset analysis JSON",
    );
  });
});
