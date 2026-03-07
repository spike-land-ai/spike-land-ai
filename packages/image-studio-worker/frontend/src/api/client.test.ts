import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock environment variables before importing client
vi.stubEnv("VITE_DEMO_TOKEN", "test-token");

import { listTools } from "./client";

describe("listTools", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();

    // Mock storage implementations if not present in the environment
    if (!global.sessionStorage) {
      const mockStorage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), length: 0, key: vi.fn() };
      vi.stubGlobal("sessionStorage", mockStorage);
    } else {
      vi.spyOn(global.sessionStorage, 'getItem').mockReturnValue(null);
    }

    if (!global.localStorage) {
      const mockStorage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), length: 0, key: vi.fn() };
      vi.stubGlobal("localStorage", mockStorage);
    } else {
      vi.spyOn(global.localStorage, 'getItem').mockReturnValue(null);
    }
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("should fetch and return a list of tools", async () => {
    const mockTools = [
      {
        name: "test-tool",
        description: "A test tool",
        category: "test",
        tier: "free",
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tools: mockTools }),
    });

    const result = await listTools();

    expect(global.fetch).toHaveBeenCalledWith("/api/tools", expect.objectContaining({
      headers: expect.objectContaining({
        "Content-Type": "application/json",
        "Authorization": "Bearer test-token"
      })
    }));

    expect(result).toEqual(mockTools);
  });

  it("should handle API errors", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(listTools()).rejects.toThrow("API error 500: Internal Server Error");
    expect(global.fetch).toHaveBeenCalledWith("/api/tools", expect.any(Object));
  });
});
