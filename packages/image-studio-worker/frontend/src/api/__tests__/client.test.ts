import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deleteGalleryImage, uploadToGallery } from "../client";

describe("client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("uploadToGallery", () => {
    it("should upload a file correctly without optional parameters", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ image: { id: "test-id" }, url: "test-url" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const file = new File(["test-content"], "test.png", { type: "image/png" });
      const result = await uploadToGallery(file);

      expect(result).toEqual({ image: { id: "test-id" }, url: "test-url" });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe("/api/gallery/upload");
      expect(callArgs[1].method).toBe("POST");
      expect(callArgs[1].headers).toEqual({
        Authorization: "Bearer demo",
      });

      const body = callArgs[1].body as FormData;
      expect(body).toBeInstanceOf(FormData);
      expect(body.get("file")).toBe(file);
      expect(body.has("name")).toBe(false);
      expect(body.has("tags")).toBe(false);
      expect(body.has("albumId")).toBe(false);
    });

    it("should append optional parameters correctly to FormData", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ image: { id: "test-id" }, url: "test-url" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const file = new File(["test-content"], "test.png", { type: "image/png" });
      await uploadToGallery(file, {
        name: "Test Name",
        tags: ["tag1", "tag2"],
        albumId: "album-123",
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body as FormData;
      expect(body.get("file")).toBe(file);
      expect(body.get("name")).toBe("Test Name");
      expect(body.get("tags")).toBe(JSON.stringify(["tag1", "tag2"]));
      expect(body.get("albumId")).toBe("album-123");
    });

    it("should include gemini key in headers if present in storage", async () => {
      vi.spyOn(sessionStorage, "getItem").mockImplementation((key) => {
        if (key === "gemini_api_key") return "test-gemini-key";
        return null;
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      vi.stubGlobal("fetch", mockFetch);

      const file = new File(["test-content"], "test.png", { type: "image/png" });
      await uploadToGallery(file);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers).toEqual({
        Authorization: "Bearer demo",
        "X-Gemini-Key": "test-gemini-key",
      });
    });

    it("should throw an error if the upload fails", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request"),
      });
      vi.stubGlobal("fetch", mockFetch);

      const file = new File(["test-content"], "test.png", { type: "image/png" });
      await expect(uploadToGallery(file)).rejects.toThrow("Upload failed 400: Bad Request");
    });
  });

  describe("deleteGalleryImage", () => {
    it("should call fetch with the correct path and options", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      vi.stubGlobal("fetch", mockFetch);

      await deleteGalleryImage("test-image-id");

      expect(mockFetch).toHaveBeenCalledWith("/api/gallery/image/test-image-id", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer demo",
        },
      });
    });

    it("should include gemini key and image model in headers if present in storage", async () => {
      vi.spyOn(sessionStorage, "getItem").mockImplementation((key) => {
        if (key === "gemini_api_key") return "test-gemini-key";
        return null;
      });
      vi.spyOn(localStorage, "getItem").mockImplementation((key) => {
        if (key === "pref_image_model") return "test-image-model";
        return null;
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      vi.stubGlobal("fetch", mockFetch);

      await deleteGalleryImage("test-image-id");

      expect(mockFetch).toHaveBeenCalledWith("/api/gallery/image/test-image-id", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer demo",
          "X-Gemini-Key": "test-gemini-key",
          "X-Image-Model": "test-image-model",
        },
      });
    });

    it("should throw an error if the response is not ok", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not Found"),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(deleteGalleryImage("test-image-id")).rejects.toThrow("API error 404: Not Found");
    });
  });
});
