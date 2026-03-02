import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to test the createStdbClient logic. Since stdb.ts exports a singleton,
// we re-import each test to get fresh module state via vi.importActual won't help.
// Instead we test the exported singleton's public API.

describe("stdbClient", () => {
  let stdbClient: typeof import("./stdb").stdbClient;
  let MockWebSocket: ReturnType<typeof vi.fn>;
  let wsInstances: Array<{
    url: string;
    listeners: Map<string, Set<EventListener>>;
    close: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    fire: (event: string, data?: unknown) => void;
  }>;

  beforeEach(async () => {
    vi.useFakeTimers();
    wsInstances = [];

    MockWebSocket = vi.fn().mockImplementation(function (url: string) {
      const listeners = new Map<string, Set<EventListener>>();
      const instance = {
        url,
        listeners,
        close: vi.fn().mockImplementation(function (this: typeof instance) {
          this.fire("close");
        }),
        send: vi.fn(),
        addEventListener(event: string, handler: EventListener) {
          if (!listeners.has(event)) listeners.set(event, new Set());
          listeners.get(event)!.add(handler);
        },
        removeEventListener(event: string, handler: EventListener) {
          listeners.get(event)?.delete(handler);
        },
        fire(event: string) {
          const handlers = listeners.get(event);
          if (handlers) {
            for (const h of handlers) h(new Event(event));
          }
        },
      };
      wsInstances.push(instance);
      return instance;
    });

    vi.stubGlobal("WebSocket", MockWebSocket);

    // Fresh import each test
    vi.resetModules();
    const mod = await import("./stdb");
    stdbClient = mod.stdbClient;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts in disconnected state", () => {
    expect(stdbClient.getSnapshot()).toBe("disconnected");
    expect(stdbClient.error).toBeNull();
    expect(stdbClient.ws).toBeNull();
  });

  it("transitions to connecting then connected", () => {
    stdbClient.connect();
    expect(stdbClient.getSnapshot()).toBe("connecting");
    expect(MockWebSocket).toHaveBeenCalledTimes(1);

    // Simulate open
    wsInstances[0].fire("open");
    expect(stdbClient.getSnapshot()).toBe("connected");
  });

  it("passes token as query param", () => {
    stdbClient.connect("my-token");
    expect(wsInstances[0].url).toContain("?token=my-token");
  });

  it("does not create duplicate connections", () => {
    stdbClient.connect();
    stdbClient.connect();
    expect(MockWebSocket).toHaveBeenCalledTimes(1);
  });

  it("transitions to error state on WebSocket error", () => {
    stdbClient.connect();
    wsInstances[0].fire("error");
    expect(stdbClient.getSnapshot()).toBe("error");
    expect(stdbClient.error).toBeInstanceOf(Error);
  });

  it("disconnect clears ws and state", () => {
    stdbClient.connect();
    wsInstances[0].fire("open");
    expect(stdbClient.getSnapshot()).toBe("connected");

    stdbClient.disconnect();
    expect(stdbClient.getSnapshot()).toBe("disconnected");
    expect(stdbClient.ws).toBeNull();
  });

  it("subscribe notifies on state changes", () => {
    const listener = vi.fn();
    const unsub = stdbClient.subscribe(listener);

    stdbClient.connect();
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    wsInstances[0].fire("open");
    expect(listener).toHaveBeenCalled();

    unsub();
    listener.mockClear();
    stdbClient.disconnect();
    expect(listener).not.toHaveBeenCalled();
  });

  it("recordEvent sends JSON when connected", () => {
    stdbClient.connect();
    wsInstances[0].fire("open");

    stdbClient.recordEvent("test_event", { foo: "bar" });
    expect(wsInstances[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: "event", event: "test_event", data: { foo: "bar" } }),
    );
  });

  it("recordEvent does nothing when disconnected", () => {
    stdbClient.recordEvent("test_event");
    expect(wsInstances).toHaveLength(0);
  });

  it("auto-reconnects with exponential backoff on close", () => {
    stdbClient.connect("tok");
    wsInstances[0].fire("open");

    // Simulate close
    wsInstances[0].fire("close");
    expect(stdbClient.getSnapshot()).toBe("disconnected");

    // First retry after 1s
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket).toHaveBeenCalledTimes(2);

    // Second close → retry after 2s
    wsInstances[1].fire("close");
    vi.advanceTimersByTime(1999);
    expect(MockWebSocket).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket).toHaveBeenCalledTimes(3);
  });

  it("disconnect cancels pending retry", () => {
    stdbClient.connect();
    wsInstances[0].fire("open");
    wsInstances[0].fire("close");

    stdbClient.disconnect();
    vi.advanceTimersByTime(60000);
    // Only the initial connect, no retry
    expect(MockWebSocket).toHaveBeenCalledTimes(1);
  });
});
