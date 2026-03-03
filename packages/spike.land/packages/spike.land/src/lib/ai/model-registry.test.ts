import { describe, expect, it } from "vitest";
import {
  getModelsByCapability,
  getModelsForProvider,
  resolveModel,
  resolveProvider,
} from "./model-registry";

describe("model-registry", () => {
  describe("resolveModel", () => {
    it("should resolve a model by exact ID", () => {
      const model = resolveModel("claude-opus-4-6");
      expect(model).toBeDefined();
      expect(model?.id).toBe("claude-opus-4-6");
    });

    it("should resolve a model by alias", () => {
      const model = resolveModel("opus");
      expect(model).toBeDefined();
      expect(model?.id).toBe("claude-opus-4-6");

      const gemini = resolveModel("flash");
      expect(gemini?.id).toBe("gemini-3-flash-preview");
    });

    it("should be case-insensitive", () => {
      const model = resolveModel("CLAUDE-OPUS-4-6");
      expect(model?.id).toBe("claude-opus-4-6");

      const alias = resolveModel("OpUs");
      expect(alias?.id).toBe("claude-opus-4-6");
    });

    it("should return correct displayName for sonnet", () => {
      const model = resolveModel("sonnet");
      expect(model?.displayName).toBe("Claude Sonnet 4.6");
    });

    it("should return undefined for unknown models", () => {
      const model = resolveModel("unknown-model-xyz");
      expect(model).toBeUndefined();
    });
  });

  describe("resolveProvider", () => {
    it("should return explicitly provided provider", () => {
      expect(resolveProvider(undefined, "anthropic")).toBe("anthropic");
      expect(resolveProvider(undefined, "google")).toBe("google");
    });

    it("should resolve provider from known model ID or alias", () => {
      expect(resolveProvider("claude-opus-4-6")).toBe("anthropic");
      expect(resolveProvider("opus")).toBe("anthropic");
      expect(resolveProvider("gemini-3-flash-preview")).toBe("google");
      expect(resolveProvider("flash")).toBe("google");
    });

    it("should use heuristic for unknown models starting with vendor names", () => {
      expect(resolveProvider("gemini-future-model")).toBe("google");
      expect(resolveProvider("claude-future-model")).toBe("anthropic");
    });

    it("should fallback to anthropic as default", () => {
      expect(resolveProvider()).toBe("anthropic");
      expect(resolveProvider("completely-unknown-model")).toBe("anthropic");
    });
  });

  describe("getModelsForProvider", () => {
    it("should return models for a given provider", () => {
      const anthropicModels = getModelsForProvider("anthropic");
      expect(anthropicModels.length).toBeGreaterThan(0);
      anthropicModels.forEach(m => expect(m.provider).toBe("anthropic"));

      const googleModels = getModelsForProvider("google");
      expect(googleModels.length).toBeGreaterThan(0);
      googleModels.forEach(m => expect(m.provider).toBe("google"));
    });

    it("should return empty array for unknown provider", () => {
      const models = getModelsForProvider("openai");
      expect(models).toEqual([]);
    });
  });

  describe("getModelsByCapability", () => {
    it("should return models with the specified capability", () => {
      const visionModels = getModelsByCapability("vision");
      expect(visionModels.length).toBeGreaterThan(0);
      visionModels.forEach(m => expect(m.capabilities).toContain("vision"));

      const chatModels = getModelsByCapability("chat");
      expect(chatModels.length).toBeGreaterThan(0);
      chatModels.forEach(m => expect(m.capabilities).toContain("chat"));

      const imageModels = getModelsByCapability("image-gen");
      expect(imageModels.length).toBeGreaterThan(0);
      imageModels.forEach(m => expect(m.capabilities).toContain("image-gen"));
    });

    it("should return empty array for unmapped capability", () => {
      const results = getModelsByCapability("telepathy");
      expect(results).toEqual([]);
    });
  });
});
