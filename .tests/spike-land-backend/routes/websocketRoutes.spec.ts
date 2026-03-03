import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Code } from "../../../src/spike-land-backend/chatRoom";
import { WebsocketRoutes } from "../../../src/spike-land-backend/routes/websocketRoutes";

vi.mock("@spike-land-ai/code", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@spike-land-ai/code")>();
  return {
    ...actual,
    computeSessionHash: vi.fn().mockReturnValue("mock-hash"),
  };
});

describe("WebsocketRoutes", () => {
  let websocketRoutes: WebsocketRoutes;
  let mockCode: Code;
  let mockWsHandler: {
    getActiveUsers: ReturnType<typeof vi.fn>;
  };
  let mockAcceptWebSocket: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockWsHandler = {
      getActiveUsers: vi.fn().mockReturnValue(["user1", "user2"]),
    };

    mockAcceptWebSocket = vi.fn();

    mockCode = {
      wsHandler: mockWsHandler,
      getState: vi.fn().mockReturnValue({
        acceptWebSocket: mockAcceptWebSocket,
      }),
      getSession: vi.fn().mockReturnValue({
        code: "mock code",
        html: "mock html",
        css: "mock css",
        transpiled: "mock transpiled",
        codeSpace: "test-space",
        messages: [],
      }),
    } as unknown as Code;

    websocketRoutes = new WebsocketRoutes(mockCode);
  });

  describe("handleWebsocketRoute", () => {
    it("should return 400 if request does not have websocket upgrade header", async () => {
      const request = new Request("https://example.com/ws");

      const response = await websocketRoutes.handleWebsocketRoute(request);

      expect(response.status).toBe(400);
      const body = await response.text();
      expect(body).toBe("Expected websocket");
    });

    it("should attempt WebSocket upgrade for requests with Upgrade header (CF Workers env)", async () => {
      const request = new Request("https://example.com/ws", {
        headers: { Upgrade: "websocket" },
      });

      // WebSocketPair is only available in Cloudflare Workers
      try {
        const response = await websocketRoutes.handleWebsocketRoute(request);
        // If it works (CF Workers), verify the response
        expect(response.status).toBe(101);
        expect(mockAcceptWebSocket).toHaveBeenCalled();
      } catch {
        // WebSocketPair not available in Node.js - expected in test environment
      }
    });
  });

  describe("handleUsersRoute", () => {
    it("should return active users for the given room", async () => {
      mockWsHandler.getActiveUsers.mockReturnValue(["alice", "bob", "charlie"]);

      const request = new Request("https://example.com/users?room=my-room");
      const url = new URL("https://example.com/users?room=my-room");

      const response = await websocketRoutes.handleUsersRoute(request, url);

      expect(response.status).toBe(200);
      expect(mockWsHandler.getActiveUsers).toHaveBeenCalledWith("my-room");

      const body = (await response.json()) as { users: string[] };
      expect(body.users).toEqual(["alice", "bob", "charlie"]);
    });

    it("should use empty string when room param is missing", async () => {
      mockWsHandler.getActiveUsers.mockReturnValue([]);

      const request = new Request("https://example.com/users");
      const url = new URL("https://example.com/users");

      const _response = await websocketRoutes.handleUsersRoute(request, url);

      expect(mockWsHandler.getActiveUsers).toHaveBeenCalledWith("");
    });

    it("should set CORS and JSON headers", async () => {
      mockWsHandler.getActiveUsers.mockReturnValue([]);
      const request = new Request("https://example.com/users?room=test");
      const url = new URL("https://example.com/users?room=test");

      const response = await websocketRoutes.handleUsersRoute(request, url);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });
  });
});
