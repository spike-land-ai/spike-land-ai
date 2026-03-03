import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSessionCache,
  getSessionCacheKey,
  invalidateSessionCache,
  SESSION_CACHE_TTL_MS,
  setSessionCache,
} from "./session-cache";
import type { AppData } from "./types";

// Create a proper in-memory sessionStorage mock
function createMockSessionStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

describe("session-cache", () => {
  let mockStorage: ReturnType<typeof createMockSessionStorage>;

  beforeEach(() => {
    mockStorage = createMockSessionStorage();
    vi.stubGlobal("sessionStorage", mockStorage);
    // Ensure window is defined (for typeof window check)
    vi.stubGlobal("window", globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("SESSION_CACHE_TTL_MS is 5 minutes", () => {
    expect(SESSION_CACHE_TTL_MS).toBe(5 * 60 * 1000);
  });

  describe("getSessionCacheKey", () => {
    it("returns prefixed key", () => {
      expect(getSessionCacheKey("my-app")).toBe("app-session-my-app");
    });
  });

  describe("setSessionCache / getSessionCache", () => {
    it("stores and retrieves cached data", () => {
      const data = { hasContent: true, isPromptMode: false };
      setSessionCache("my-app", data);
      const result = getSessionCache("my-app");
      expect(result).toEqual(expect.objectContaining(data));
    });

    it("returns null for missing cache", () => {
      expect(getSessionCache("no-such-app")).toBeNull();
    });

    it("returns null for expired cache", () => {
      const data = { hasContent: true };
      setSessionCache("my-app", data);

      // Manually tamper with the stored timestamp to make it expired
      const key = getSessionCacheKey("my-app");
      const raw = mockStorage.getItem(key)!;
      const stored = JSON.parse(raw);
      stored.timestamp = Date.now() - SESSION_CACHE_TTL_MS - 1;
      mockStorage.setItem(key, JSON.stringify(stored));

      expect(getSessionCache("my-app")).toBeNull();
    });

    it("returns null and removes cache for invalid JSON", () => {
      const key = getSessionCacheKey("bad-json");
      mockStorage.setItem(key, "not-json");
      expect(getSessionCache("bad-json")).toBeNull();
      // Should have been removed
      expect(mockStorage.getItem(key)).toBeNull();
    });

    it("caches app data", () => {
      const app = { id: "app-1" } as AppData;
      setSessionCache("my-app", { app, hasContent: true });
      const result = getSessionCache("my-app");
      expect(result?.app?.id).toBe("app-1");
    });
  });

  describe("invalidateSessionCache", () => {
    it("removes cached entry", () => {
      setSessionCache("my-app", { hasContent: true });
      invalidateSessionCache("my-app");
      expect(getSessionCache("my-app")).toBeNull();
    });
  });
});
