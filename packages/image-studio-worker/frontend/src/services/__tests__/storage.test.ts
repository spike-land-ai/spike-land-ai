import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { storage } from "../storage";
import "fake-indexeddb/auto";

// Mock global URL
global.URL.createObjectURL = vi.fn((blob: Blob | File) => `blob:http://localhost/${Math.random().toString(36).substring(7)}`);

// Mock OPFS File System API
const mockWritable = {
  write: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockFile = new File(["dummy content"], "test.png", { type: "image/png" });

const mockFileHandle = {
  createWritable: vi.fn().mockResolvedValue(mockWritable),
  getFile: vi.fn().mockResolvedValue(mockFile),
};

const mockDirectoryHandle = {
  getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
  removeEntry: vi.fn().mockResolvedValue(undefined),
  values: vi.fn().mockReturnValue((async function* () {
    yield { name: "img_test1.png" };
    yield { name: "img_test2.png" };
  })()),
};

Object.defineProperty(navigator, "storage", {
  value: {
    getDirectory: vi.fn().mockResolvedValue(mockDirectoryHandle),
  },
  configurable: true,
});

describe("storage service", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await storage.clearAllLocalData();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("saveImageToLocal", () => {
    it("should save image successfully using OPFS", async () => {
      const blob = new Blob(["dummy content"], { type: "image/png" });
      const metadata = { name: "test-image", width: 800, height: 600 };

      const result = await storage.saveImageToLocal(blob, metadata);

      expect(result).toMatchObject({
        ...metadata,
        id: expect.any(String),
        createdAt: expect.any(Number),
        opfsPath: `img_${result.id}.png`,
        url: expect.any(String),
      });

      expect(result.blobData).toBeUndefined();

      expect(navigator.storage.getDirectory).toHaveBeenCalled();
      expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith(`img_${result.id}.png`, { create: true });
      expect(mockFileHandle.createWritable).toHaveBeenCalled();
      expect(mockWritable.write).toHaveBeenCalledWith(blob);
      expect(mockWritable.close).toHaveBeenCalled();

      // Verify it's in IndexedDB
      const images = await storage.getImagesFromLocal();
      expect(images).toHaveLength(1);
      expect(images[0]).toMatchObject(metadata);
    });

    it("should fall back to saving blob data directly in IndexedDB if OPFS fails", async () => {
      vi.spyOn(navigator.storage, "getDirectory").mockRejectedValueOnce(new Error("OPFS not available"));
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const blob = new Blob(["dummy content"], { type: "image/png" });
      const metadata = { name: "fallback-image", width: 800, height: 600 };

      const result = await storage.saveImageToLocal(blob, metadata);

      expect(result).toMatchObject({
        ...metadata,
        id: expect.any(String),
        createdAt: expect.any(Number),
        opfsPath: "",
        blobData: blob,
        url: expect.any(String),
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith("OPFS not available, falling back to IndexedDB blob storage", expect.any(Error));

      const images = await storage.getImagesFromLocal();
      expect(images).toHaveLength(1);
      expect(images[0].opfsPath).toBe("");
      expect(images[0].blobData).toBeDefined();

      consoleWarnSpy.mockRestore();
    });
  });

  describe("getImagesFromLocal", () => {
    it("should retrieve images sorted by createdAt descending", async () => {
      const blob1 = new Blob(["1"], { type: "image/png" });
      const blob2 = new Blob(["2"], { type: "image/png" });

      const img1 = await storage.saveImageToLocal(blob1, { name: "img1", width: 100, height: 100 });
      // ensure different createdAt timestamp
      await new Promise((r) => setTimeout(r, 10));
      const img2 = await storage.saveImageToLocal(blob2, { name: "img2", width: 200, height: 200 });

      const images = await storage.getImagesFromLocal();

      expect(images).toHaveLength(2);
      expect(images[0].id).toBe(img2.id); // Newer first
      expect(images[1].id).toBe(img1.id);
    });

    it("should support filtering by search query", async () => {
      const blob = new Blob(["dummy"], { type: "image/png" });
      await storage.saveImageToLocal(blob, { name: "Apple", width: 100, height: 100 });
      await storage.saveImageToLocal(blob, { name: "Banana", width: 100, height: 100 });
      await storage.saveImageToLocal(blob, { name: "Pineapple", width: 100, height: 100 });

      const results = await storage.getImagesFromLocal({ search: "apple" });

      expect(results).toHaveLength(2);
      expect(results.some((r) => r.name === "Apple")).toBe(true);
      expect(results.some((r) => r.name === "Pineapple")).toBe(true);
      expect(results.some((r) => r.name === "Banana")).toBe(false);
    });

    it("should support pagination (limit and offset)", async () => {
      const blob = new Blob(["dummy"], { type: "image/png" });
      await storage.saveImageToLocal(blob, { name: "Item 1", width: 10, height: 10 });
      await new Promise((r) => setTimeout(r, 5));
      await storage.saveImageToLocal(blob, { name: "Item 2", width: 10, height: 10 });
      await new Promise((r) => setTimeout(r, 5));
      await storage.saveImageToLocal(blob, { name: "Item 3", width: 10, height: 10 });
      await new Promise((r) => setTimeout(r, 5));
      await storage.saveImageToLocal(blob, { name: "Item 4", width: 10, height: 10 });

      // The order will be 4, 3, 2, 1 (newest first)
      const page1 = await storage.getImagesFromLocal({ limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);
      expect(page1[0].name).toBe("Item 4");
      expect(page1[1].name).toBe("Item 3");

      const page2 = await storage.getImagesFromLocal({ limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);
      expect(page2[0].name).toBe("Item 2");
      expect(page2[1].name).toBe("Item 1");
    });
  });

  describe("deleteImageFromLocal", () => {
    it("should delete an image from both IndexedDB and OPFS", async () => {
      const blob = new Blob(["dummy"], { type: "image/png" });
      const img = await storage.saveImageToLocal(blob, { name: "To Delete", width: 10, height: 10 });

      let images = await storage.getImagesFromLocal();
      expect(images).toHaveLength(1);

      // Reset mock to check if removeEntry is called
      mockDirectoryHandle.removeEntry.mockClear();

      await storage.deleteImageFromLocal(img.id);

      expect(mockDirectoryHandle.removeEntry).toHaveBeenCalledWith(img.opfsPath);

      images = await storage.getImagesFromLocal();
      expect(images).toHaveLength(0);
    });

    it("should handle deletion when OPFS file does not exist or fails", async () => {
      const blob = new Blob(["dummy"], { type: "image/png" });
      const img = await storage.saveImageToLocal(blob, { name: "To Delete", width: 10, height: 10 });

      mockDirectoryHandle.removeEntry.mockRejectedValueOnce(new Error("File not found"));
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await storage.deleteImageFromLocal(img.id);

      expect(consoleWarnSpy).toHaveBeenCalledWith(`Failed to delete OPFS file ${img.opfsPath}`, expect.any(Error));

      const images = await storage.getImagesFromLocal();
      expect(images).toHaveLength(0); // Should still be deleted from IndexedDB

      consoleWarnSpy.mockRestore();
    });
  });

  describe("clearAllLocalData", () => {
    it("should clear OPFS entries and IndexedDB store", async () => {
      const blob = new Blob(["dummy"], { type: "image/png" });
      await storage.saveImageToLocal(blob, { name: "img1", width: 10, height: 10 });
      await storage.saveImageToLocal(blob, { name: "img2", width: 10, height: 10 });

      let images = await storage.getImagesFromLocal();
      expect(images).toHaveLength(2);

      mockDirectoryHandle.removeEntry.mockClear();

      await storage.clearAllLocalData();

      // It should iterate over values() which yields two dummy items in our mock
      expect(mockDirectoryHandle.removeEntry).toHaveBeenCalledTimes(2);

      images = await storage.getImagesFromLocal();
      expect(images).toHaveLength(0);
    });
  });
});
