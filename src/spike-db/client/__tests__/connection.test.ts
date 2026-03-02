import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Connection } from "../connection.js";

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = 0;
  listeners: Record<string, Function[]> = {};
  
  constructor(public url: string) {
    // Connect synchronously for tests to avoid timer races
    this.readyState = MockWebSocket.OPEN;
    // We can't trigger open in constructor because addEventListener hasn't been called yet.
    // So we'll trigger it manually in the test or via a microtask.
    queueMicrotask(() => this.trigger("open", {}));
  }

  addEventListener(event: string, cb: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  trigger(event: string, data: any) {
    this.listeners[event]?.forEach(cb => cb(data));
  }

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    this.trigger("close", {});
  });
}

// @ts-ignore
global.WebSocket = MockWebSocket;

describe("Connection", () => {
  let conn: Connection;
  let options: any;

  beforeEach(() => {
    vi.useFakeTimers();
    options = {
      url: "ws://test",
      onMessage: vi.fn(),
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn(),
    };
    conn = new Connection(options);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("connects and calls onOpen", async () => {
    conn.connect();
    await vi.advanceTimersByTimeAsync(10);
    expect(options.onOpen).toHaveBeenCalled();
  });

  it("handles messages", async () => {
    conn.connect();
    await vi.advanceTimersByTimeAsync(10);
    const ws = (conn as any).ws;
    ws.trigger("message", { data: JSON.stringify({ hello: "world" }) });
    expect(options.onMessage).toHaveBeenCalledWith({ hello: "world" });
  });

  it("queues and flushes pending messages", async () => {
    conn.send("msg1");
    expect(conn.isConnected).toBe(false);
    
    conn.connect();
    await vi.advanceTimersByTimeAsync(10);
    
    expect(conn.isConnected).toBe(true);
    const ws = (conn as any).ws;
    expect(ws.send).toHaveBeenCalledWith("msg1");
  });

  it("schedules reconnect on close", async () => {
    conn.connect();
    await vi.advanceTimersByTimeAsync(10);
    
    const ws = (conn as any).ws;
    ws.trigger("close", {});
    
    expect(options.onClose).toHaveBeenCalled();
    
    // Fast forward to reconnect delay
    await vi.advanceTimersByTimeAsync(1000); // Initial delay is 1000ms
    expect(options.onOpen).toHaveBeenCalledTimes(2);
  });

  it("disconnects cleanly without reconnecting", async () => {
    conn.connect();
    await vi.advanceTimersByTimeAsync(10);
    
    conn.disconnect();
    expect(options.onClose).not.toHaveBeenCalled(); // disconnecting flag true
    
    await vi.advanceTimersByTimeAsync(5000);
    expect(options.onOpen).toHaveBeenCalledTimes(1); // No new connection
  });
});
