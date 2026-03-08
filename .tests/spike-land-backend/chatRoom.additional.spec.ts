/**
 * Additional chatRoom tests for uncovered methods
 * Lines 684, 695-747: swarm agents, webSocketMessage/Close/Error, getState/Origin/Env,
 * getVersionsList, getVersionCount, _saveVersion error path
 */
import type { ICodeSession } from "@spike-land-ai/code";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Code } from "../../src/edge-api/backend/lazy-imports/chatRoom.js";
import type Env from "../../src/edge-api/backend/core-logic/env.js";
import { RouteHandler } from "../../src/edge-api/backend/core-logic/routeHandler.js";
import { WebSocketHandler } from "../../src/edge-api/backend/lazy-imports/websocketHandler.js";

vi.mock("../../src/edge-api/backend/core-logic/routeHandler", () => ({
  RouteHandler: vi.fn().mockImplementation(function () {
    return { handleRoute: vi.fn().mockResolvedValue(new Response("OK")) };
  }),
}));

vi.mock("../../src/edge-api/backend/lazy-imports/websocketHandler", () => ({
  WebSocketHandler: vi.fn().mockImplementation(function () {
    return {
      broadcast: vi.fn(),
      handleWebSocket: vi.fn(),
      handleMessage: vi.fn(),
      handleClose: vi.fn(),
      handleError: vi.fn(),
      getWsSessions: vi.fn().mockReturnValue([]),
    };
  }),
}));

vi.mock("../../src/edge-api/backend/core-logic/mcp", () => ({
  McpServer: vi.fn().mockImplementation(function () {
    return { handleRequest: vi.fn().mockResolvedValue(new Response("MCP OK")), setEnv: vi.fn() };
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Code Durable Object additional coverage", () => {
  let mockState: DurableObjectState;
  let mockEnv: Env;
  let codeInstance: Code;

  const createSession = (overrides: Partial<ICodeSession> = {}): ICodeSession => ({
    code: "export default function App() { return <div>Hello</div>; }",
    html: "<div>Hello</div>",
    css: "",
    transpiled: "transpiled code",
    codeSpace: "test-space",
    messages: [],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockState = {
      storage: {
        get: vi.fn(),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn(),
        list: vi.fn().mockResolvedValue(new Map()),
        deleteAll: vi.fn(),
        transaction: vi.fn((closure: () => Promise<unknown>) => closure()),
        getAlarm: vi.fn(),
        setAlarm: vi.fn(),
        deleteAlarm: vi.fn(),
        blockConcurrencyWhile: vi.fn((callback: () => unknown) => callback()),
      } as unknown,
      id: {
        toString: () => "test-id",
        equals: vi.fn(),
        name: "test-name",
      } as DurableObjectId,
      waitUntil: vi.fn(),
      blockConcurrencyWhile: vi.fn(async (callback: () => Promise<unknown>) => await callback()),
      getWebSockets: vi.fn().mockReturnValue([]),
    } as unknown as DurableObjectState;

    mockEnv = {
      R2: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      KV: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as Env;

    (RouteHandler as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return { handleRoute: vi.fn().mockResolvedValue(new Response("OK")) };
    });
    (WebSocketHandler as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        broadcast: vi.fn(),
        handleWebSocket: vi.fn(),
        handleMessage: vi.fn(),
        handleClose: vi.fn(),
        handleError: vi.fn(),
        getWsSessions: vi.fn().mockReturnValue([]),
      };
    });

    codeInstance = new Code(mockState, mockEnv);
  });

  describe("swarm agent management (lines 694-711)", () => {
    it("registers a swarm agent", () => {
      codeInstance.registerSwarmAgent("agent-1", "Agent One", ["chat", "code"]);
      const agents = codeInstance.getSwarmAgents();
      expect(agents.has("agent-1")).toBe(true);
      expect(agents.get("agent-1")?.displayName).toBe("Agent One");
      expect(agents.get("agent-1")?.capabilities).toEqual(["chat", "code"]);
    });

    it("unregisters a swarm agent", () => {
      codeInstance.registerSwarmAgent("agent-1", "Agent One", []);
      codeInstance.unregisterSwarmAgent("agent-1");
      const agents = codeInstance.getSwarmAgents();
      expect(agents.has("agent-1")).toBe(false);
    });

    it("returns empty map when no agents registered", () => {
      const agents = codeInstance.getSwarmAgents();
      expect(agents.size).toBe(0);
    });
  });

  describe("webSocketMessage (line 715-728)", () => {
    it("handles message when initialized", async () => {
      // Mark as initialized first
      codeInstance.initialized = true;

      const ws = {} as WebSocket;
      await codeInstance.webSocketMessage(ws, '{"type":"ping"}');

      expect(codeInstance.wsHandler.handleMessage).toHaveBeenCalledWith(ws, '{"type":"ping"}');
    });

    it("initializes on wake from hibernation when not initialized", async () => {
      // Not initialized
      codeInstance.initialized = false;

      // Mock storage get to return session data for initialization
      (mockState.storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === "session") {
          return Promise.resolve(createSession());
        }
        return Promise.resolve(null);
      });

      const ws = {} as WebSocket;
      await codeInstance.webSocketMessage(ws, '{"type":"ping"}');

      expect(codeInstance.wsHandler.handleMessage).toHaveBeenCalledWith(ws, '{"type":"ping"}');
    });

    it("handles initialization error on wake and still processes message", async () => {
      codeInstance.initialized = false;

      // Make storage throw so initialization fails
      (mockState.storage.get as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Storage unavailable"),
      );

      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const ws = {} as WebSocket;
      await codeInstance.webSocketMessage(ws, '{"type":"ping"}');

      expect(consoleError).toHaveBeenCalled();
      expect(codeInstance.wsHandler.handleMessage).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("webSocketClose (line 730-732)", () => {
    it("delegates to wsHandler.handleClose", async () => {
      const ws = {} as WebSocket;
      await codeInstance.webSocketClose(ws, 1000, "normal close", true);

      expect(codeInstance.wsHandler.handleClose).toHaveBeenCalledWith(ws);
    });
  });

  describe("webSocketError (line 734-736)", () => {
    it("delegates to wsHandler.handleError", async () => {
      const ws = {} as WebSocket;
      const error = new Error("Socket error");
      await codeInstance.webSocketError(ws, error);

      expect(codeInstance.wsHandler.handleError).toHaveBeenCalledWith(ws, error);
    });
  });

  describe("getState, getOrigin, getEnv (lines 738-748)", () => {
    it("returns the DurableObject state", () => {
      expect(codeInstance.getState()).toBe(mockState);
    });

    it("returns the origin (empty string initially)", () => {
      expect(codeInstance.getOrigin()).toBe("");
    });

    it("returns the environment", () => {
      expect(codeInstance.getEnv()).toBe(mockEnv);
    });
  });

  describe("getVersionCount and getVersionsList (lines 104-128)", () => {
    it("returns 0 version count initially", () => {
      expect(codeInstance.getVersionCount()).toBe(0);
    });

    it("returns empty array when no versions", async () => {
      const versions = await codeInstance.getVersionsList();
      expect(versions).toEqual([]);
    });
  });

  describe("getVersion (lines 96-99)", () => {
    it("returns null when version does not exist", async () => {
      (mockEnv.R2.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockState.storage.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const version = await codeInstance.getVersion(1);
      expect(version).toBeNull();
    });
  });

  describe("_saveVersion error path (line 684)", () => {
    it("continues when _saveVersion fails during updateAndBroadcastSession", async () => {
      // Initialize with a session using mock storage
      const _initialSession = createSession({ code: "initial code" });
      codeInstance.initialized = true;

      // Set up storage for initialization
      (mockState.storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === "session_core")
          return Promise.resolve({
            codeSpace: "test-space",
            html: "<div></div>",
            css: "",
            messages: [],
          });
        if (key === "session_code") return Promise.resolve("initial code");
        if (key === "session_transpiled") return Promise.resolve("transpiled");
        return Promise.resolve(null);
      });

      await codeInstance["initializeSession"](new URL("https://example.com/?room=test"));

      // Spy on largeStorage.put and make version saves fail
      const largeStorage = codeInstance["largeStorage"];
      const originalPut = largeStorage.put.bind(largeStorage);
      const _callCount = 0;
      vi.spyOn(largeStorage, "put").mockImplementation(async (key: string, value: unknown) => {
        if (key.startsWith("version_")) {
          throw new Error("Version storage failed");
        }
        return originalPut(key, value);
      });

      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      // Update session with different code to trigger version save
      const newSession = createSession({ code: "new code", transpiled: "new transpiled" });
      await codeInstance.updateAndBroadcastSession(newSession);

      // Should have logged an error but not thrown
      consoleError.mockRestore();
    });
  });
});
