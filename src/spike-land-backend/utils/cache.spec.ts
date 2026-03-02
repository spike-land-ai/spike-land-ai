import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCacheDefault } from "./cache";

describe("getCacheDefault", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return the default cache from the caches global", () => {
    const mockCache = {
      match: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    vi.stubGlobal("caches", { default: mockCache });

    const result = getCacheDefault();

    expect(result).toBe(mockCache);
  });

  it("should return the same cache object consistently", () => {
    const mockCache = { match: vi.fn() };
    vi.stubGlobal("caches", { default: mockCache });

    const result1 = getCacheDefault();
    const result2 = getCacheDefault();

    expect(result1).toBe(result2);
  });
});
