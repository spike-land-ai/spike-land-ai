import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock("@/lib/upstash/client", () => ({ redis: mockRedis }));
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Must import after mocks
import {
  _resetForTesting,
  getPoolInfo,
  getPreferredToken,
  resolveTokenPool,
  withTokenFallback,
} from "./token-pool";

describe("token-pool", () => {
  beforeEach(() => {
    _resetForTesting();
    vi.clearAllMocks();
    vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN", "token-a");
    vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN_2", "token-b");
    vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN_3", "token-c");
    // Clear higher suffixes
    for (let i = 4; i <= 10; i++) {
      vi.stubEnv(`CLAUDE_CODE_OAUTH_TOKEN_${i}`, "");
    }
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("resolveTokenPool", () => {
    it("collects tokens from env vars in order", () => {
      expect(resolveTokenPool()).toEqual(["token-a", "token-b", "token-c"]);
    });

    it("deduplicates identical tokens", () => {
      vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN_2", "token-a");
      expect(resolveTokenPool()).toEqual(["token-a", "token-c"]);
    });

    it("returns empty array when no tokens set", () => {
      vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN", "");
      vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN_2", "");
      vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN_3", "");
      expect(resolveTokenPool()).toEqual([]);
    });

    it("skips missing suffixes but includes later ones", () => {
      vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN_2", "");
      expect(resolveTokenPool()).toEqual(["token-a", "token-c"]);
    });
  });

  describe("withTokenFallback", () => {
    it("uses the first token when it works", async () => {
      const op = vi.fn().mockResolvedValue("result");
      const result = await withTokenFallback(op);
      expect(result).toBe("result");
      expect(op).toHaveBeenCalledWith("token-a");
      expect(op).toHaveBeenCalledTimes(1);
    });

    it("falls back to next token on 401 error", async () => {
      const authError = new Error("authentication_error");
      const op = vi.fn().mockRejectedValueOnce(authError).mockResolvedValueOnce("ok");

      const result = await withTokenFallback(op);
      expect(result).toBe("ok");
      expect(op).toHaveBeenCalledTimes(2);
      expect(op).toHaveBeenNthCalledWith(1, "token-a");
      expect(op).toHaveBeenNthCalledWith(2, "token-b");
    });

    it("does NOT rotate on non-auth errors", async () => {
      const networkError = new Error("ECONNRESET");
      const op = vi.fn().mockRejectedValue(networkError);

      await expect(withTokenFallback(op)).rejects.toThrow("ECONNRESET");
      expect(op).toHaveBeenCalledTimes(1);
    });

    it("throws after all tokens fail with auth errors", async () => {
      const authError = new Error("authentication_error");
      const op = vi.fn().mockRejectedValue(authError);

      await expect(withTokenFallback(op)).rejects.toThrow("authentication_error");
      expect(op).toHaveBeenCalledTimes(3); // 3 tokens
    });

    it("persists last-good index to Redis on fallback success", async () => {
      const authError = new Error("401");
      const op = vi.fn().mockRejectedValueOnce(authError).mockResolvedValueOnce("ok");

      await withTokenFallback(op);
      expect(mockRedis.set).toHaveBeenCalledWith("ai:anthropic:last-good-token-idx", 1, {
        ex: 3600,
      });
    });

    it("starts from Redis-stored last-good index", async () => {
      mockRedis.get.mockResolvedValue(2); // token-c
      const op = vi.fn().mockResolvedValue("ok");

      await withTokenFallback(op);
      expect(op).toHaveBeenCalledWith("token-c");
    });

    it("throws immediately when no tokens configured", async () => {
      vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN", "");
      vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN_2", "");
      vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN_3", "");

      await expect(withTokenFallback(vi.fn())).rejects.toThrow("No Anthropic auth tokens");
    });

    it("skips fallback logic with single token (fast path)", async () => {
      vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN_2", "");
      vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN_3", "");

      const op = vi.fn().mockResolvedValue("ok");
      await withTokenFallback(op);
      // Should not call redis.get for last-good index
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it("handles Redis unavailability gracefully", async () => {
      mockRedis.get.mockRejectedValue(new Error("Redis down"));
      mockRedis.set.mockRejectedValue(new Error("Redis down"));

      const authError = new Error("authentication_error");
      const op = vi.fn().mockRejectedValueOnce(authError).mockResolvedValueOnce("ok");

      const result = await withTokenFallback(op);
      expect(result).toBe("ok");
    });
  });

  describe("getPreferredToken", () => {
    it("returns the first token by default", () => {
      expect(getPreferredToken()).toBe("token-a");
    });

    it("returns updated token after fallback", async () => {
      const authError = new Error("authentication_error");
      const op = vi.fn().mockRejectedValueOnce(authError).mockResolvedValueOnce("ok");

      await withTokenFallback(op);
      expect(getPreferredToken()).toBe("token-b");
    });

    it("throws when no tokens configured", () => {
      vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN", "");
      vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN_2", "");
      vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN_3", "");

      expect(() => getPreferredToken()).toThrow("No Anthropic auth tokens");
    });
  });

  describe("getPoolInfo", () => {
    it("returns pool diagnostics", async () => {
      const info = await getPoolInfo();
      expect(info.poolSize).toBe(3);
      expect(info.activeIndex).toBe(0);
      expect(info.maskedTokens).toHaveLength(3);
    });

    it("masks tokens properly", async () => {
      vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-1234567890abcdefghij");
      vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN_2", "");
      vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN_3", "");

      const info = await getPoolInfo();
      expect(info.maskedTokens[0]).toMatch(/^sk-ant-12345\.\.\.ghij$/);
    });
  });
});
