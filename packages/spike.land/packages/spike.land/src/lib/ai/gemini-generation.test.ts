import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enhanceImageWithGemini,
  generateImageWithGemini,
  modifyImageWithGemini,
} from "./gemini-generation";
import { getGeminiClient } from "./gemini-client";
import { analyzeImage } from "./gemini-analysis";
import { processGeminiStream } from "./gemini-stream";
import { detectAspectRatio } from "./aspect-ratio";
import { supportsImageSize } from "./gemini-models";

vi.mock("./gemini-client", () => ({
  getGeminiClient: vi.fn(),
}));

vi.mock("./gemini-analysis", () => ({
  analyzeImage: vi.fn(),
}));

vi.mock("./gemini-stream", () => ({
  processGeminiStream: vi.fn(),
}));

vi.mock("./aspect-ratio", () => ({
  detectAspectRatio: vi.fn(),
}));

vi.mock("./gemini-models", async importOriginal => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    supportsImageSize: vi.fn(),
    DEFAULT_MODEL: "test-model",
  };
});

describe("gemini-generation", () => {
  const mockAi = { request: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGeminiClient).mockResolvedValue(mockAi as any);
    vi.mocked(processGeminiStream).mockResolvedValue(Buffer.from("mock-image"));
    vi.mocked(supportsImageSize).mockReturnValue(true);
    vi.mocked(detectAspectRatio).mockReturnValue("16:9");
  });

  describe("enhanceImageWithGemini", () => {
    it("uses promptOverride if provided", async () => {
      await enhanceImageWithGemini({
        imageData: "base64data",
        mimeType: "image/jpeg",
        tier: "2K",
        promptOverride: "Make it brighter",
      });

      expect(analyzeImage).not.toHaveBeenCalled();
      expect(processGeminiStream).toHaveBeenCalledWith(expect.objectContaining({
        contents: expect.arrayContaining([
          expect.objectContaining({
            parts: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining("Make it brighter"),
              }),
            ]),
          }),
        ]),
      }));
    });

    it("analyzes image if no promptOverride provided", async () => {
      vi.mocked(analyzeImage).mockResolvedValue(
        { enhancementPrompt: "Auto-detected prompt" } as any,
      );

      await enhanceImageWithGemini({
        imageData: "base64data",
        mimeType: "image/jpeg",
        tier: "1K",
      });

      expect(analyzeImage).toHaveBeenCalledWith("base64data", "image/jpeg");
      expect(processGeminiStream).toHaveBeenCalledWith(expect.objectContaining({
        contents: expect.arrayContaining([
          expect.objectContaining({
            parts: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining("Auto-detected prompt"),
              }),
            ]),
          }),
        ]),
      }));
    });

    it("includes reference images if provided", async () => {
      vi.mocked(analyzeImage).mockResolvedValue(
        { enhancementPrompt: "foo" } as any,
      );

      await enhanceImageWithGemini({
        imageData: "base64data",
        mimeType: "image/jpeg",
        tier: "1K",
        referenceImages: [
          { imageData: "ref1", mimeType: "image/png" },
        ],
      });

      const callArg = vi.mocked(processGeminiStream).mock.calls[0]![0];
      const parts = callArg.contents![0]!.parts;

      // Should have 1 original image, 1 reference image, 1 text prompt
      expect(parts).toHaveLength(3);
      expect(parts[1]).toEqual({
        inlineData: { mimeType: "image/png", data: "ref1" },
      });
    });

    it("uses specific aspect ratio from dimensions if model supports image size", async () => {
      vi.mocked(supportsImageSize).mockReturnValue(true);
      vi.mocked(detectAspectRatio).mockReturnValue("4:3");

      await enhanceImageWithGemini({
        imageData: "base64data",
        mimeType: "image/jpeg",
        tier: "4K",
        originalWidth: 800,
        originalHeight: 600,
        promptOverride: "test",
      });

      expect(detectAspectRatio).toHaveBeenCalledWith(800, 600);
      const callArg = vi.mocked(processGeminiStream).mock.calls[0]![0];
      expect(callArg.config.imageConfig).toEqual({
        imageSize: "4K",
        aspectRatio: "4:3",
      });
    });

    it("uses specific aspect ratio but no imageSize if model does not support image size", async () => {
      vi.mocked(supportsImageSize).mockReturnValue(false);
      vi.mocked(detectAspectRatio).mockReturnValue("4:3");

      await enhanceImageWithGemini({
        imageData: "base64data",
        mimeType: "image/jpeg",
        tier: "1K",
        originalWidth: 800,
        originalHeight: 600,
        promptOverride: "test",
      });

      const callArg = vi.mocked(processGeminiStream).mock.calls[0]![0];
      expect(callArg.config.imageConfig).toEqual({
        aspectRatio: "4:3",
      });
    });

    it("generates config without imageConfig if no aspect ratio detected and no sizing support", async () => {
      vi.mocked(supportsImageSize).mockReturnValue(false);

      await enhanceImageWithGemini({
        imageData: "base64data",
        mimeType: "image/jpeg",
        tier: "1K",
        promptOverride: "test",
      });

      const callArg = vi.mocked(processGeminiStream).mock.calls[0]![0];
      expect(callArg.config.imageConfig).toBeUndefined();
    });
  });

  describe("generateImageWithGemini", () => {
    it("sends correct prompt and config to processGeminiStream", async () => {
      await generateImageWithGemini({
        prompt: "A cute cat",
        tier: "2K",
        negativePrompt: "dog, loud",
        aspectRatio: "16:9",
      });

      const callArg = vi.mocked(processGeminiStream).mock.calls[0]![0];
      expect(callArg.model).toBe("test-model");
      expect(callArg.operationType).toBe("generation");
      expect(callArg.config.imageConfig).toEqual({
        imageSize: "2K",
        aspectRatio: "16:9",
      });

      const promptText = callArg.contents![0]!.parts![0]!.text;
      expect(promptText).toContain("A cute cat");
      expect(promptText).toContain("Avoid: dog, loud");
    });

    it("handles case where model does not support image size", async () => {
      vi.mocked(supportsImageSize).mockReturnValue(false);

      await generateImageWithGemini({
        prompt: "A cute cat",
        tier: "2K",
        aspectRatio: "16:9",
      });

      const callArg = vi.mocked(processGeminiStream).mock.calls[0]![0];
      expect(callArg.config.imageConfig).toEqual({ aspectRatio: "16:9" });
    });
  });

  describe("modifyImageWithGemini", () => {
    it("sends correct prompt and image inline data to processGeminiStream", async () => {
      await modifyImageWithGemini({
        prompt: "Make it night time",
        imageData: "img-data",
        mimeType: "image/jpeg",
        tier: "1K",
      });

      const callArg = vi.mocked(processGeminiStream).mock.calls[0]![0];
      expect(callArg.operationType).toBe("modification");
      expect(callArg.config.imageConfig).toEqual({ imageSize: "1K" }); // no aspect ratio provided

      const parts = callArg.contents![0]!.parts;
      expect(parts).toHaveLength(2);
      expect(parts[0]).toEqual({
        inlineData: { mimeType: "image/jpeg", data: "img-data" },
      });
      expect(parts![1]!.text).toContain("Make it night time");
    });

    it("handles case where model does not support image size and aspect ratio provided", async () => {
      vi.mocked(supportsImageSize).mockReturnValue(false);

      await modifyImageWithGemini({
        prompt: "test",
        imageData: "img",
        mimeType: "image/png",
        tier: "4K",
        aspectRatio: "9:16",
      });

      const callArg = vi.mocked(processGeminiStream).mock.calls[0]![0];
      expect(callArg.config.imageConfig).toEqual({ aspectRatio: "9:16" });
    });
  });
});
