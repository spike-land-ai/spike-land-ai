import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deleteGalleryImage } from "../client";

describe("client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
