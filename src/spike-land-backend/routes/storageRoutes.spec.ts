import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Code } from "../chatRoom";
import { StorageRoutes } from "./storageRoutes";

describe("StorageRoutes", () => {
  let storageRoutes: StorageRoutes;
  let mockCode: Code;
  let mockStorage: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockStorage = {
      get: vi.fn(),
    };

    mockCode = {
      getState: vi.fn().mockReturnValue({ storage: mockStorage }),
    } as unknown as Code;

    storageRoutes = new StorageRoutes(mockCode);
  });

  describe("handleHashCodeRoute", () => {
    it("should return the stored patch when hash exists", async () => {
      const mockPatch = { patch: "some diff", oldHash: 12345 };
      mockStorage.get.mockResolvedValue(mockPatch);

      const request = new Request("https://example.com/hash/67890");
      const url = new URL("https://example.com/hash/67890");
      const path = ["hash", "67890"];

      const response = await storageRoutes.handleHashCodeRoute(request, url, path);

      expect(response.status).toBe(200);
      expect(mockStorage.get).toHaveBeenCalledWith("67890", {
        allowConcurrency: true,
      });

      const body = await response.json();
      expect(body).toEqual(mockPatch);
    });

    it("should return empty object when hash not found", async () => {
      mockStorage.get.mockResolvedValue(null);

      const request = new Request("https://example.com/hash/99999");
      const url = new URL("https://example.com/hash/99999");
      const path = ["hash", "99999"];

      const response = await storageRoutes.handleHashCodeRoute(request, url, path);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({});
    });

    it("should return proper CORS and cache control headers", async () => {
      mockStorage.get.mockResolvedValue(null);

      const request = new Request("https://example.com/hash/12345");
      const url = new URL("https://example.com/hash/12345");
      const path = ["hash", "12345"];

      const response = await storageRoutes.handleHashCodeRoute(request, url, path);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Cache-Control")).toBe("no-cache");
      expect(response.headers.get("Content-Type")).toBe("application/json; charset=UTF-8");
    });

    it("should convert path segment to number string for storage key", async () => {
      mockStorage.get.mockResolvedValue(null);

      const request = new Request("https://example.com/hash/00042");
      const url = new URL("https://example.com/hash/00042");
      const path = ["hash", "00042"];

      await storageRoutes.handleHashCodeRoute(request, url, path);

      // String(Number("00042")) = "42"
      expect(mockStorage.get).toHaveBeenCalledWith("42", expect.any(Object));
    });
  });
});
