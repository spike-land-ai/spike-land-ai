import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Sync Module", () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();
  let sync: typeof import("../sync.js");

  beforeEach(async () => {
    vi.resetModules();
    global.fetch = mockFetch;
    process.env.TESTING_SPIKE_LAND_URL = "https://test-server";
    sync = await import("../sync.js");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
    delete process.env.TESTING_SPIKE_LAND_URL;
  });

  describe("pullCode", () => {
    it("should return code from session response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code: 'console.log("hello")' }),
      });

      const code = await sync.pullCode("code1");
      expect(code).toBe('console.log("hello")');
      expect(mockFetch).toHaveBeenCalledWith("https://test-server/live/code1/session.json");
    });

    it("should return code from cSess response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ cSess: { code: 'console.log("hello")' } }),
      });

      const code = await sync.pullCode("code1");
      expect(code).toBe('console.log("hello")');
    });

    it("should return placeholder code on 404", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const code = await sync.pullCode("new-code");
      expect(code).toContain("New codespace: new-code");
    });

    it("should throw error on other failures", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(sync.pullCode("code1")).rejects.toThrow("Failed to fetch code: HTTP 500");
    });
  });

  describe("pushCode", () => {
    it("should push code successfully", async () => {
      const mockResponse = {
        success: true,
        codeSpace: "code1",
        hash: "hash1",
        updated: ["file1"],
        message: "Updated",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await sync.pushCode("code1", "new code");
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test-server/live/code1/api/code",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ code: "new code", run: true }),
        }),
      );
    });

    it("should throw error on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      await expect(sync.pushCode("code1", "new code")).rejects.toThrow(
        "Failed to push code: HTTP 500 - Internal Server Error",
      );
    });
  });

  describe("withRetry", () => {
    it("should return result if function succeeds", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const result = await sync.withRetry(fn);
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and eventually succeed", async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error("fail 1")).mockResolvedValue("success");

      const result = await sync.withRetry(fn);
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should throw last error after max retries", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      await expect(sync.withRetry(fn, 2, 1)).rejects.toThrow("fail");
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
