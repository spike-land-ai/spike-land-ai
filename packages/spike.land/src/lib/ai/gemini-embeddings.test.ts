import { beforeEach, describe, expect, it, vi } from "vitest";
import { cosineSimilarity, embedText } from "./gemini-embeddings";
import { getGeminiClient } from "./gemini-client";

vi.mock("./gemini-client", () => ({
  getGeminiClient: vi.fn(),
}));

describe("gemini-embeddings", () => {
  const mockEmbedContent = vi.fn();
  const mockAi = { models: { embedContent: mockEmbedContent } };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGeminiClient).mockResolvedValue(
      mockAi as unknown as Awaited<ReturnType<typeof getGeminiClient>>,
    );
  });

  describe("embedText", () => {
    it("returns embeddings when successful", async () => {
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: [0.1, 0.2, 0.3] }],
      });

      const result = await embedText("hello world");

      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(mockEmbedContent).toHaveBeenCalledWith({
        model: "text-embedding-004",
        contents: "hello world",
      });
    });

    it("returns empty array when embeddings are missing", async () => {
      mockEmbedContent.mockResolvedValue({});

      const result = await embedText("test");
      expect(result).toEqual([]);
    });

    it("returns empty array when values are missing", async () => {
      mockEmbedContent.mockResolvedValue({
        embeddings: [{}],
      });

      const result = await embedText("test");
      expect(result).toEqual([]);
    });
  });

  describe("cosineSimilarity", () => {
    it("calculates identical vectors as 1", () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2, 3];
      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(1.0);
    });

    it("calculates orthogonal vectors as 0", () => {
      const vec1 = [1, 0];
      const vec2 = [0, 1];
      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(0);
    });

    it("calculates opposite vectors as -1", () => {
      const vec1 = [1, 1];
      const vec2 = [-1, -1];
      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(-1.0);
    });

    it("returns 0 for vectors of different lengths", () => {
      const vec1 = [1, 2];
      const vec2 = [1, 2, 3];
      expect(cosineSimilarity(vec1, vec2)).toBe(0);
    });

    it("returns 0 for empty vectors", () => {
      expect(cosineSimilarity([], [])).toBe(0);
    });

    it("returns 0 for zero vectors", () => {
      const vec1 = [0, 0];
      const vec2 = [1, 1];
      expect(cosineSimilarity(vec1, vec2)).toBe(0);
      expect(cosineSimilarity(vec2, vec1)).toBe(0);
    });
  });
});
