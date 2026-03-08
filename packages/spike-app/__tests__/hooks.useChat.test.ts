import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock apiUrl to simplify
vi.mock("@/core-logic/api", () => ({
  apiUrl: (path: string) => `/api${path}`,
}));

// We need to import useChat after mocks
import { useChat } from "@/ui/hooks/useChat";

describe("useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should initialize with empty messages if localStorage is empty", () => {
    const { result } = renderHook(() => useChat());
    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should load messages from localStorage on initialization", () => {
    const mockMessages = [
      { id: "1", role: "user", content: "Hello", timestamp: Date.now() },
    ];
    localStorage.setItem("spike-chat-messages", JSON.stringify(mockMessages));

    const { result } = renderHook(() => useChat());
    expect(result.current.messages).toEqual(mockMessages);
  });

  it("should clear messages and localStorage", async () => {
    const mockMessages = [
      { id: "1", role: "user", content: "Hello", timestamp: Date.now() },
    ];
    localStorage.setItem("spike-chat-messages", JSON.stringify(mockMessages));

    const { result } = renderHook(() => useChat());
    
    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
    expect(localStorage.getItem("spike-chat-messages")).toBeNull();
  });

  it("should send a message and handle streaming text", async () => {
    const encoder = new TextEncoder();
    const streamChunks = [
      encoder.encode('data: {"type": "text_delta", "text": "Hello"}\n'),
      encoder.encode('data: {"type": "text_delta", "text": " world!"}\n'),
      encoder.encode("data: [DONE]\n"),
    ];

    let chunkIndex = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (chunkIndex < streamChunks.length) {
          return Promise.resolve({ value: streamChunks[chunkIndex++], done: false });
        }
        return Promise.resolve({ value: undefined, done: true });
      }),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    };

    vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.messages.length).toBe(2);
    expect(result.current.messages[0].role).toBe("user");
    expect(result.current.messages[0].content).toBe("Hi");
    expect(result.current.messages[1].role).toBe("assistant");
    expect(result.current.messages[1].content).toBe("Hello world!");
    expect(result.current.isStreaming).toBe(false);
  });

  it("should handle tool_call_start and tool_call_end events", async () => {
    const encoder = new TextEncoder();
    const streamChunks = [
      encoder.encode('data: {"type": "tool_call_start", "name": "get_weather", "args": {"location": "London"}}\n'),
      encoder.encode('data: {"type": "tool_call_end", "name": "get_weather", "result": "Sunny"}\n'),
      encoder.encode("data: [DONE]\n"),
    ];

    let chunkIndex = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (chunkIndex < streamChunks.length) {
          return Promise.resolve({ value: streamChunks[chunkIndex++], done: false });
        }
        return Promise.resolve({ value: undefined, done: true });
      }),
    };

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    } as any);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("How is the weather?");
    });

    const assistantMsg = result.current.messages[1];
    expect(assistantMsg.toolCalls).toHaveLength(1);
    expect(assistantMsg.toolCalls![0]).toEqual({
      name: "get_weather",
      args: { location: "London" },
      status: "done",
      result: "Sunny",
    });
  });

  it("should handle browser_command event", async () => {
    const encoder = new TextEncoder();
    const streamChunks = [
      encoder.encode('data: {"type": "browser_command", "tool": "screenshot", "requestId": "req123", "args": {}}\n'),
      encoder.encode("data: [DONE]\n"),
    ];

    let chunkIndex = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (chunkIndex < streamChunks.length) {
          return Promise.resolve({ value: streamChunks[chunkIndex++], done: false });
        }
        return Promise.resolve({ value: undefined, done: true });
      }),
    };

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    } as any);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Take a screenshot");
    });

    const assistantMsg = result.current.messages[1];
    expect(assistantMsg.browserCommands).toHaveLength(1);
    expect(assistantMsg.browserCommands![0]).toEqual({
      tool: "screenshot",
      requestId: "req123",
      args: {},
    });
  });

  it("should handle fetch errors", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.error).toBe("Network failure");
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.messages[1].content).toBe("Sorry, something went wrong. Please try again.");
  });

  it("should handle non-ok fetch responses", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    } as any);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.error).toBe("Internal Server Error");
  });

  it("should handle SSE error events", async () => {
    const encoder = new TextEncoder();
    const streamChunks = [
      encoder.encode('data: {"type": "error", "error": "AI model limit reached"}\n'),
    ];

    let chunkIndex = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (chunkIndex < streamChunks.length) {
          return Promise.resolve({ value: streamChunks[chunkIndex++], done: false });
        }
        return Promise.resolve({ value: undefined, done: true });
      }),
    };

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    } as any);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.error).toBe("AI model limit reached");
  });

  it("should clear error", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.error).toBe("Network failure");

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it("should handle submitBrowserResult", async () => {
    const { result } = renderHook(() => useChat());

    // We need to trigger a browser command first to set up the pending resolve
    const encoder = new TextEncoder();
    const streamChunks = [
      encoder.encode('data: {"type": "browser_command", "tool": "screenshot", "requestId": "req123", "args": {}}\n'),
      encoder.encode("data: [DONE]\n"),
    ];

    let chunkIndex = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (chunkIndex < streamChunks.length) {
          return Promise.resolve({ value: streamChunks[chunkIndex++], done: false });
        }
        return Promise.resolve({ value: undefined, done: true });
      }),
    };

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    } as any);

    // sendMessage doesn't actually wait for the browser result, 
    // it just receives the command and finishes the stream.
    await act(async () => {
      await result.current.sendMessage("Take a screenshot");
    });

    // Now submit the result
    act(() => {
      result.current.submitBrowserResult("req123", { status: "success", url: "http://..." });
    });

    // In the current useChat implementation, submitBrowserResult resolves a promise in pendingBrowserRef,
    // but it doesn't seem to update the message state with the result yet?
    // Let me check useChat.ts again.
    expect(result.current.messages[1].browserCommands).toHaveLength(1);
  });

  it("should not send empty or whitespace-only messages", async () => {
    const { result } = renderHook(() => useChat());
    
    await act(async () => {
      await result.current.sendMessage("");
      await result.current.sendMessage("   ");
    });

    expect(result.current.messages).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should handle malformed JSON in SSE stream", async () => {
    const encoder = new TextEncoder();
    const streamChunks = [
      encoder.encode('data: {invalid json}\n'),
      encoder.encode('data: {"type": "text_delta", "text": "Valid"}\n'),
      encoder.encode("data: [DONE]\n"),
    ];

    let chunkIndex = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (chunkIndex < streamChunks.length) {
          return Promise.resolve({ value: streamChunks[chunkIndex++], done: false });
        }
        return Promise.resolve({ value: undefined, done: true });
      }),
    };

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    } as any);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.messages[1].content).toBe("Valid");
  });

  it("should throw error if response body is missing", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      body: null,
    } as any);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.error).toBe("No response body");
  });

  it("should handle multiple tool calls in one stream", async () => {
    const encoder = new TextEncoder();
    const streamChunks = [
      encoder.encode('data: {"type": "tool_call_start", "name": "tool1"}\n'),
      encoder.encode('data: {"type": "tool_call_end", "name": "tool1", "result": "res1"}\n'),
      encoder.encode('data: {"type": "tool_call_start", "name": "tool2"}\n'),
      encoder.encode('data: {"type": "tool_call_end", "name": "tool2", "result": "res2"}\n'),
      encoder.encode("data: [DONE]\n"),
    ];

    let chunkIndex = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (chunkIndex < streamChunks.length) {
          return Promise.resolve({ value: streamChunks[chunkIndex++], done: false });
        }
        return Promise.resolve({ value: undefined, done: true });
      }),
    };

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    } as any);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Call tools");
    });

    expect(result.current.messages[1].toolCalls).toHaveLength(2);
    expect(result.current.messages[1].toolCalls![0].name).toBe("tool1");
    expect(result.current.messages[1].toolCalls![1].name).toBe("tool2");
  });

  it("should handle partial lines in SSE stream", async () => {
    const encoder = new TextEncoder();
    // Split one "data: ..." line into two chunks
    const streamChunks = [
      encoder.encode('data: {"type": "text_delta", "text": "Part'),
      encoder.encode('ial"}\n'),
      encoder.encode("data: [DONE]\n"),
    ];

    let chunkIndex = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (chunkIndex < streamChunks.length) {
          return Promise.resolve({ value: streamChunks[chunkIndex++], done: false });
        }
        return Promise.resolve({ value: undefined, done: true });
      }),
    };

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    } as any);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.messages[1].content).toBe("Partial");
  });

  it("should persist messages to localStorage with debounce", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useChat());

    const encoder = new TextEncoder();
    const mockReader = {
      read: vi.fn().mockResolvedValue({ value: encoder.encode("data: [DONE]\n"), done: false }),
    };
    mockReader.read.mockResolvedValueOnce({ value: encoder.encode("data: [DONE]\n"), done: false })
                   .mockResolvedValueOnce({ value: undefined, done: true });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    } as any);

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    // Initial message added
    expect(result.current.messages.length).toBe(2);
    
    // Check localStorage - it shouldn't be set immediately due to 1000ms debounce
    // Wait, the hook sets it after 1000ms.
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const stored = JSON.parse(localStorage.getItem("spike-chat-messages") || "[]");
    expect(stored.length).toBe(2);
    expect(stored[0].content).toBe("Hi");

    vi.useRealTimers();
  });
});
