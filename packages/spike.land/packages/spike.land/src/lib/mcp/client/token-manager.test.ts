import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Suppress console.error from TokenManager internals
vi.spyOn(console, "error").mockImplementation(() => {});

describe("TokenManager", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Fresh import each test to get a clean singleton
  async function freshTokenManager() {
    vi.resetModules();
    const mod = await import("./token-manager");
    return mod.tokenManager;
  }

  function mockTokenResponse(overrides: Record<string, unknown> = {}) {
    return {
      access_token: "access-abc",
      refresh_token: "refresh-xyz",
      expires_in: 3600,
      token_type: "Bearer",
      ...overrides,
    };
  }

  describe("getToken() - initial exchange", () => {
    it("should fetch a token from /api/mcp/token on first call", async () => {
      const tm = await freshTokenManager();
      const token = mockTokenResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(token),
      });

      const result = await tm.getToken();

      expect(mockFetch).toHaveBeenCalledWith("/api/mcp/token", {
        method: "POST",
      });
      expect(result).toBe("access-abc");
    });

    it("should return null when the exchange returns 401", async () => {
      const tm = await freshTokenManager();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await tm.getToken();
      expect(result).toBeNull();
    });

    it("should throw and catch non-401 error, returning null", async () => {
      const tm = await freshTokenManager();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await tm.getToken();
      expect(result).toBeNull();
    });

    it("should return null when fetch itself rejects", async () => {
      const tm = await freshTokenManager();
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await tm.getToken();
      expect(result).toBeNull();
    });
  });

  describe("getToken() - cached token", () => {
    it("should return cached token on subsequent calls without re-fetching", async () => {
      const tm = await freshTokenManager();
      const token = mockTokenResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(token),
      });

      const first = await tm.getToken();
      const second = await tm.getToken();

      expect(first).toBe("access-abc");
      expect(second).toBe("access-abc");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("getToken() - token refresh", () => {
    it("should refresh when auto-refresh timer fires", async () => {
      const tm = await freshTokenManager();
      const token = mockTokenResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(token),
      });

      await tm.getToken();

      // Auto-refresh timer is set at (3600*1000 - 2*60*1000) = 3480000ms
      const refreshedForTimer = mockTokenResponse({
        access_token: "timer-refreshed",
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(refreshedForTimer),
      });

      await vi.advanceTimersByTimeAsync(3480001);

      const result = await tm.getToken();
      expect(result).toBe("timer-refreshed");
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith("/api/mcp/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: "refresh-xyz",
          client_id: "spike-land-frontend",
        }),
      });
    });

    it("should return null when refresh response is not ok", async () => {
      const tm = await freshTokenManager();
      const token = mockTokenResponse({ expires_in: 300 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(token),
      });

      await tm.getToken();

      // Auto-refresh fires at 180s. Make it fail.
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });
      await vi.advanceTimersByTimeAsync(180001);

      // Token is now null. Next getToken tries initialExchange.
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });
      const result = await tm.getToken();
      expect(result).toBeNull();
    });

    it("should return null when there is no refresh_token", async () => {
      const tm = await freshTokenManager();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "access-abc",
            expires_in: 300,
            token_type: "Bearer",
          }),
      });

      await tm.getToken();

      // Auto-refresh fires at 180s, finds no refresh_token, fails.
      await vi.advanceTimersByTimeAsync(180001);

      // Token is cleared. Next getToken tries initialExchange.
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });
      const result = await tm.getToken();
      expect(result).toBeNull();
    });

    it("should deduplicate concurrent refresh calls", async () => {
      const tm = await freshTokenManager();
      const token = mockTokenResponse({ expires_in: 300 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(token),
      });

      await tm.getToken();

      // Auto-refresh fires at 180s
      const refreshed = mockTokenResponse({ access_token: "access-dedup" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(refreshed),
      });

      await vi.advanceTimersByTimeAsync(180001);

      // Token is refreshed. Two concurrent calls should both return cached.
      const [r1, r2] = await Promise.all([tm.getToken(), tm.getToken()]);
      expect(r1).toBe("access-dedup");
      expect(r2).toBe("access-dedup");
    });
  });

  describe("setupAutoRefresh", () => {
    it("should auto-refresh the token before expiry via timer", async () => {
      const tm = await freshTokenManager();
      const token = mockTokenResponse({ expires_in: 600 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(token),
      });

      await tm.getToken();

      // Auto-refresh fires at 480000ms
      const refreshed = mockTokenResponse({ access_token: "auto-refreshed" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(refreshed),
      });

      await vi.advanceTimersByTimeAsync(479999);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should not set a timer when delay would be <= 0", async () => {
      const tm = await freshTokenManager();
      const token = mockTokenResponse({ expires_in: 60 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(token),
      });

      await tm.getToken();

      await vi.advanceTimersByTimeAsync(120000);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should clear the previous timer when setting up a new auto-refresh", async () => {
      const tm = await freshTokenManager();
      const token = mockTokenResponse({ expires_in: 600 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(token),
      });

      await tm.getToken();

      const refreshed = mockTokenResponse({
        access_token: "refreshed-2",
        expires_in: 600,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(refreshed),
      });

      await vi.advanceTimersByTimeAsync(480001);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const refreshed2 = mockTokenResponse({
        access_token: "refreshed-3",
        expires_in: 600,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(refreshed2),
      });

      await vi.advanceTimersByTimeAsync(480001);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("clear()", () => {
    it("should clear the cached token and allow re-exchange", async () => {
      const tm = await freshTokenManager();
      const token = mockTokenResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(token),
      });

      await tm.getToken();
      tm.clear();

      const newToken = mockTokenResponse({ access_token: "access-new" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newToken),
      });

      const result = await tm.getToken();
      expect(result).toBe("access-new");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should clear the auto-refresh timer", async () => {
      const tm = await freshTokenManager();
      const token = mockTokenResponse({ expires_in: 600 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(token),
      });

      await tm.getToken();
      tm.clear();

      await vi.advanceTimersByTimeAsync(500000);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should be safe to call clear when no token exists", async () => {
      const tm = await freshTokenManager();
      expect(() => tm.clear()).not.toThrow();
    });
  });

  describe("isExpired()", () => {
    it("should not treat token as expired when outside 2-minute buffer", async () => {
      const tm = await freshTokenManager();
      const token = mockTokenResponse({ expires_in: 300 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(token),
      });

      await tm.getToken();

      await vi.advanceTimersByTimeAsync(170000);
      const result = await tm.getToken();
      expect(result).toBe("access-abc");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should refresh via getToken when token is expired and no auto-refresh timer was set", async () => {
      const tm = await freshTokenManager();
      // expires_in: 119 means delay = 119000 - 120000 = -1000 (<=0), so no auto-refresh timer
      const token = mockTokenResponse({ expires_in: 119 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(token),
      });

      await tm.getToken();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance time so isExpired() returns true (past the 2-minute buffer)
      // expiresAt = now + 119000, buffer = 120000, so immediately expired
      // But let's advance a bit to be safe
      await vi.advanceTimersByTimeAsync(1000);

      // Mock the refresh response
      const refreshed = mockTokenResponse({
        access_token: "refreshed-via-expired",
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(refreshed),
      });

      // getToken() should hit isExpired() -> true -> refreshToken() (line 17)
      const result = await tm.getToken();
      expect(result).toBe("refreshed-via-expired");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("setupAutoRefresh with null token after refresh failure", () => {
    it("should not set a timer if token becomes null from failed refresh", async () => {
      const tm = await freshTokenManager();
      const token = mockTokenResponse({ expires_in: 600 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(token),
      });

      await tm.getToken();

      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await vi.advanceTimersByTimeAsync(480001);

      await vi.advanceTimersByTimeAsync(600000);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("initialExchange returns empty access_token", () => {
    it("should return null if token response has falsy access_token", async () => {
      const tm = await freshTokenManager();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "",
            refresh_token: "rt",
            expires_in: 3600,
            token_type: "Bearer",
          }),
      });

      const result = await tm.getToken();
      expect(result).toBeNull();
    });
  });
});
