import { describe, expect, it } from "vitest";
import { validatePipelineConfigs } from "./pipeline-validation";

describe("pipeline-validation", () => {
  describe("validatePipelineConfigs", () => {
    it("validates empty object successfully", () => {
      const result = validatePipelineConfigs({});
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual({});
      expect(result.validatedData).toEqual({});
    });

    it("validates valid analysisConfig", () => {
      const data = {
        analysisConfig: {
          enabled: true,
          model: "gemini-test",
          temperature: 0.5,
        },
      };
      const result = validatePipelineConfigs(data);
      expect(result.valid).toBe(true);
      expect(result.validatedData?.analysisConfig).toEqual(data.analysisConfig);
    });

    it("catches invalid analysisConfig", () => {
      const data = {
        analysisConfig: {
          enabled: "not-a-boolean",
        },
      };
      const result = validatePipelineConfigs(data);
      expect(result.valid).toBe(false);
      expect(result.errors.analysisConfig).toBeDefined();
      expect(result.errors.analysisConfig![0]).toContain("expected boolean");
      expect(result.validatedData).toBeUndefined();
    });

    it("validates valid autoCropConfig", () => {
      const data = {
        autoCropConfig: {
          enabled: false,
          minCropRatio: 0.8,
          allowBlackBarRemoval: true,
          allowUIElementCrop: false,
        },
      };
      const result = validatePipelineConfigs(data);
      expect(result.valid).toBe(true);
      expect(result.validatedData?.autoCropConfig).toEqual(data.autoCropConfig);
    });

    it("catches invalid autoCropConfig", () => {
      const data = {
        autoCropConfig: {
          enabled: true,
          minCropRatio: 1.5, // Max is 1
        },
      };
      const result = validatePipelineConfigs(data);
      expect(result.valid).toBe(false);
      expect(result.errors.autoCropConfig![0]).toContain("Too big");
    });

    it("validates valid promptConfig", () => {
      const data = {
        promptConfig: {
          defectOverrides: {
            isDark: true,
            isBlurry: false,
          },
          customInstructions: "Make it pop",
          skipCorrections: ["hasNoise"],
          referenceImages: [
            {
              url: "https://example.com/img.png",
              r2Key: "key/1.png",
              description: "desc",
            },
          ],
        },
      } as unknown as Parameters<typeof validatePipelineConfigs>[0];
      const result = validatePipelineConfigs(data);
      expect(result.valid).toBe(true);
      expect(result.validatedData?.promptConfig).toEqual(data.promptConfig);
    });

    it("catches invalid promptConfig", () => {
      const data = {
        promptConfig: {
          skipCorrections: ["invalidDefect"],
        },
      };
      const result = validatePipelineConfigs(data);
      expect(result.valid).toBe(false);
      expect(result.errors.promptConfig!.length).toBeGreaterThan(0);
    });

    it("validates valid generationConfig", () => {
      const data = {
        generationConfig: {
          model: "model-a",
          temperature: 1.5,
          retryAttempts: 3,
        },
      };
      const result = validatePipelineConfigs(data);
      expect(result.valid).toBe(true);
      expect(result.validatedData?.generationConfig).toEqual(data.generationConfig);
    });

    it("catches invalid generationConfig", () => {
      const data = {
        generationConfig: {
          model: "model-a",
          retryAttempts: -1, // Min is 0
        },
      };
      const result = validatePipelineConfigs(data);
      expect(result.valid).toBe(false);
      expect(result.errors.generationConfig![0]).toContain("Too small");
    });

    it("validates all configs together successfully", () => {
      const data = {
        analysisConfig: { enabled: true },
        autoCropConfig: { enabled: true },
        promptConfig: { customInstructions: "test" },
        generationConfig: { retryAttempts: 5 },
      };
      const result = validatePipelineConfigs(data);
      expect(result.valid).toBe(true);
      expect(result.validatedData).toEqual(data);
    });

    it("accumulates multiple errors", () => {
      const data = {
        analysisConfig: { enabled: "invalid" },
        autoCropConfig: { minCropRatio: 2 },
      };
      const result = validatePipelineConfigs(data);
      expect(result.valid).toBe(false);
      expect(result.errors.analysisConfig).toBeDefined();
      expect(result.errors.autoCropConfig).toBeDefined();
    });
  });
});
