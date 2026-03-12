import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChat } from "@/ui/hooks/useChat";

// Mock apiUrl
vi.mock("@/core-logic/api", () => ({
  apiUrl: (path: string) => `/api${path}`,
}));

function makeSSEResponse(events: string[]) {
  const body = [...events.map((e) => `data: ${e}\n\n`), "data: [DONE]\n\n"].join("");
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("useChat", () => {
  function mockFetch(chatResponses: Response[] = []) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);

      if (url === "/api/settings/public") {
        return new Response(JSON.stringify({ context_window: 200000 }), { status: 200 });
      }

      if (url === "/api/chat/threads") {
        return new Response(JSON.stringify({ threads: [] }), { status: 200 });
      }

      if (url === "/api/chat") {
        const next = chatResponses.shift();
        if (!next) {
          throw new Error("Unexpected /api/chat call");
        }
        return next;
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });
  }

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("starts with empty items and no error", async () => {
    mockFetch();
    const { result } = renderHook(() => useChat());

    await vi.waitFor(() => {
      expect(result.current.items).toEqual([]);
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("loads public settings and thread list on mount", async () => {
    const fetchSpy = mockFetch();
    const { result } = renderHook(() => useChat());

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenNthCalledWith(1, "/api/settings/public");
      expect(fetchSpy).toHaveBeenNthCalledWith(2, "/api/chat/threads", { credentials: "include" });
    });

    expect(result.current.usage).toBeNull();
  });

  it("sends message and parses text_delta events", async () => {
    const fetchSpy = mockFetch([
      makeSSEResponse([
        JSON.stringify({ type: "text_delta", text: "Hello " }),
        JSON.stringify({ type: "text_delta", text: "world" }),
      ]),
    ]);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    const [url, opts] = fetchSpy.mock.calls.find(([calledUrl]) => calledUrl === "/api/chat") ?? [];
    expect(url).toBe("/api/chat");
    expect(opts?.credentials).toBe("include");

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]).toMatchObject({ kind: "user", content: "Hi" });
    expect(result.current.items[1]).toMatchObject({
      kind: "assistant_text",
      content: "Hello world",
    });
  });

  it("parses tool_call_start and tool_call_end events", async () => {
    mockFetch([
      makeSSEResponse([
        JSON.stringify({
          type: "tool_call_start",
          toolCallId: "call-1",
          name: "search_tools",
          args: { q: "test" },
          transport: "mcp",
        }),
        JSON.stringify({
          type: "tool_call_end",
          toolCallId: "call-1",
          result: "Found 3 results",
          status: "done",
          transport: "mcp",
        }),
      ]),
    ]);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Search");
    });

    expect(result.current.items[1]).toMatchObject({
      kind: "tool_call",
      toolCallId: "call-1",
      name: "search_tools",
      status: "done",
      result: "Found 3 results",
    });
  });

  it("parses browser transport tool-call events", async () => {
    mockFetch([
      makeSSEResponse([
        JSON.stringify({
          type: "tool_call_start",
          toolCallId: "req-123",
          name: "browser_navigate",
          args: { url: "/tools" },
          transport: "browser",
        }),
      ]),
    ]);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Go to tools");
    });

    expect(result.current.items[1]).toMatchObject({
      kind: "tool_call",
      toolCallId: "req-123",
      name: "browser_navigate",
      status: "pending",
      transport: "browser",
    });
  });

  it("sets error on error event", async () => {
    mockFetch([
      makeSSEResponse([JSON.stringify({ type: "error", error: "Rate limited" })]),
    ]);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.error).toBe("Rate limited");
  });

  it("sets error on HTTP failure", async () => {
    mockFetch([new Response("Unauthorized", { status: 401 })]);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.error).toBe("Unauthorized");
    expect(result.current.items[1]).toMatchObject({
      kind: "assistant_text",
      content: "Sorry, something went wrong. Please try again.",
    });
  });

  it("newThread clears current items and selection", async () => {
    mockFetch([
      makeSSEResponse([JSON.stringify({ type: "text_delta", text: "Hi" })]),
    ]);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(result.current.items).toHaveLength(2);

    act(() => {
      result.current.newThread();
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.currentThreadId).toBeNull();
  });

  it("clearError clears the error state", async () => {
    mockFetch([
      makeSSEResponse([JSON.stringify({ type: "error", error: "Oops" })]),
    ]);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.error).toBe("Oops");

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it("does not send empty or whitespace-only messages", async () => {
    const fetchSpy = mockFetch();

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("");
      await result.current.sendMessage("   ");
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("skips malformed SSE data gracefully", async () => {
    mockFetch([
      makeSSEResponse(["not-json", JSON.stringify({ type: "text_delta", text: "Valid" })]),
    ]);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.items[1]).toMatchObject({ kind: "assistant_text", content: "Valid" });
    expect(result.current.error).toBeNull();
  });
});
