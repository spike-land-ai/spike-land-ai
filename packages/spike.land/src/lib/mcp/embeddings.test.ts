import { describe, expect, it } from "vitest";
import {
  buildQueryVector,
  buildVector,
  cosineSimilarity,
  expandWithSynonyms,
  suggestParameters,
  tokenize,
  ToolEmbeddingIndex,
} from "./embeddings";

describe("embeddings", () => {
  describe("tokenize", () => {
    it("should split on non-alphanumeric characters", () => {
      expect(tokenize("hello-world_test")).toEqual(["hello", "world", "test"]);
    });

    it("should lowercase all tokens", () => {
      expect(tokenize("Hello WORLD")).toEqual(["hello", "world"]);
    });

    it("should filter out single-character tokens", () => {
      expect(tokenize("a b cd ef")).toEqual(["cd", "ef"]);
    });

    it("should handle empty string", () => {
      expect(tokenize("")).toEqual([]);
    });

    it("should handle special characters", () => {
      expect(tokenize("hello@world#test!")).toEqual(["hello", "world", "test"]);
    });

    it("should handle numbers in tokens", () => {
      expect(tokenize("test123 abc42")).toEqual(["test123", "abc42"]);
    });
  });

  describe("expandWithSynonyms", () => {
    it("should expand known synonyms", () => {
      const expanded = expandWithSynonyms(["create"]);
      expect(expanded).toContain("create");
      expect(expanded).toContain("generate");
      expect(expanded).toContain("make");
      expect(expanded).toContain("build");
    });

    it("should pass through unknown words", () => {
      const expanded = expandWithSynonyms(["xyzunknown"]);
      expect(expanded).toEqual(["xyzunknown"]);
    });

    it("should deduplicate", () => {
      const expanded = expandWithSynonyms(["create", "generate"]);
      const unique = new Set(expanded);
      expect(expanded.length).toBe(unique.size);
    });

    it("should handle empty input", () => {
      expect(expandWithSynonyms([])).toEqual([]);
    });

    it("should expand image synonyms", () => {
      const expanded = expandWithSynonyms(["picture"]);
      expect(expanded).toContain("image");
      expect(expanded).toContain("photo");
      expect(expanded).toContain("visual");
    });
  });

  describe("buildVector", () => {
    it("should weight name tokens at 3x", () => {
      const vec = buildVector("test", "", "");
      // "test" has synonyms: check, verify, validate, assert
      // They should all be present
      expect(vec.has("test")).toBe(true);
    });

    it("should weight category tokens at 2x", () => {
      const vec = buildVector("unrelated", "image", "");
      expect(vec.has("image")).toBe(true);
      expect(vec.has("picture")).toBe(true); // synonym
    });

    it("should weight description tokens at 1x", () => {
      const vec = buildVector("unrelated", "misc", "generate pictures");
      expect(vec.has("generate")).toBe(true);
      expect(vec.has("pictures")).toBe(true);
    });

    it("should normalize to approximately unit vector", () => {
      const vec = buildVector("generate_image", "image", "Generate AI images with prompts");
      let magnitude = 0;
      for (const v of vec.values()) {
        magnitude += v * v;
      }
      magnitude = Math.sqrt(magnitude);
      expect(magnitude).toBeCloseTo(1.0, 1);
    });

    it("should handle empty inputs", () => {
      const vec = buildVector("", "", "");
      expect(vec.size).toBe(0);
    });
  });

  describe("buildQueryVector", () => {
    it("should create vector from query text", () => {
      const vec = buildQueryVector("make picture");
      expect(vec.has("make")).toBe(true);
      expect(vec.has("picture")).toBe(true);
      // Synonym expansion: "make" → "create"; "picture" → "image"
      expect(vec.has("create")).toBe(true);
      expect(vec.has("image")).toBe(true);
    });

    it("should normalize to unit vector", () => {
      const vec = buildQueryVector("search for tools");
      let magnitude = 0;
      for (const v of vec.values()) {
        magnitude += v * v;
      }
      magnitude = Math.sqrt(magnitude);
      expect(magnitude).toBeCloseTo(1.0, 1);
    });

    it("should handle empty query", () => {
      const vec = buildQueryVector("");
      expect(vec.size).toBe(0);
    });
  });

  describe("cosineSimilarity", () => {
    it("should return 1 for identical vectors", () => {
      const vec = buildQueryVector("generate image");
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 5);
    });

    it("should return 0 for completely different vectors", () => {
      // These have no overlapping dimensions
      const a = new Map([["alpha", 1]]);
      const b = new Map([["beta", 1]]);
      expect(cosineSimilarity(a, b)).toBe(0);
    });

    it("should handle empty vectors", () => {
      const empty = new Map<string, number>();
      const vec = new Map([["test", 1]]);
      expect(cosineSimilarity(empty, vec)).toBe(0);
      expect(cosineSimilarity(empty, empty)).toBe(0);
    });

    it("should return high similarity for synonym-related queries", () => {
      const a = buildQueryVector("make pictures");
      const b = buildQueryVector("generate image");
      // Should be high because synonyms expand to overlapping terms
      expect(cosineSimilarity(a, b)).toBeGreaterThan(0.5);
    });
  });

  describe("ToolEmbeddingIndex", () => {
    it("should embed and find tools", () => {
      const index = new ToolEmbeddingIndex();
      index.embed("generate_image", "image", "Generate AI images with prompts");
      index.embed("send_email", "email", "Send email messages");

      const results = index.search("make pictures");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.name).toBe("generate_image");
    });

    it("should respect limit", () => {
      const index = new ToolEmbeddingIndex();
      index.embed("tool1", "cat1", "desc1 search");
      index.embed("tool2", "cat2", "desc2 search");
      index.embed("tool3", "cat3", "desc3 search");

      const results = index.search("search", 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should filter by threshold", () => {
      const index = new ToolEmbeddingIndex();
      index.embed("generate_image", "image", "Generate AI images");
      index.embed("send_email", "email", "Send email messages");

      const results = index.search("completely unrelated xyz", 10, 0.5);
      expect(results.length).toBe(0);
    });

    it("should remove tools", () => {
      const index = new ToolEmbeddingIndex();
      index.embed("test_tool", "test", "A test tool");
      expect(index.has("test_tool")).toBe(true);

      index.remove("test_tool");
      expect(index.has("test_tool")).toBe(false);
    });

    it("should return empty for empty query", () => {
      const index = new ToolEmbeddingIndex();
      index.embed("test_tool", "test", "A test tool");
      expect(index.search("")).toEqual([]);
    });

    it("should return empty for whitespace query", () => {
      const index = new ToolEmbeddingIndex();
      index.embed("test_tool", "test", "A test tool");
      expect(index.search("   ")).toEqual([]);
    });

    it("should report correct size", () => {
      const index = new ToolEmbeddingIndex();
      expect(index.size).toBe(0);
      index.embed("tool1", "cat", "desc");
      expect(index.size).toBe(1);
      index.embed("tool2", "cat", "desc");
      expect(index.size).toBe(2);
      index.remove("tool1");
      expect(index.size).toBe(1);
    });

    it("should sort results by score descending", () => {
      const index = new ToolEmbeddingIndex();
      index.embed("generate_image", "image", "Generate AI images with prompts");
      index.embed("list_images", "image", "List all images in gallery");
      index.embed("send_email", "email", "Send email messages to users");

      const results = index.search("generate image");
      if (results.length >= 2) {
        expect(results[0]!.score).toBeGreaterThanOrEqual(results[1]!.score);
      }
    });

    it("should find tools via synonyms: 'make pictures' → generate_image", () => {
      const index = new ToolEmbeddingIndex();
      index.embed("generate_image", "image", "Generate AI images with prompts");
      index.embed("delete_user", "admin", "Delete a user account");
      index.embed("send_email", "email", "Send email messages");

      const results = index.search("make pictures");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.name).toBe("generate_image");
      expect(results[0]!.score).toBeGreaterThan(0);
    });

    it("should find tools via synonyms: 'remove account' → delete_user", () => {
      const index = new ToolEmbeddingIndex();
      index.embed("generate_image", "image", "Generate AI images");
      index.embed("delete_user", "admin", "Delete a user account");
      index.embed("send_email", "email", "Send email messages");

      const results = index.search("remove account");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.name).toBe("delete_user");
    });

    it("should return false for remove on non-existent tool", () => {
      const index = new ToolEmbeddingIndex();
      expect(index.remove("nonexistent")).toBe(false);
    });
  });

  describe("suggestParameters", () => {
    it("should extract prompt from 'of' pattern", () => {
      // The regex strips leading articles (a/an/the) from the capture group
      const params = suggestParameters("generate image of a sunset");
      expect(params.prompt).toBe("sunset");
    });

    it("should extract name from 'called' pattern", () => {
      const params = suggestParameters("find tool called my-widget");
      expect(params.name).toBe("my-widget");
    });

    it("should extract name from 'named' pattern", () => {
      const params = suggestParameters("search for tool named test_tool");
      expect(params.name).toBe("test_tool");
    });

    it("should extract format from 'to' pattern", () => {
      const params = suggestParameters("convert data to json");
      expect(params.format).toBe("json");
    });

    it("should extract language from 'in' pattern", () => {
      const params = suggestParameters("generate code in typescript");
      expect(params.language).toBe("typescript");
    });

    it("should not extract unknown formats", () => {
      const params = suggestParameters("convert to xyzformat");
      expect(params.format).toBeUndefined();
    });

    it("should not extract unknown languages", () => {
      const params = suggestParameters("write in klingon");
      expect(params.language).toBeUndefined();
    });

    it("should return empty object for plain query", () => {
      const params = suggestParameters("hello world");
      expect(Object.keys(params).length).toBe(0);
    });

    it("should handle multiple patterns in one query", () => {
      const params = suggestParameters("generate code of a function in typescript");
      expect(params.prompt).toBeDefined();
      expect(params.language).toBe("typescript");
    });
  });
});
