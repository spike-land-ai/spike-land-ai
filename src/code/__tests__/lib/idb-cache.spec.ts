import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Manual IndexedDB mock
function createMockIDB() {
  const stores: Record<string, Map<string, unknown>> = {};

  const mockObjectStore = (name: string) => {
    if (!stores[name]) stores[name] = new Map();
    const store = stores[name]!;

    return {
      get(key: string) {
        const result = store.get(key);
        const req = { result, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
        queueMicrotask(() => req.onsuccess?.());
        return req;
      },
      put(value: { key: string }) {
        store.set(value.key, value);
        const req = { result: undefined, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
        queueMicrotask(() => req.onsuccess?.());
        return req;
      },
      openCursor() {
        const entries = [...store.entries()];
        let index = 0;
        const req = {
          result: null as unknown,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };
        const advance = () => {
          if (index < entries.length) {
            const [key, value] = entries[index]!;
            index++;
            req.result = {
              value,
              key,
              delete: () => { store.delete(key); },
              continue: () => { queueMicrotask(advance); },
            };
          } else {
            req.result = null;
          }
          req.onsuccess?.();
        };
        queueMicrotask(advance);
        return req;
      },
    };
  };

  const mockTransaction = (storeNames: string | string[], _mode?: string) => {
    const names = typeof storeNames === "string" ? [storeNames] : storeNames;
    return {
      objectStore: (name: string) => {
        if (!names.includes(name)) throw new Error(`Store ${name} not in transaction`);
        return mockObjectStore(name);
      },
    };
  };

  const objectStoreNames = { contains: (name: string) => !!stores[name] };

  const mockDB = {
    transaction: mockTransaction,
    close: vi.fn(),
    objectStoreNames,
    createObjectStore: (name: string, _opts?: unknown) => { stores[name] = new Map(); },
  };

  const mockOpen = (_name: string, _version?: number) => {
    const req = {
      result: mockDB,
      onupgradeneeded: null as (() => void) | null,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    queueMicrotask(() => {
      req.onupgradeneeded?.();
      queueMicrotask(() => req.onsuccess?.());
    });
    return req;
  };

  return { open: mockOpen, stores };
}

describe("idb-cache", () => {
  let mockIDB: ReturnType<typeof createMockIDB>;

  beforeEach(() => {
    vi.resetModules();
    mockIDB = createMockIDB();
    vi.stubGlobal("indexedDB", { open: mockIDB.open });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should set and get ATA cache entries", async () => {
    const { getAtaCache, setAtaCache } = await import("@/lib/idb-cache");

    await setAtaCache("https://unpkg.com/@types/react/index.d.ts", "declare module react {}");
    const result = await getAtaCache("https://unpkg.com/@types/react/index.d.ts");

    expect(result).toBe("declare module react {}");
  });

  it("should return null for missing ATA cache entries", async () => {
    const { getAtaCache } = await import("@/lib/idb-cache");
    const result = await getAtaCache("https://nonexistent.com/types.d.ts");
    expect(result).toBeNull();
  });

  it("should set and get WASM module entries", async () => {
    const { getWasmModule, setWasmModule } = await import("@/lib/idb-cache");

    const buffer = new ArrayBuffer(8);
    const view = new Uint8Array(buffer);
    view.set([0, 97, 115, 109, 1, 0, 0, 0]); // WASM magic bytes

    await setWasmModule("esbuild-wasm", buffer);
    const result = await getWasmModule("esbuild-wasm");

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(result!)[0]).toBe(0);
    expect(new Uint8Array(result!)[1]).toBe(97);
  });

  it("should return null for missing WASM module entries", async () => {
    const { getWasmModule } = await import("@/lib/idb-cache");
    const result = await getWasmModule("nonexistent");
    expect(result).toBeNull();
  });

  it("should prune expired ATA entries", async () => {
    const { getAtaCache, setAtaCache, pruneExpiredEntries } = await import("@/lib/idb-cache");

    await setAtaCache("https://old.com/types.d.ts", "old content");

    // Manually age the entry by modifying the store
    const ataStore = mockIDB.stores["ata-cache"];
    if (ataStore) {
      const entry = ataStore.get("https://old.com/types.d.ts") as { timestamp: number };
      if (entry) {
        entry.timestamp = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
      }
    }

    await pruneExpiredEntries();

    const result = await getAtaCache("https://old.com/types.d.ts");
    expect(result).toBeNull();
  });

  it("should keep fresh entries during prune", async () => {
    const { getAtaCache, setAtaCache, pruneExpiredEntries } = await import("@/lib/idb-cache");

    await setAtaCache("https://fresh.com/types.d.ts", "fresh content");
    await pruneExpiredEntries();

    const result = await getAtaCache("https://fresh.com/types.d.ts");
    expect(result).toBe("fresh content");
  });

  it("should return expired entries as null without pruning", async () => {
    const { getAtaCache, setAtaCache } = await import("@/lib/idb-cache");

    await setAtaCache("https://stale.com/types.d.ts", "stale");

    // Age the entry beyond TTL
    const ataStore = mockIDB.stores["ata-cache"];
    if (ataStore) {
      const entry = ataStore.get("https://stale.com/types.d.ts") as { timestamp: number };
      if (entry) {
        entry.timestamp = Date.now() - 8 * 24 * 60 * 60 * 1000;
      }
    }

    const result = await getAtaCache("https://stale.com/types.d.ts");
    expect(result).toBeNull();
  });

  it("should gracefully handle IDB errors in getAtaCache", async () => {
    vi.stubGlobal("indexedDB", {
      open: () => {
        const req = { result: null, onupgradeneeded: null, onsuccess: null, onerror: null as (() => void) | null, error: new Error("IDB error") };
        queueMicrotask(() => req.onerror?.());
        return req;
      },
    });

    vi.resetModules();
    const { getAtaCache } = await import("@/lib/idb-cache");
    const result = await getAtaCache("https://example.com");
    expect(result).toBeNull();
  });

  it("should gracefully handle IDB errors in setAtaCache", async () => {
    vi.stubGlobal("indexedDB", {
      open: () => {
        const req = { result: null, onupgradeneeded: null, onsuccess: null, onerror: null as (() => void) | null, error: new Error("IDB error") };
        queueMicrotask(() => req.onerror?.());
        return req;
      },
    });

    vi.resetModules();
    const { setAtaCache } = await import("@/lib/idb-cache");
    // Should not throw
    await expect(setAtaCache("https://example.com", "content")).resolves.toBeUndefined();
  });

  it("should create object stores on DB upgrade", async () => {
    const { getAtaCache } = await import("@/lib/idb-cache");
    // Accessing getAtaCache triggers openDB which triggers onupgradeneeded
    await getAtaCache("test");
    expect(mockIDB.stores["ata-cache"]).toBeDefined();
    expect(mockIDB.stores["wasm-cache"]).toBeDefined();
  });
});
