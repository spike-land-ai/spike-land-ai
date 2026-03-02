import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as redis from "../redis.js";

describe("Redis Client", () => {
  const mockConfig = {
    url: "https://redis.example.com",
    token: "test-token",
  };

  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  describe("getRedisConfig", () => {
    it("should return config from environment variables", () => {
      const config = redis.getRedisConfig();
      expect(config).toEqual({
        url: "https://redis.example.com",
        token: "test-token",
      });
    });

    it("should fallback to KV_REST_API_URL/TOKEN if UPSTASH vars are missing", () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      process.env.KV_REST_API_URL = "https://kv.example.com";
      process.env.KV_REST_API_TOKEN = "kv-token";
      
      const config = redis.getRedisConfig();
      expect(config).toEqual({
        url: "https://kv.example.com",
        token: "kv-token",
      });
      
      delete process.env.KV_REST_API_URL;
      delete process.env.KV_REST_API_TOKEN;
    });

    it("should throw error if credentials are missing", () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      expect(() => redis.getRedisConfig()).toThrow("Redis credentials not configured");
    });
  });

  describe("getAppsWithPending", () => {
    it("should return list of apps with pending messages", async () => {
      const mockResponse = { result: ["app1", "app2"] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await redis.getAppsWithPending(mockConfig);
      expect(result).toEqual(["app1", "app2"]);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://redis.example.com",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("SMEMBERS"),
        }),
      );
    });
  });

  describe("dequeueMessage", () => {
    it("should dequeue message using Lua script", async () => {
      const mockResponse = { result: "msg1" };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await redis.dequeueMessage(mockConfig, "app1");
      expect(result).toBe("msg1");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://redis.example.com",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("EVAL"),
        }),
      );
    });

    it("should fallback to pipeline if EVAL fails", async () => {
      // First call fails (EVAL)
      mockFetch.mockRejectedValueOnce(new Error("EVAL not supported"));

      // Second call succeeds (Pipeline: RPOP, LLEN)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ result: "msg1" }, { result: 0 }],
      });

      // Third call succeeds (SREM) because remaining is 0
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 1 }),
      });

      const result = await redis.dequeueMessage(mockConfig, "app1");
      expect(result).toBe("msg1");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("setAgentWorking", () => {
    it("should set agent working key", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ result: "OK" }),
      });

      await redis.setAgentWorking(mockConfig, "app1", true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://redis.example.com",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("SET"),
        }),
      );
    });

    it("should delete agent working key", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ result: 1 }),
      });

      await redis.setAgentWorking(mockConfig, "app1", false);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://redis.example.com",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("DEL"),
        }),
      );
    });
  });

  describe("isAgentWorking", () => {
    it("should return true if agent is working", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ result: "1" }),
      });

      const result = await redis.isAgentWorking(mockConfig, "app1");
      expect(result).toBe(true);
    });

    it("should return false if agent is not working", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ result: null }),
      });

      const result = await redis.isAgentWorking(mockConfig, "app1");
      expect(result).toBe(false);
    });
  });

  describe("getQueueStats", () => {
    it("should return queue stats", async () => {
      // getAppsWithPending
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: ["app1", "app2"] }),
      });

      // getPendingCount for app1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 5 }),
      });

      // getPendingCount for app2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 3 }),
      });

      const result = await redis.getQueueStats(mockConfig);
      expect(result).toEqual({
        appsWithPending: 2,
        totalPendingMessages: 8,
        apps: [
          { appId: "app1", count: 5 },
          { appId: "app2", count: 3 },
        ],
      });
    });
  });

  describe("Redis failures", () => {
    it("should throw error if redis command fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Bad Request",
      });

      await expect(redis.getAppsWithPending(mockConfig)).rejects.toThrow(
        "Redis command failed: 400 - Bad Request",
      );
    });

    it("should throw error if redis pipeline fails", async () => {
      // Trigger pipeline via dequeueMessage fallback
      mockFetch.mockRejectedValueOnce(new Error("EVAL fail")); // Trigger fallback
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Pipeline Error",
      });

      await expect(redis.dequeueMessage(mockConfig, "app1")).rejects.toThrow(
        "Redis pipeline failed: 500 - Pipeline Error",
      );
    });
  });
});
