import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageService } from "../services/storageService";
import { GetHandler } from "./getHandler";

describe("GetHandler", () => {
  let handler: GetHandler;
  let mockStorageService: StorageService;

  beforeEach(() => {
    mockStorageService = {
      loadRequestBody: vi.fn(),
      saveRequestBody: vi.fn(),
    } as unknown as StorageService;

    handler = new GetHandler(mockStorageService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("handle", () => {
    it("should return stored request body when it exists", async () => {
      const storedBody = {
        messages: [{ role: "user" as const, content: "Hello" }],
      };
      vi.mocked(mockStorageService.loadRequestBody).mockResolvedValue(storedBody);

      const response = await handler.handle("my-space");

      expect(response.status).toBe(200);
      expect(mockStorageService.loadRequestBody).toHaveBeenCalledWith("my-space");

      const body = await response.json();
      expect(body).toEqual(storedBody);
    });

    it("should return empty messages array when no stored body exists", async () => {
      vi.mocked(mockStorageService.loadRequestBody).mockResolvedValue(null);

      const response = await handler.handle("empty-space");

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ messages: [] });
    });

    it("should set CORS headers on response when body exists", async () => {
      const storedBody = { messages: [] };
      vi.mocked(mockStorageService.loadRequestBody).mockResolvedValue(storedBody);

      const response = await handler.handle("test-space");

      expect(response.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
    });

    it("should set CORS headers on response when body is null", async () => {
      vi.mocked(mockStorageService.loadRequestBody).mockResolvedValue(null);

      const response = await handler.handle("test-space");

      expect(response.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
    });

    it("should return messages from different codeSpaces correctly", async () => {
      const spaceABody = {
        messages: [{ role: "user" as const, content: "Space A" }],
      };
      vi.mocked(mockStorageService.loadRequestBody).mockResolvedValue(spaceABody);

      const response = await handler.handle("space-a");

      expect(mockStorageService.loadRequestBody).toHaveBeenCalledWith("space-a");
      const body = await response.json();
      expect(body).toEqual(spaceABody);
    });
  });
});
