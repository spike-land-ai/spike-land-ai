// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";

// We need to re-import the module fresh for each test to reset the dbPromise singleton
let getTypeCache: typeof import("../ata-cache").getTypeCache;
let setTypeCache: typeof import("../ata-cache").setTypeCache;
let clearTypeCache: typeof import("../ata-cache").clearTypeCache;
let DB_NAME: string;
let STORE_NAME: string;
let TTL_MS: number;

// Minimal fake IndexedDB for testing
function createFakeIndexedDB() {
  const stores: Record<string, Map<string, unknown>> = {};

  const fakeDB: Partial<IDBDatabase> = {
    objectStoreNames: {
      contains: (name: string) => name in stores,
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    } as DOMStringList,
    createObjectStore: (name: string) => {
      stores[name] = new Map();
      return {} as IDBObjectStore;
    },
    transaction: (storeNames: string | string[], mode?: string) => {
      const storeName = Array.isArray(storeNames) ? storeNames[0]! : storeNames;
      if (!stores[storeName]) stores[storeName] = new Map();

      const store = stores[storeName]!;
      const fakeStore = {
        get: (key: string) => {
          const result = { result: store.get(key), onerror: null as (() => void) | null, onsuccess: null as (() => void) | null };
          setTimeout(() => result.onsuccess?.(), 0);
          return result;
        },
        put: (value: unknown, key: string) => {
          store.set(key, value);
          const result = { result: undefined, onerror: null as (() => void) | null, onsuccess: null as (() => void) | null };
          setTimeout(() => result.onsuccess?.(), 0);
          return result;
        },
        clear: () => {
          store.clear();
          const result = { result: undefined, onerror: null as (() => void) | null, onsuccess: null as (() => void) | null };
          setTimeout(() => result.onsuccess?.(), 0);
          return result;
        },
      };

      return {
        objectStore: () => fakeStore,
      } as unknown as IDBTransaction;
    },
  };

  const fakeIndexedDB = {
    open: (name: string, version?: number) => {
      const request = {
        result: fakeDB as IDBDatabase,
        onerror: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onupgradeneeded: null as ((event: unknown) => void) | null,
      };

      setTimeout(() => {
        // Fire upgradeneeded first for fresh DB
        if (!stores["types"]) {
          request.onupgradeneeded?.({ target: request } as unknown);
        }
        request.onsuccess?.();
      }, 0);

      return request;
    },
  };

  return { fakeIndexedDB, stores };
}

describe("ata-cache", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.useRealTimers();

    const { fakeIndexedDB } = createFakeIndexedDB();
    // Set up indexedDB on globalThis before importing the module
    Object.defineProperty(globalThis, "indexedDB", {
      value: fakeIndexedDB,
      writable: true,
      configurable: true,
    });

    const mod = await import("../ata-cache");
    getTypeCache = mod.getTypeCache;
    setTypeCache = mod.setTypeCache;
    clearTypeCache = mod.clearTypeCache;
    DB_NAME = mod.DB_NAME;
    STORE_NAME = mod.STORE_NAME;
    TTL_MS = mod.TTL_MS;
  });

  it("stores and retrieves type definitions", async () => {
    await setTypeCache("https://example.com/types/react.d.ts", "declare module 'react' {}");
    const result = await getTypeCache("https://example.com/types/react.d.ts");
    expect(result).toBe("declare module 'react' {}");
  });

  it("returns null for missing entries", async () => {
    const result = await getTypeCache("https://example.com/nonexistent");
    expect(result).toBeNull();
  });

  it("returns null for expired entries", async () => {
    // Store a type
    await setTypeCache("https://example.com/old.d.ts", "old content");

    // Mock Date.now to return a time beyond TTL
    const originalNow = Date.now;
    Date.now = () => originalNow() + TTL_MS + 1000;

    const result = await getTypeCache("https://example.com/old.d.ts");
    expect(result).toBeNull();

    Date.now = originalNow;
  });

  it("returns null when IndexedDB is unavailable", async () => {
    vi.resetModules();

    // Remove indexedDB
    Object.defineProperty(globalThis, "indexedDB", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const mod = await import("../ata-cache");
    const result = await mod.getTypeCache("https://example.com/test");
    expect(result).toBeNull();
  });

  it("clears all cache entries", async () => {
    await setTypeCache("https://example.com/a.d.ts", "content a");
    await setTypeCache("https://example.com/b.d.ts", "content b");

    // Verify they exist
    expect(await getTypeCache("https://example.com/a.d.ts")).toBe("content a");
    expect(await getTypeCache("https://example.com/b.d.ts")).toBe("content b");

    await clearTypeCache();

    expect(await getTypeCache("https://example.com/a.d.ts")).toBeNull();
    expect(await getTypeCache("https://example.com/b.d.ts")).toBeNull();
  });

  it("exports expected constants", () => {
    expect(DB_NAME).toBe("spike-app-ata-cache");
    expect(STORE_NAME).toBe("types");
    expect(TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
