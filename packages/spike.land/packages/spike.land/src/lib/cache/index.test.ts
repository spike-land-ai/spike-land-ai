import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRedis = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
}));

vi.mock("@/lib/upstash/client", () => ({
  redis: mockRedis,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  cachedPrismaQuery,
  getCache,
  getCacheRaw,
  invalidateCache,
  setCacheRaw,
} from "./index";

describe("cache utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getCache", () => {
    it("returns cached value on cache hit without calling fetcher", async () => {
      const cached = { id: 1, name: "cached-item" };
      mockRedis.get.mockResolvedValueOnce(cached);
      const fetcher = vi.fn().mockResolvedValue({ id: 1, name: "fresh-item" });

      const result = await getCache("test-key", 300, fetcher);

      expect(result).toEqual(cached);
      expect(fetcher).not.toHaveBeenCalled();
      expect(mockRedis.get).toHaveBeenCalledWith("test-key");
    });

    it("calls fetcher and stores result on cache miss", async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      const fresh = { id: 2, name: "fresh-item" };
      const fetcher = vi.fn().mockResolvedValue(fresh);

      const result = await getCache("miss-key", 600, fetcher);

      expect(result).toEqual(fresh);
      expect(fetcher).toHaveBeenCalledOnce();
      expect(mockRedis.set).toHaveBeenCalledWith("miss-key", fresh, { ex: 600 });
    });

    it("falls back to fetcher when Redis get throws", async () => {
      mockRedis.get.mockRejectedValueOnce(new Error("Redis connection failed"));
      const fresh = { id: 3, name: "fallback-item" };
      const fetcher = vi.fn().mockResolvedValue(fresh);

      const result = await getCache("error-key", 120, fetcher);

      expect(result).toEqual(fresh);
      expect(fetcher).toHaveBeenCalledOnce();
      // Should not attempt to set cache when Redis is down
      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  describe("getCacheRaw", () => {
    it("returns cached value when present", async () => {
      const data = { users: [1, 2, 3] };
      mockRedis.get.mockResolvedValueOnce(data);

      const result = await getCacheRaw<{ users: number[]; }>("raw-key");

      expect(result).toEqual(data);
    });

    it("returns null when key not found", async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await getCacheRaw("missing-key");

      expect(result).toBeNull();
    });

    it("returns null on Redis error", async () => {
      mockRedis.get.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await getCacheRaw("error-key");

      expect(result).toBeNull();
    });
  });

  describe("setCacheRaw", () => {
    it("sets value with TTL", async () => {
      await setCacheRaw("set-key", { data: "value" }, 300);

      expect(mockRedis.set).toHaveBeenCalledWith("set-key", { data: "value" }, { ex: 300 });
    });

    it("does not throw on Redis error", async () => {
      mockRedis.set.mockRejectedValueOnce(new Error("Write failed"));

      await expect(setCacheRaw("fail-key", "val", 60)).resolves.toBeUndefined();
    });
  });

  describe("invalidateCache", () => {
    it("deletes the key from Redis", async () => {
      await invalidateCache("del-key");

      expect(mockRedis.del).toHaveBeenCalledWith("del-key");
    });

    it("does not throw on Redis error", async () => {
      mockRedis.del.mockRejectedValueOnce(new Error("Delete failed"));

      await expect(invalidateCache("fail-key")).resolves.toBeUndefined();
    });
  });

  describe("cachedPrismaQuery", () => {
    it("returns cached value without calling query on cache hit", async () => {
      const cached = { id: 10, email: "user@example.com" };
      mockRedis.get.mockResolvedValueOnce(cached);
      const query = vi.fn().mockResolvedValue({ id: 10, email: "different@example.com" });

      const result = await cachedPrismaQuery("prisma:user:10", 300, query);

      expect(result).toEqual(cached);
      expect(query).not.toHaveBeenCalled();
      expect(mockRedis.get).toHaveBeenCalledWith("prisma:user:10");
    });

    it("calls query and caches result on cache miss", async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      const fresh = { id: 20, email: "new@example.com" };
      const query = vi.fn().mockResolvedValue(fresh);

      const result = await cachedPrismaQuery("prisma:user:20", 600, query);

      expect(result).toEqual(fresh);
      expect(query).toHaveBeenCalledOnce();
      expect(mockRedis.set).toHaveBeenCalledWith("prisma:user:20", fresh, { ex: 600 });
    });

    it("falls back to query when Redis throws", async () => {
      mockRedis.get.mockRejectedValueOnce(new Error("Redis unavailable"));
      const fresh = { id: 30, email: "fallback@example.com" };
      const query = vi.fn().mockResolvedValue(fresh);

      const result = await cachedPrismaQuery("prisma:user:30", 120, query);

      expect(result).toEqual(fresh);
      expect(query).toHaveBeenCalledOnce();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it("works with array results from Prisma findMany", async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      const users = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];
      const query = vi.fn().mockResolvedValue(users);

      const result = await cachedPrismaQuery("prisma:users:list", 900, query);

      expect(result).toEqual(users);
      expect(query).toHaveBeenCalledOnce();
    });

    it("cache can be invalidated", async () => {
      // First call - cache miss, stores result
      mockRedis.get.mockResolvedValueOnce(null);
      const query = vi.fn().mockResolvedValue({ id: 1, name: "Original" });
      await cachedPrismaQuery("prisma:user:1", 300, query);
      expect(mockRedis.set).toHaveBeenCalled();

      // Invalidate
      await invalidateCache("prisma:user:1");
      expect(mockRedis.del).toHaveBeenCalledWith("prisma:user:1");
    });
  });
});
