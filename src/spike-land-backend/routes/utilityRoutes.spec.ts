import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Code } from "../chatRoom";
import { UtilityRoutes } from "./utilityRoutes";

describe("UtilityRoutes", () => {
  let utilityRoutes: UtilityRoutes;
  let mockCode: Code;
  let mockStorage: { list: ReturnType<typeof vi.fn> };
  let mockEnv: Record<string, string>;

  beforeEach(() => {
    mockStorage = {
      list: vi.fn(),
    };
    mockEnv = { OPENAI_API_KEY: "test-key", ENV: "test" };

    mockCode = {
      getState: vi.fn().mockReturnValue({ storage: mockStorage }),
      getEnv: vi.fn().mockReturnValue(mockEnv),
    } as unknown as Code;

    utilityRoutes = new UtilityRoutes(mockCode);
  });

  describe("handleRequestRoute", () => {
    it("should return JSON response with 200 status", async () => {
      const request = new Request("https://example.com/request");

      const response = await utilityRoutes.handleRequestRoute(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Content-Type")).toBe("application/json; charset=UTF-8");
    });

    it("should have no-cache header", async () => {
      const request = new Request("https://example.com/request");

      const response = await utilityRoutes.handleRequestRoute(request);

      expect(response.headers.get("Cache-Control")).toBe("no-cache");
    });
  });

  describe("handleListRoute", () => {
    it("should call storage.list with allowConcurrency option", async () => {
      const mockList = new Map([
        ["key1", "value1"],
        ["key2", "value2"],
      ]);
      mockStorage.list.mockResolvedValue(mockList);

      const response = await utilityRoutes.handleListRoute();

      expect(mockStorage.list).toHaveBeenCalledWith({ allowConcurrency: true });
      expect(response.status).toBe(200);
    });

    it("should return JSON response with CORS headers", async () => {
      mockStorage.list.mockResolvedValue(new Map());

      const response = await utilityRoutes.handleListRoute();

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Content-Type")).toBe("application/json; charset=UTF-8");
    });
  });

  describe("handleRoomRoute", () => {
    it("should return the room codeSpace from URL params", async () => {
      const request = new Request("https://example.com/room?room=test-room");
      const url = new URL("https://example.com/room?room=test-room");

      const response = await utilityRoutes.handleRoomRoute(request, url);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { codeSpace: string };
      expect(body.codeSpace).toBe("test-room");
    });

    it("should return null codeSpace when room param is missing", async () => {
      const request = new Request("https://example.com/room");
      const url = new URL("https://example.com/room");

      const response = await utilityRoutes.handleRoomRoute(request, url);

      const body = (await response.json()) as { codeSpace: string | null };
      expect(body.codeSpace).toBeNull();
    });
  });

  describe("handlePathRoute", () => {
    it("should return path segments joined with ----", async () => {
      const request = new Request("https://example.com/path/to/resource");
      const url = new URL("https://example.com/path/to/resource");
      const path = ["path", "to", "resource"];

      const response = await utilityRoutes.handlePathRoute(request, url, path);

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toBe("path----to----resource");
    });

    it("should return javascript content type", async () => {
      const request = new Request("https://example.com/test");
      const url = new URL("https://example.com/test");

      const response = await utilityRoutes.handlePathRoute(request, url, ["test"]);

      expect(response.headers.get("Content-Type")).toBe("application/javascript; charset=UTF-8");
    });
  });

  describe("handleEnvRoute", () => {
    it("should return env as JSON", async () => {
      const response = await utilityRoutes.handleEnvRoute();

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, string>;
      expect(body).toEqual(mockEnv);
    });

    it("should call code.getEnv()", async () => {
      await utilityRoutes.handleEnvRoute();

      expect(mockCode.getEnv).toHaveBeenCalledOnce();
    });
  });
});
