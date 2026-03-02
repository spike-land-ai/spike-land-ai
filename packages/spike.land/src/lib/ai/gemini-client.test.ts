import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGeminiClient, isGeminiConfigured, resetGeminiClient } from "./gemini-client";
import { GoogleGenAI } from "@google/genai";
import { resolveAIProviderConfig } from "./ai-config-resolver";

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(),
}));

vi.mock("./ai-config-resolver", () => ({
  resolveAIProviderConfig: vi.fn(),
}));

describe("gemini-client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    resetGeminiClient();
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getGeminiClient", () => {
    it("uses config token if available", async () => {
      vi.mocked(resolveAIProviderConfig).mockResolvedValue({
        token: "db-token",
      } as unknown as Awaited<ReturnType<typeof resolveAIProviderConfig>>);

      const client = await getGeminiClient();
      expect(resolveAIProviderConfig).toHaveBeenCalledWith("google");
      expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: "db-token" });
      expect(client).toBeDefined();
    });

    it("falls back to GEMINI_API_KEY env if config has no token", async () => {
      process.env.GEMINI_API_KEY = "env-key";
      vi.mocked(resolveAIProviderConfig).mockResolvedValue(null);

      await getGeminiClient();
      expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: "env-key" });
    });

    it("throws an error if no config and no env key", async () => {
      vi.mocked(resolveAIProviderConfig).mockResolvedValue(null);

      await expect(getGeminiClient()).rejects.toThrow(
        "GEMINI_API_KEY environment variable is not set",
      );
    });

    it("returns cached client on subsequent calls", async () => {
      process.env.GEMINI_API_KEY = "env-key";
      vi.mocked(resolveAIProviderConfig).mockResolvedValue(null);

      const client1 = await getGeminiClient();
      const client2 = await getGeminiClient();

      expect(client1).toBe(client2);
      expect(GoogleGenAI).toHaveBeenCalledTimes(1);
    });
  });

  describe("isGeminiConfigured", () => {
    it("returns true if config has token", async () => {
      vi.mocked(resolveAIProviderConfig).mockResolvedValue({
        token: "db-token",
      } as unknown as Awaited<ReturnType<typeof resolveAIProviderConfig>>);
      expect(await isGeminiConfigured()).toBe(true);
    });

    it("returns true if env key exists", async () => {
      process.env.GEMINI_API_KEY = "env-key";
      vi.mocked(resolveAIProviderConfig).mockResolvedValue(null);
      expect(await isGeminiConfigured()).toBe(true);
    });

    it("returns false if neither exists", async () => {
      vi.mocked(resolveAIProviderConfig).mockResolvedValue(null);
      expect(await isGeminiConfigured()).toBe(false);
    });
  });
});
