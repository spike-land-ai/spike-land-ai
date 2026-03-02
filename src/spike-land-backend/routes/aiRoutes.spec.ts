import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Code } from "../chatRoom";
import { GetHandler } from "../handlers/getHandler";
import { PostHandler } from "../handlers/postHandler";
import { StorageService } from "../services/storageService";
import { AiRoutes } from "./aiRoutes";

vi.mock("../services/storageService");
vi.mock("../handlers/getHandler");
vi.mock("../handlers/postHandler");

describe("AiRoutes", () => {
  let aiRoutes: AiRoutes;
  let mockCode: Code;
  let mockGetHandler: { handle: ReturnType<typeof vi.fn> };
  let mockPostHandler: { handle: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    mockCode = {
      getSession: vi.fn().mockReturnValue({ codeSpace: "test-space" }),
      getEnv: vi.fn().mockReturnValue({ R2: {} }),
      getMcpServer: vi.fn().mockReturnValue({ tools: [] }),
      getOrigin: vi.fn().mockReturnValue("https://test.spike.land"),
    } as unknown as Code;

    mockGetHandler = { handle: vi.fn() };
    mockPostHandler = { handle: vi.fn() };

    vi.mocked(StorageService).mockImplementation(function () {
      return {} as StorageService;
    });
    vi.mocked(GetHandler).mockImplementation(function () {
      return mockGetHandler as unknown as GetHandler;
    });
    vi.mocked(PostHandler).mockImplementation(function () {
      return mockPostHandler as unknown as PostHandler;
    });

    aiRoutes = new AiRoutes(mockCode);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("handleMessagesRoute", () => {
    const url = new URL("https://test.spike.land/api/messages");

    describe("OPTIONS preflight", () => {
      it("should return 204 response for OPTIONS requests", async () => {
        const request = new Request("https://test.spike.land/api/messages", {
          method: "OPTIONS",
        });

        const response = await aiRoutes.handleMessagesRoute(request, url, []);

        expect(response.status).toBe(204);
        expect(response.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
      });
    });

    describe("GET requests", () => {
      it("should call getHandler with the codeSpace", async () => {
        const mockResponse = new Response(JSON.stringify({ messages: [] }), {
          status: 200,
        });
        mockGetHandler.handle.mockResolvedValue(mockResponse);

        const request = new Request("https://test.spike.land/api/messages", {
          method: "GET",
        });

        const response = await aiRoutes.handleMessagesRoute(request, url, []);

        expect(mockGetHandler.handle).toHaveBeenCalledWith("test-space");
        expect(response).toBe(mockResponse);
      });
    });

    describe("POST requests", () => {
      it("should call postHandler with request and url", async () => {
        const mockResponse = new Response("stream", { status: 200 });
        mockPostHandler.handle.mockResolvedValue(mockResponse);

        const request = new Request("https://test.spike.land/api/messages", {
          method: "POST",
          body: JSON.stringify({ messages: [] }),
          headers: { "Content-Type": "application/json" },
        });

        const response = await aiRoutes.handleMessagesRoute(request, url, []);

        expect(mockPostHandler.handle).toHaveBeenCalledWith(request, url);
        expect(response).toBe(mockResponse);
      });
    });

    describe("unsupported methods", () => {
      it("should return 405 for DELETE requests", async () => {
        const request = new Request("https://test.spike.land/api/messages", {
          method: "DELETE",
        });

        const response = await aiRoutes.handleMessagesRoute(request, url, []);

        expect(response.status).toBe(405);
        const body = await response.text();
        expect(body).toBe("Method not allowed");
      });

      it("should return 405 for PUT requests", async () => {
        const request = new Request("https://test.spike.land/api/messages", {
          method: "PUT",
          body: "{}",
        });

        const response = await aiRoutes.handleMessagesRoute(request, url, []);

        expect(response.status).toBe(405);
      });
    });
  });
});
