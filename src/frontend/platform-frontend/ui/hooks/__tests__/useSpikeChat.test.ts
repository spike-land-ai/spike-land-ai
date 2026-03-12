import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSpikeChat, type ChatMessage, type AppUpdatedEvent } from "../useSpikeChat";

// ---------------------------------------------------------------------------
// Mock API module
// ---------------------------------------------------------------------------

vi.mock("../../core-logic/api", () => ({
  CHAT_ENABLED: true,
  chatUrl: (path: string) => `https://chat.spike.land${path}`,
  chatWsUrl: (path: string) => `wss://chat.spike.land${path}`,
}));

// ---------------------------------------------------------------------------
// WebSocket mock
// ---------------------------------------------------------------------------

type WsMockInstance = {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  _triggerOpen: () => void;
  _triggerMessage: (data: unknown) => void;
  _triggerClose: () => void;
  _triggerError: () => void;
};

let wsMockInstance: WsMockInstance | null = null;

const WsMock = vi.fn().mockImplementation(() => {
  const instance: WsMockInstance = {
    readyState: WebSocket.CONNECTING,
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    send: vi.fn(),
    close: vi.fn().mockImplementation(() => {
      instance.readyState = WebSocket.CLOSED;
      instance.onclose?.();
    }),
    _triggerOpen: () => {
      instance.readyState = WebSocket.OPEN;
      instance.onopen?.();
    },
    _triggerMessage: (data: unknown) => {
      instance.onmessage?.({ data: JSON.stringify(data) });
    },
    _triggerClose: () => {
      instance.readyState = WebSocket.CLOSED;
      instance.onclose?.();
    },
    _triggerError: () => {
      instance.onerror?.();
    },
  };
  wsMockInstance = instance;
  return instance;
});

// Replace global WebSocket with mock
Object.defineProperty(globalThis, "WebSocket", {
  value: WsMock,
  writable: true,
});

// ---------------------------------------------------------------------------
// fetch mock
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
Object.defineProperty(globalThis, "fetch", { value: mockFetch, writable: true });

const sampleMessages: ChatMessage[] = [
  {
    id: "msg-1",
    channelId: "ch-1",
    userId: "user-a",
    content: "Hello",
    contentType: "text",
    threadId: null,
    createdAt: 1_700_000_000_000,
  },
];

describe("useSpikeChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    wsMockInstance = null;
    // Default fetch returns empty message list
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with isLoading=true, isConnected=false, empty messages", () => {
    const { result } = renderHook(() => useSpikeChat({ channelId: "ch-1" }));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.messages).toEqual([]);
    expect(result.current.typingUsers).toEqual([]);
  });

  it("fetches message history on mount", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleMessages),
    });

    const { result } = renderHook(() => useSpikeChat({ channelId: "ch-1" }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.messages).toEqual(sampleMessages);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("channelId=ch-1"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("sets isLoading=false even on failed fetch", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useSpikeChat({ channelId: "ch-1" }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.messages).toEqual([]);
  });

  it("sets isLoading=false when fetch returns non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve([]) });
    const { result } = renderHook(() => useSpikeChat({ channelId: "ch-1" }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("opens a WebSocket connection on mount", () => {
    renderHook(() => useSpikeChat({ channelId: "ch-1" }));
    expect(WsMock).toHaveBeenCalledWith(expect.stringContaining("ch-1"));
  });

  it("sets isConnected=true when WebSocket opens", async () => {
    const { result } = renderHook(() => useSpikeChat({ channelId: "ch-1" }));

    act(() => {
      wsMockInstance!._triggerOpen();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it("sets isConnected=false when WebSocket closes", async () => {
    const { result } = renderHook(() => useSpikeChat({ channelId: "ch-1" }));

    act(() => {
      wsMockInstance!._triggerOpen();
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      // Prevent reconnect timer from firing
      wsMockInstance!.close.mockImplementation(() => {
        wsMockInstance!.readyState = WebSocket.CLOSED;
        wsMockInstance!.onclose?.();
      });
      wsMockInstance!._triggerClose();
    });

    expect(result.current.isConnected).toBe(false);
  });

  it("appends new message on 'message_new' WebSocket event", async () => {
    const { result } = renderHook(() => useSpikeChat({ channelId: "ch-1" }));

    act(() => {
      wsMockInstance!._triggerOpen();
    });

    act(() => {
      wsMockInstance!._triggerMessage({
        type: "message_new",
        message: sampleMessages[0],
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe("msg-1");
  });

  it("removes message on 'message_deleted' WebSocket event", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleMessages),
    });

    const { result } = renderHook(() => useSpikeChat({ channelId: "ch-1" }));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    act(() => {
      wsMockInstance!._triggerOpen();
      wsMockInstance!._triggerMessage({ type: "message_deleted", id: "msg-1" });
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it("updates typingUsers on 'typing' WebSocket event", () => {
    const { result } = renderHook(() => useSpikeChat({ channelId: "ch-1" }));

    act(() => {
      wsMockInstance!._triggerOpen();
      wsMockInstance!._triggerMessage({ type: "typing", users: ["alice", "bob"] });
    });

    expect(result.current.typingUsers).toEqual(["alice", "bob"]);
  });

  it("calls onAppUpdated callback on 'app_updated' WebSocket event", () => {
    const onAppUpdated = vi.fn();
    renderHook(() => useSpikeChat({ channelId: "ch-1", onAppUpdated }));

    const event: AppUpdatedEvent = {
      type: "app_updated",
      appSlug: "my-app",
      version: "1.2.3",
      messageId: "msg-upd",
    };

    act(() => {
      wsMockInstance!._triggerOpen();
      wsMockInstance!._triggerMessage(event);
    });

    expect(onAppUpdated).toHaveBeenCalledWith(event);
  });

  it("ignores malformed JSON WebSocket messages without throwing", () => {
    const { result } = renderHook(() => useSpikeChat({ channelId: "ch-1" }));

    act(() => {
      wsMockInstance!._triggerOpen();
      wsMockInstance!.onmessage?.({ data: "not-valid-json{{" });
    });

    expect(result.current.messages).toEqual([]);
  });

  it("sendMessage posts to the chat API", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // history
      .mockResolvedValueOnce({ ok: true }); // send

    const { result } = renderHook(() => useSpikeChat({ channelId: "ch-1" }));

    await act(async () => {
      await result.current.sendMessage("Hello world");
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/messages"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Hello world"),
      }),
    );
  });

  it("sendMessage includes channelId in request body", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useSpikeChat({ channelId: "ch-abc" }));

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const body = JSON.parse(lastCall[1].body);
    expect(body.channelId).toBe("ch-abc");
    expect(body.content).toBe("Hi");
  });

  it("startTyping sends typing_start message when WebSocket is open", () => {
    const { result } = renderHook(() => useSpikeChat({ channelId: "ch-1" }));

    act(() => {
      wsMockInstance!._triggerOpen();
      result.current.startTyping();
    });

    expect(wsMockInstance!.send).toHaveBeenCalledWith(JSON.stringify({ type: "typing_start" }));
  });

  it("stopTyping sends typing_stop message when WebSocket is open", () => {
    const { result } = renderHook(() => useSpikeChat({ channelId: "ch-1" }));

    act(() => {
      wsMockInstance!._triggerOpen();
      result.current.stopTyping();
    });

    expect(wsMockInstance!.send).toHaveBeenCalledWith(JSON.stringify({ type: "typing_stop" }));
  });

  it("startTyping does not send when WebSocket is not open", () => {
    const { result } = renderHook(() => useSpikeChat({ channelId: "ch-1" }));
    // WebSocket is in CONNECTING state, not OPEN
    result.current.startTyping();
    expect(wsMockInstance!.send).not.toHaveBeenCalled();
  });

  it("closes WebSocket on unmount", () => {
    const { unmount } = renderHook(() => useSpikeChat({ channelId: "ch-1" }));
    const ws = wsMockInstance!;
    unmount();
    expect(ws.close).toHaveBeenCalled();
  });

  it("does not fetch or connect when enabled=false", () => {
    renderHook(() => useSpikeChat({ channelId: "ch-1", enabled: false }));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(WsMock).not.toHaveBeenCalled();
  });

  it("sets isLoading=false immediately when enabled=false", () => {
    const { result } = renderHook(() => useSpikeChat({ channelId: "ch-1", enabled: false }));
    expect(result.current.isLoading).toBe(false);
  });

  it("schedules reconnect with exponential backoff on WebSocket close", async () => {
    renderHook(() => useSpikeChat({ channelId: "ch-1" }));
    const firstWs = wsMockInstance!;

    // Prevent the mock close from triggering onclose automatically so we can control it
    act(() => {
      firstWs._triggerOpen();
      firstWs.close.mockImplementation(() => {
        firstWs.readyState = WebSocket.CLOSED;
      });
      firstWs._triggerClose();
    });

    // After close, a reconnect timer should be scheduled (1s for first attempt)
    const callCountBefore = WsMock.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(WsMock.mock.calls.length).toBeGreaterThan(callCountBefore);
  });
});
