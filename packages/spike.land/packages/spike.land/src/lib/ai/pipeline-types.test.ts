import { describe, expect, it } from "vitest";
import {
  isValidPipelineConfig,
  parsePipelineConfig,
  SYSTEM_DEFAULT_PIPELINE,
} from "./pipeline-types";
import type {
  AnalysisConfig,
  AutoCropConfig,
  GenerationConfig,
  PipelineDbConfigs,
  PromptConfig,
} from "./pipeline-types";

describe("pipeline-types", () => {
  describe("parsePipelineConfig", () => {
    it("uses defaults when configs are null", () => {
      const dbConfigs: PipelineDbConfigs = {
        analysisConfig: null,
        autoCropConfig: null,
        promptConfig: null,
        generationConfig: null,
      };

      const config = parsePipelineConfig("TIER_1K", dbConfigs);

      expect(config.tier).toBe("TIER_1K");
      expect(config.analysis).toEqual(SYSTEM_DEFAULT_PIPELINE.analysis);
      expect(config.autoCrop).toEqual(SYSTEM_DEFAULT_PIPELINE.autoCrop);
      expect(config.prompt).toEqual(SYSTEM_DEFAULT_PIPELINE.prompt);
      expect(config.generation).toEqual(SYSTEM_DEFAULT_PIPELINE.generation);
    });

    it("merges provided configs over defaults", () => {
      const analysisConfig: AnalysisConfig = { enabled: false, model: "test" };
      const autoCropConfig: AutoCropConfig = { enabled: false };
      const promptConfig: PromptConfig = { customInstructions: "do it" };
      const generationConfig: GenerationConfig = { retryAttempts: 5 };

      const dbConfigs: PipelineDbConfigs = {
        analysisConfig,
        autoCropConfig,
        promptConfig,
        generationConfig,
      };

      const config = parsePipelineConfig("TIER_2K", dbConfigs);

      expect(config.tier).toBe("TIER_2K");
      expect(config.analysis).toEqual(analysisConfig);
      expect(config.autoCrop).toEqual(autoCropConfig);
      expect(config.prompt).toEqual(promptConfig);
      expect(config.generation).toEqual(generationConfig);
    });
  });

  describe("isValidPipelineConfig", () => {
    it("returns true for a valid PipelineConfig", () => {
      const config = {
        tier: "TIER_1K",
        analysis: {},
        autoCrop: {},
        prompt: {},
        generation: {},
      };
      expect(isValidPipelineConfig(config)).toBe(true);
    });

    it("returns false for null", () => {
      expect(isValidPipelineConfig(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isValidPipelineConfig(undefined)).toBe(false);
    });

    it("returns false for string", () => {
      expect(isValidPipelineConfig("string")).toBe(false);
    });

    it("returns false for missing tier", () => {
      const config = {
        analysis: {},
        autoCrop: {},
        prompt: {},
        generation: {},
      };
      expect(isValidPipelineConfig(config)).toBe(false);
    });

    it("returns false for invalid tier", () => {
      const config = {
        tier: "INVALID_TIER",
        analysis: {},
        autoCrop: {},
        prompt: {},
        generation: {},
      };
      expect(isValidPipelineConfig(config)).toBe(false);
    });

    it("returns false for missing config section", () => {
      const config = {
        tier: "TIER_1K",
        // missing analysis
        autoCrop: {},
        prompt: {},
        generation: {},
      };
      expect(isValidPipelineConfig(config)).toBe(false);
    });

    it("returns false if a section is null", () => {
      const config = {
        tier: "TIER_1K",
        analysis: null,
        autoCrop: {},
        prompt: {},
        generation: {},
      };
      expect(isValidPipelineConfig(config)).toBe(false);
    });

    it("returns false if a section is not an object", () => {
      const config = {
        tier: "TIER_1K",
        analysis: {},
        autoCrop: "string", // Should be object
        prompt: {},
        generation: {},
      };
      expect(isValidPipelineConfig(config)).toBe(false);
    });
  });
});
