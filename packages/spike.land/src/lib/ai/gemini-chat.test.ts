import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateAgentResponse,
  generateStructuredResponse,
  StructuredResponseParseError,
} from "./gemini-chat";
import { getGeminiClient } from "./gemini-client";

vi.mock("./gemini-client", () => ({
  getGeminiClient: vi.fn(),
}));

vi.mock("@/lib/try-catch", () => ({
  tryCatch: vi.fn((p) =>
    p
      .then((data: unknown) => ({ data, error: null }))
      .catch((error: unknown) => ({
        data: null,
        error,
      })),
  ),
}));

describe("gemini-chat", () => {
  const mockGenerateContent = vi.fn();
  const mockAi = { models: { generateContent: mockGenerateContent } };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGeminiClient).mockResolvedValue(
      mockAi as unknown as Awaited<ReturnType<typeof getGeminiClient>>,
    );
  });

  describe("generateAgentResponse", () => {
    it("generates response with default system prompt", async () => {
      mockGenerateContent.mockResolvedValue({ text: "Hello user" });

      const res = await generateAgentResponse({
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(res).toBe("Hello user");
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: [{ role: "user", parts: [{ text: "Hi" }] }],
          config: expect.objectContaining({
            systemInstruction: expect.stringContaining("helpful AI assistant"),
          }),
        }),
      );
    });

    it("uses provided system prompt", async () => {
      mockGenerateContent.mockResolvedValue({ text: "Custom response" });

      await generateAgentResponse({
        messages: [{ role: "user", content: "Hi" }],
        systemPrompt: "Custom prompt",
      });

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            systemInstruction: "Custom prompt",
          }),
        }),
      );
    });

    it("throws if generation fails", async () => {
      mockGenerateContent.mockRejectedValue(new Error("API Error"));

      await expect(generateAgentResponse({ messages: [] })).rejects.toThrow(
        "Failed to generate agent response: API Error",
      );
    });

    it("throws if empty text returned", async () => {
      mockGenerateContent.mockResolvedValue({ text: "" });
      await expect(generateAgentResponse({ messages: [] })).rejects.toThrow(
        "No response text received",
      );
    });
  });

  describe("generateStructuredResponse", () => {
    it("parses valid JSON response", async () => {
      mockGenerateContent.mockResolvedValue({ text: '{"key": "value"}' });

      const res = await generateStructuredResponse<{ key: string }>({
        prompt: "Give me JSON",
      });

      expect(res.key).toBe("value");
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: [{ role: "user", parts: [{ text: "Give me JSON" }] }],
          config: expect.objectContaining({
            responseMimeType: "application/json",
          }),
        }),
      );
    });

    it("strips markdown blocks from JSON", async () => {
      mockGenerateContent.mockResolvedValue({
        text: '```json\n{"key": "value2"}\n```',
      });

      const res = await generateStructuredResponse<{ key: string }>({
        prompt: "JSON",
      });

      expect(res.key).toBe("value2");
    });

    it("strips generic markdown blocks", async () => {
      mockGenerateContent.mockResolvedValue({
        text: '```\n{"key": "value3"}\n```',
      });

      const res = await generateStructuredResponse<{ key: string }>({
        prompt: "JSON",
      });

      expect(res.key).toBe("value3");
    });

    it("passes thinking budget and schema", async () => {
      mockGenerateContent.mockResolvedValue({ text: '{"ok": true}' });

      await generateStructuredResponse({
        prompt: "test",
        thinkingBudget: 100,
        responseJsonSchema: { type: "object" },
      });

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            thinkingConfig: { thinkingBudget: 100 },
            responseJsonSchema: { type: "object" },
          }),
        }),
      );
    });

    it("throws StructuredResponseParseError on invalid JSON", async () => {
      mockGenerateContent.mockResolvedValue({ text: "invalid json" });

      await expect(generateStructuredResponse({ prompt: "test" })).rejects.toThrow(
        StructuredResponseParseError,
      );
    });

    it("throws on generation failure", async () => {
      mockGenerateContent.mockRejectedValue(new Error("Generation failed"));

      await expect(generateStructuredResponse({ prompt: "test" })).rejects.toThrow(
        "Failed to generate structured response: Generation failed",
      );
    });

    it("throws on empty text", async () => {
      mockGenerateContent.mockResolvedValue({ text: "" });

      await expect(generateStructuredResponse({ prompt: "test" })).rejects.toThrow(
        "No response text received",
      );
    });
  });

  describe("StructuredResponseParseError", () => {
    it("stores raw text and message", () => {
      const err = new StructuredResponseParseError("test msg", "raw");
      expect(err.message).toBe("test msg");
      expect(err.rawText).toBe("raw");
      expect(err.name).toBe("StructuredResponseParseError");
    });
  });
});
