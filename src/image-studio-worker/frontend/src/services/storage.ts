export interface LocalImage {
  id: string;
  name: string;
  createdAt: number;
  width: number;
  height: number;
  opfsPath: string;
  url: string; // Object URL representing the blob
}

const DB_NAME = "pixel_db";
const DB_VERSION = 1;
const STORE_NAME = "images";

// Initialize IndexedDB
const getDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
};

// OPFS helpers
const getOpfsRoot = async () => {
  return await navigator.storage.getDirectory();
};

export const storage = {
  async saveImageToLocal(
    blob: Blob,
    metadata: Omit<LocalImage, "id" | "createdAt" | "opfsPath" | "url">,
  ): Promise<LocalImage> {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const opfsPath = `img_${id}.png`;

    // Save to OPFS
    const root = await getOpfsRoot();
    const fileHandle = await root.getFileHandle(opfsPath, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    const record = {
      id,
      ...metadata,
      createdAt,
      opfsPath,
    };

    // Save metadata to IndexedDB
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore(STORE_NAME);
      const request = store.add(record);
      request.onsuccess = () => {
        resolve({
          ...record,
          url: URL.createObjectURL(blob),
        });
      };
    });
  },

  async getImagesFromLocal(options?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<LocalImage[]> {
    const db = await getDb();
    const records = await new Promise<Omit<LocalImage, "url">[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
    });

    records.sort((a, b) => b.createdAt - a.createdAt);

    let filteredRecords = records;
    if (options?.search) {
      const lowerQuery = options.search.toLowerCase();
      filteredRecords = filteredRecords.filter((r) => r.name.toLowerCase().includes(lowerQuery));
    }

    const offset = options?.offset ?? 0;
    const limit = options?.limit;

    let pagedRecords = filteredRecords.slice(offset);
    if (limit !== undefined) {
      pagedRecords = pagedRecords.slice(0, limit);
    }

    const root = await getOpfsRoot();
    const images: LocalImage[] = [];

    for (const record of pagedRecords) {
      try {
        const fileHandle = await root.getFileHandle(record.opfsPath);
        const file = await fileHandle.getFile();
        images.push({
          ...record,
          url: URL.createObjectURL(file), // create Object URL for each
        });
      } catch (e) {
        console.warn(`Failed to load OPFS file for image ${record.id}`, e);
      }
    }
    return images;
  },

  async deleteImageFromLocal(id: string): Promise<void> {
    const db = await getDb();

    // Get record first to find opfsPath
    const record = await new Promise<Omit<LocalImage, "url">>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (record) {
      // Delete from OPFS
      try {
        const root = await getOpfsRoot();
        await root.removeEntry(record.opfsPath);
      } catch (e) {
        console.warn(`Failed to delete OPFS file ${record.opfsPath}`, e);
      }
    }

    // Delete from IndexedDB
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
    });
  },

  async clearAllLocalData(): Promise<void> {
    // Clear OPFS
    try {
      const root = await getOpfsRoot();
      // @ts-expect-error values() iterator is standard
      for await (const entry of root.values()) {
        await root.removeEntry(entry.name, { recursive: true });
      }
    } catch (e) {
      console.warn("Error clearing OPFS", e);
    }

    // Clear IndexedDB
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
    });
  },
};
