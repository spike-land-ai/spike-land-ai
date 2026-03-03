import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadEnabledCategories, saveEnabledCategories } from "./category-persistence";

// Mock the Redis client
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();

vi.mock("@/lib/upstash/client", () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
  },
}));

describe("category-persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadEnabledCategories", () => {
    it("returns categories from Redis when stored as JSON string", async () => {
      mockRedisGet.mockResolvedValue(JSON.stringify(["chat", "storage", "blog"]));

      const result = await loadEnabledCategories("user-123");

      expect(mockRedisGet).toHaveBeenCalledWith("mcp:enabled-categories:user-123");
      expect(result).toEqual(["chat", "storage", "blog"]);
    });

    it("returns categories when Redis returns a pre-parsed array", async () => {
      // Some Redis clients auto-parse JSON
      mockRedisGet.mockResolvedValue(["chat", "storage"]);

      const result = await loadEnabledCategories("user-123");

      expect(result).toEqual(["chat", "storage"]);
    });

    it("returns empty array when no state exists in Redis", async () => {
      mockRedisGet.mockResolvedValue(null);

      const result = await loadEnabledCategories("user-123");

      expect(result).toEqual([]);
    });

    it("returns empty array when Redis returns empty string", async () => {
      mockRedisGet.mockResolvedValue("");

      const result = await loadEnabledCategories("user-123");

      expect(result).toEqual([]);
    });

    it("returns empty array on Redis failure (graceful fallback)", async () => {
      mockRedisGet.mockRejectedValue(new Error("Connection refused"));

      const result = await loadEnabledCategories("user-123");

      expect(result).toEqual([]);
    });

    it("filters out non-string values from stored array", async () => {
      mockRedisGet.mockResolvedValue(JSON.stringify(["chat", 42, null, "blog", true]));

      const result = await loadEnabledCategories("user-123");

      expect(result).toEqual(["chat", "blog"]);
    });

    it("returns empty array for invalid JSON", async () => {
      mockRedisGet.mockResolvedValue("not-valid-json{");

      const result = await loadEnabledCategories("user-123");

      expect(result).toEqual([]);
    });

    it("returns empty array when stored value is not an array", async () => {
      mockRedisGet.mockResolvedValue(JSON.stringify({ foo: "bar" }));

      const result = await loadEnabledCategories("user-123");

      expect(result).toEqual([]);
    });
  });

  describe("saveEnabledCategories", () => {
    it("saves categories as JSON to Redis with TTL", async () => {
      mockRedisSet.mockResolvedValue("OK");

      await saveEnabledCategories("user-123", ["chat", "storage"]);

      expect(mockRedisSet).toHaveBeenCalledWith(
        "mcp:enabled-categories:user-123",
        JSON.stringify(["chat", "storage"]),
        { ex: 7 * 24 * 60 * 60 },
      );
    });

    it("saves empty array when no categories are enabled", async () => {
      mockRedisSet.mockResolvedValue("OK");

      await saveEnabledCategories("user-456", []);

      expect(mockRedisSet).toHaveBeenCalledWith(
        "mcp:enabled-categories:user-456",
        JSON.stringify([]),
        { ex: 7 * 24 * 60 * 60 },
      );
    });

    it("silently handles Redis failure", async () => {
      mockRedisSet.mockRejectedValue(new Error("Connection refused"));

      // Should not throw
      await expect(
        saveEnabledCategories("user-123", ["chat"]),
      ).resolves.toBeUndefined();
    });
  });
});
