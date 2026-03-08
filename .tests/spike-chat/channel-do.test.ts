import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChannelDurableObject } from "../../src/edge-api/spike-chat/edge/channel-do";
import { Env } from "../../src/edge-api/spike-chat/core-logic/env";

describe("ChannelDurableObject", () => {
  let mockState: any;
  let env: Env;
  let doInstance: ChannelDurableObject;

  beforeEach(() => {
    mockState = {
      acceptWebSocket: vi.fn(),
      getWebSockets: vi.fn().mockReturnValue([]),
    };
    env = {} as Env;
    doInstance = new ChannelDurableObject(mockState, env);
    (doInstance as any).ctx = mockState;
    
    // Mock global WebSocketPair
    global.WebSocketPair = class {
      0: any;
      1: any;
      constructor() {
        this[0] = { send: vi.fn(), close: vi.fn() }; // client
        this[1] = { send: vi.fn(), serializeAttachment: vi.fn(), deserializeAttachment: vi.fn() }; // server
      }
    } as any;
  });

  it("returns 404 for unknown routes", async () => {
    const res = await doInstance.fetch(new Request("http://localhost/unknown"));
    expect(res.status).toBe(404);
  });

  it("handles /broadcast POST", async () => {
    const req = new Request("http://localhost/broadcast", {
      method: "POST",
      body: JSON.stringify({ msg: "test" })
    });
    
    const mockWs = { send: vi.fn() };
    mockState.getWebSockets.mockReturnValue([mockWs]);
    
    const res = await doInstance.fetch(req);
    expect(res.status).toBe(200);
    expect(mockWs.send).toHaveBeenCalledWith('{"msg":"test"}');
  });

  it("ignores errors during broadcast", async () => {
    const req = new Request("http://localhost/broadcast", {
      method: "POST",
      body: JSON.stringify({ msg: "test" })
    });
    
    const mockWs = { send: vi.fn().mockImplementation(() => { throw new Error("Send failed"); }) };
    mockState.getWebSockets.mockReturnValue([mockWs]);
    
    const res = await doInstance.fetch(req);
    expect(res.status).toBe(200);
    expect(mockWs.send).toHaveBeenCalled();
  });

  it("handles WebSocket upgrade", async () => {
    const req = new Request("http://localhost/?userId=user1&channelId=c1", {
      headers: { "Upgrade": "websocket" }
    });
    
    const res = await doInstance.fetch(req);
    expect(res.status).toBe(101);
    expect(mockState.acceptWebSocket).toHaveBeenCalled();
  });

  it("ignores non-string WS messages", async () => {
    await doInstance.webSocketMessage({} as any, new ArrayBuffer(8));
  });

  it("ignores invalid JSON in WS messages", async () => {
    await doInstance.webSocketMessage({} as any, "invalid json");
  });

  it("handles WS ping", async () => {
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue({ userId: "u1" }), send: vi.fn() };
    await doInstance.webSocketMessage(mockWs as any, JSON.stringify({ type: "ping" }));
    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: "pong" }));
  });

  it("ignores messages without attachment", async () => {
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue(null) };
    await doInstance.webSocketMessage(mockWs as any, JSON.stringify({ type: "ping" }));
  });

  it("handles WS typing_start and typing_stop", async () => {
    vi.useFakeTimers();
    const mockWs = { 
      deserializeAttachment: vi.fn().mockReturnValue({ userId: "u1" }),
      send: vi.fn()
    };
    mockState.getWebSockets.mockReturnValue([mockWs]);
    
    // start
    await doInstance.webSocketMessage(mockWs as any, JSON.stringify({ type: "typing_start" }));
    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: "typing", users: ["u1"] }));
    
    // start again (clears timeout)
    await doInstance.webSocketMessage(mockWs as any, JSON.stringify({ type: "typing_start" }));
    
    // stop
    await doInstance.webSocketMessage(mockWs as any, JSON.stringify({ type: "typing_stop" }));
    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: "typing", users: [] }));
    
    vi.useRealTimers();
  });

  it("handles WS close", async () => {
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue({ userId: "u1" }), send: vi.fn() };
    await doInstance.webSocketClose(mockWs as any, 1000, "done", true);
  });
  
  it("ignores WS close without attachment", async () => {
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue(null), send: vi.fn() };
    await doInstance.webSocketClose(mockWs as any, 1000, "done", true);
  });

  it("handles WS error", async () => {
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue({ userId: "u1" }), send: vi.fn() };
    await doInstance.webSocketError(mockWs as any, new Error());
  });

  it("ignores WS error without attachment", async () => {
    const mockWs = { deserializeAttachment: vi.fn().mockReturnValue(null), send: vi.fn() };
    await doInstance.webSocketError(mockWs as any, new Error());
  });
});
