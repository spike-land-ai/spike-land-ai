/**
 * LargeValueStorage — transparent R2 overflow for Durable Object storage.
 *
 * Cloudflare DO storage has a 128 KiB per-value limit. This wrapper checks
 * serialized byte size on put(). If it exceeds THRESHOLD (64 KiB, a safe
 * margin), the value is stored in R2 and a small pointer sentinel is placed
 * in DO storage. On get(), the pointer is detected and the real value is
 * fetched from R2 transparently.
 */

const THRESHOLD = 64 * 1024; // 64 KiB

export interface R2Pointer {
  __r2_ref: true;
  key: string;
  originalType: "string" | "object";
}

function isR2Pointer(value: unknown): value is R2Pointer {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as R2Pointer).__r2_ref === true &&
    typeof (value as R2Pointer).key === "string"
  );
}

function byteSize(str: string): number {
  return new TextEncoder().encode(str).byteLength;
}

export class LargeValueStorage {
  constructor(
    private storage: DurableObjectStorage,
    private r2: R2Bucket,
    private doId: string,
  ) {}

  private r2Key(storageKey: string): string {
    return `do_${this.doId}/${storageKey}`;
  }

  async put<T>(key: string, value: T): Promise<void> {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    const size = byteSize(serialized);

    if (size <= THRESHOLD) {
      await this.storage.put(key, value);
      // Fire-and-forget cleanup of any previous R2 overflow
      this.r2.delete(this.r2Key(key)).catch(() => {});
      return;
    }

    // Store in R2
    const r2Key = this.r2Key(key);
    await this.r2.put(r2Key, serialized);

    // Store pointer in DO storage
    const pointer: R2Pointer = {
      __r2_ref: true,
      key: r2Key,
      originalType: typeof value === "string" ? "string" : "object",
    };
    await this.storage.put(key, pointer);
  }

  async get<T>(key: string): Promise<T | undefined> {
    const stored = await this.storage.get<T | R2Pointer>(key);
    if (stored === undefined || stored === null) return undefined;

    if (!isR2Pointer(stored)) {
      return stored as T;
    }

    // Fetch from R2
    const obj = await this.r2.get(stored.key);
    if (!obj) return undefined;

    const text = await obj.text();
    if (stored.originalType === "string") {
      return text as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Failed to parse stored value: invalid JSON`);
    }
  }

  async delete(key: string): Promise<void> {
    // Check if there's an R2 pointer to clean up
    const stored = await this.storage.get<R2Pointer>(key);
    if (isR2Pointer(stored)) {
      await this.r2.delete(stored.key);
    }
    await this.storage.delete(key);
  }

  /** Bypass — always stores in DO storage directly. Use for known-small values. */
  async putDirect<T>(key: string, value: T): Promise<void> {
    await this.storage.put(key, value);
  }

  /** Bypass — reads from DO storage directly without pointer resolution. */
  async getDirect<T>(key: string): Promise<T | undefined> {
    const val = await this.storage.get<T>(key);
    return val ?? undefined;
  }
}
