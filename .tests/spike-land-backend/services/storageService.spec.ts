import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Env from "../../../src/spike-land-backend/env";
import { StorageService } from "../../../src/spike-land-backend/services/storageService";

describe("StorageService", () => {
  let service: StorageService;
  let mockEnv: Env;
  let mockR2Object: { text: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockR2Object = {
      text: vi.fn(),
    };

    mockEnv = {
      R2: {
        get: vi.fn(),
        put: vi.fn(),
        head: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
      },
    } as unknown as Env;

    service = new StorageService(mockEnv);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("loadRequestBody", () => {
    it("should return parsed body from R2 when it exists", async () => {
      const storedData = {
        messages: [{ role: "user", content: "Hello" }],
      };
      mockR2Object.text.mockResolvedValue(JSON.stringify(storedData));
      vi.mocked(mockEnv.R2.get).mockResolvedValue(
        mockR2Object as unknown as ReturnType<typeof mockEnv.R2.get>,
      );

      const result = await service.loadRequestBody("test-space");

      expect(mockEnv.R2.get).toHaveBeenCalledWith("request_body_test-space");
      expect(result).toEqual(storedData);
    });

    it("should return null when R2 returns no object", async () => {
      vi.mocked(mockEnv.R2.get).mockResolvedValue(null);

      const result = await service.loadRequestBody("empty-space");

      expect(result).toBeNull();
    });

    it("should return null and log error when R2 throws an exception", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(mockEnv.R2.get).mockRejectedValue(new Error("R2 connection failed"));

      const result = await service.loadRequestBody("error-space");

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load request body"),
        expect.any(Error),
      );
    });

    it("should return null and log error when JSON parsing fails", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockR2Object.text.mockResolvedValue("invalid json {{{");
      vi.mocked(mockEnv.R2.get).mockResolvedValue(
        mockR2Object as unknown as ReturnType<typeof mockEnv.R2.get>,
      );

      const result = await service.loadRequestBody("broken-json-space");

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should use correct R2 key format", async () => {
      vi.mocked(mockEnv.R2.get).mockResolvedValue(null);

      await service.loadRequestBody("my-code-space");

      expect(mockEnv.R2.get).toHaveBeenCalledWith("request_body_my-code-space");
    });
  });

  describe("saveRequestBody", () => {
    it("should save body as JSON to R2", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(mockEnv.R2.put).mockResolvedValue(undefined as never);
      const body = {
        messages: [
          { role: "user" as const, content: "Hello" },
          { role: "assistant" as const, content: "Hi there" },
        ],
      };

      await service.saveRequestBody("my-space", body);

      expect(mockEnv.R2.put).toHaveBeenCalledWith("request_body_my-space", JSON.stringify(body));
    });

    it("should throw error when R2 put fails", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const r2Error = new Error("R2 put failed");
      vi.mocked(mockEnv.R2.put).mockRejectedValue(r2Error);

      await expect(service.saveRequestBody("fail-space", { messages: [] })).rejects.toThrow(
        "R2 put failed",
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to save request body"),
        r2Error,
      );
    });

    it("should use correct R2 key format", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(mockEnv.R2.put).mockResolvedValue(undefined as never);

      await service.saveRequestBody("code-space-123", { messages: [] });

      expect(mockEnv.R2.put).toHaveBeenCalledWith(
        "request_body_code-space-123",
        expect.any(String),
      );
    });

    it("should save empty messages array", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(mockEnv.R2.put).mockResolvedValue(undefined as never);

      await service.saveRequestBody("empty-space", { messages: [] });

      expect(mockEnv.R2.put).toHaveBeenCalled();
    });
  });
});
