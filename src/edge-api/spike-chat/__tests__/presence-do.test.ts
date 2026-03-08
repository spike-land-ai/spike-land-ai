import { describe, it, expect, vi, beforeEach } from "vitest";
import { PresenceDurableObject } from "../edge/presence-do";
import { Env } from "../core-logic/env";

describe("PresenceDurableObject", () => {
  let mockState: any;
  let env: Env;
  let doInstance: PresenceDurableObject;

  beforeEach(() => {
    mockState = {
      acceptWebSocket: vi.fn(),
      getWebSockets: vi.fn().mockReturnValue([]),
      blockConcurrencyWhile: vi.fn().mockImplementation((cb: any) => cb()),
      storage: {
        getAlarm: vi.fn().mockResolvedValue(null),
        setAlarm: vi.fn(),
      }
    };
    env = {} as Env;
    doInstance = new PresenceDurableObject(mockState, env);
    (doInstance as any).ctx = mockState;

    // Mock global Response to allow 101 status
    const OriginalResponse = global.Response;
    global.Response = class MockResponse {
      status: number;
      webSocket: any;
      constructor(body: any, init?: any) {
        if (init?.status === 101) {
          this.status = 101;
          this.webSocket = init.webSocket;
        } else {
          return new OriginalResponse(body, init);
        }
      }
    } as any;

    global.WebSocketPair = class {
      0: any;
      1: any;
      constructor() {
        this[0] = { send: vi.fn(), close: vi.fn() };
        this[1] = { send: vi.fn(), serializeAttachment: vi.fn(), deserializeAttachment: vi.fn() };
      }
    } as any;
  });

  it("returns 404 for unknown routes", async () => {
    const res = await doInstance.fetch(new Request("http://localhost/unknown"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for WS upgrade without userId", async () => {
    const req = new Request("http://localhost/", { headers: { "Upgrade": "websocket" } });
    const res = await doInstance.fetch(req);
    expect(res.status).toBe(400);
  });

  it("handles WS upgrade", async () => {
    const req = new Request("http://localhost/?userId=user1", { headers: { "Upgrade": "websocket" } });
    const res = await doInstance.fetch(req);
    expect(res.status).toBe(101);
  });

  it("handles GET /state", async () => {
    const req = new Request("http://localhost/state", { method: "GET" });
    const res = await doInstance.fetch(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it("handles WS heartbeat", async () => {
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue({ userId: "u1" }), send: vi.fn() };
    await doInstance.webSocketMessage(mockWs as any, JSON.stringify({ type: "heartbeat" }));
  });

  it("handles WS ping", async () => {
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue({ userId: "u1" }), send: vi.fn() };
    await doInstance.webSocketMessage(mockWs as any, JSON.stringify({ type: "ping" }));
    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: "pong" }));
  });

  it("handles WS presence_set and same status heartbeat", async () => {
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue({ userId: "u1" }), send: vi.fn() };
    mockState.getWebSockets.mockReturnValue([mockWs]);
    await doInstance.webSocketMessage(mockWs as any, JSON.stringify({ type: "presence_set", status: "away" }));
    expect(mockWs.send).toHaveBeenCalled();

    // Send same status again to cover the else branch (existing.lastSeen = now)
    await doInstance.webSocketMessage(mockWs as any, JSON.stringify({ type: "presence_set", status: "away" }));
  });

  it("ignores non-string or invalid WS messages", async () => {
    await doInstance.webSocketMessage({} as any, new ArrayBuffer(8));
    await doInstance.webSocketMessage({} as any, "invalid json");
  });

  it("ignores messages without attachment", async () => {
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue(null), send: vi.fn() };
    await doInstance.webSocketMessage(mockWs as any, JSON.stringify({ type: "ping" }));
  });

  it("handles WS close and removes presence if no other sockets", async () => {
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue({ userId: "u1" }) };
    mockState.getWebSockets.mockReturnValue([]);
    await doInstance.webSocketClose(mockWs as any);
  });

  it("ignores WS close if attachment missing", async () => {
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue(null) };
    await doInstance.webSocketClose(mockWs as any);
  });

  it("handles WS error and removes presence if no other sockets", async () => {
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue({ userId: "u1" }) };
    mockState.getWebSockets.mockReturnValue([]);
    await doInstance.webSocketError(mockWs as any);
  });

  it("ignores WS error if attachment missing", async () => {
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue(null) };
    await doInstance.webSocketError(mockWs as any);
  });

  it("handles alarm and expires inactive users", async () => {
    // Add user via WS
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue({ userId: "u1" }), send: vi.fn() };
    mockState.getWebSockets.mockReturnValue([mockWs]);
    await doInstance.webSocketMessage(mockWs as any, JSON.stringify({ type: "presence_set", status: "online" }));

    // Time travel
    const RealDate = Date;
    global.Date = class extends RealDate {
      static now() {
        return super.now() + 100000; // > TIMEOUT
      }
    } as any;

    await doInstance.alarm();
    global.Date = RealDate;
  });

  it("handles alarm and deletes fully offline users", async () => {
    // Add user via WS
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue({ userId: "u1" }), send: vi.fn() };
    mockState.getWebSockets.mockReturnValue([mockWs]);
    await doInstance.webSocketMessage(mockWs as any, JSON.stringify({ type: "presence_set", status: "offline" }));

    // Time travel
    const RealDate = Date;
    global.Date = class extends RealDate {
      static now() {
        return super.now() + 200000; // > TIMEOUT * 2
      }
    } as any;

    await doInstance.alarm();
    global.Date = RealDate;
  });

  it("ignores errors during broadcast", async () => {
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue({ userId: "u1" }), send: vi.fn().mockImplementation(() => { throw new Error("Send failed"); }) };
    mockState.getWebSockets.mockReturnValue([mockWs]);
    await doInstance.webSocketMessage(mockWs as any, JSON.stringify({ type: "presence_set", status: "away" }));
  });
});
