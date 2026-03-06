const DB_NAME = "spike-land-cache";
const DB_VERSION = 1;
const ATA_STORE = "ata-cache";
const WASM_STORE = "wasm-cache";

const ATA_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const WASM_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface CacheEntry {
  key: string;
  data: string | ArrayBuffer;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ATA_STORE)) {
        db.createObjectStore(ATA_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(WASM_STORE)) {
        db.createObjectStore(WASM_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getEntry(storeName: string, key: string, ttl: number): Promise<CacheEntry | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => {
      db.close();
      const entry = request.result as CacheEntry | undefined;
      if (!entry) return resolve(null);
      if (Date.now() - entry.timestamp > ttl) return resolve(null);
      resolve(entry);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function setEntry(storeName: string, key: string, data: string | ArrayBuffer): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const entry: CacheEntry = { key, data, timestamp: Date.now() };
    const request = store.put(entry);
    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function getAtaCache(url: string): Promise<string | null> {
  try {
    const entry = await getEntry(ATA_STORE, url, ATA_TTL_MS);
    return entry ? (entry.data as string) : null;
  } catch {
    return null;
  }
}

export async function setAtaCache(url: string, content: string): Promise<void> {
  try {
    await setEntry(ATA_STORE, url, content);
  } catch {
    // Graceful fallback — IDB unavailable
  }
}

export async function getWasmModule(key: string): Promise<ArrayBuffer | null> {
  try {
    const entry = await getEntry(WASM_STORE, key, WASM_TTL_MS);
    return entry ? (entry.data as ArrayBuffer) : null;
  } catch {
    return null;
  }
}

export async function setWasmModule(key: string, data: ArrayBuffer): Promise<void> {
  try {
    await setEntry(WASM_STORE, key, data);
  } catch {
    // Graceful fallback — IDB unavailable
  }
}

export async function pruneExpiredEntries(): Promise<void> {
  try {
    const db = await openDB();
    const now = Date.now();

    for (const [storeName, ttl] of [
      [ATA_STORE, ATA_TTL_MS],
      [WASM_STORE, WASM_TTL_MS],
    ] as const) {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.openCursor();

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return resolve();
          const entry = cursor.value as CacheEntry;
          if (now - entry.timestamp > ttl) {
            cursor.delete();
          }
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      });
    }

    db.close();
  } catch {
    // Graceful fallback — IDB unavailable
  }
}
