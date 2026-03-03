import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const mockGetToken = vi.hoisted(() => vi.fn());
vi.mock("../token-manager", () => ({
  tokenManager: { getToken: mockGetToken },
}));

// Mock EventSource
type EventSourceListener = (event: { data: string; }) => void;
type ErrorListener = (event: Event) => void;

class MockEventSource {
  url: string;
  onmessage: EventSourceListener | null = null;
  onerror: ErrorListener | null = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    // Store reference so tests can interact with it
    MockEventSource.lastInstance = this;
  }

  static lastInstance: MockEventSource | null = null;
  static reset() {
    MockEventSource.lastInstance = null;
  }
}

import { useMcpStream } from "./use-mcp-stream";

describe("useMcpStream", () => {
  beforeEach(() => {
    mockGetToken.mockReset();
    MockEventSource.reset();
    vi.stubGlobal("EventSource", MockEventSource);

    // Mock window.location.origin
    Object.defineProperty(window, "location", {
      value: { origin: "http://localhost:3000" },
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("initial state", () => {
    it("should return initial idle state", () => {
      const { result } = renderHook(() => useMcpStream("test_stream"));

      expect(result.current.chunks).toEqual([]);
      expect(result.current.fullText).toBe("");
      expect(result.current.isDone).toBe(false);
      expect(result.current.error).toBeUndefined();
      expect(typeof result.current.start).toBe("function");
      expect(typeof result.current.stop).toBe("function");
    });
  });

  describe("start - unauthorized", () => {
    it("should set error when no token available", async () => {
      mockGetToken.mockResolvedValue(null);

      const { result } = renderHook(() => useMcpStream("test_stream"));

      await act(async () => {
        await result.current.start();
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("Unauthorized");
    });

    it("should call onError when no token available", async () => {
      mockGetToken.mockResolvedValue(null);
      const onError = vi.fn();

      const { result } = renderHook(() => useMcpStream("test_stream", { onError }));

      await act(async () => {
        await result.current.start();
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Unauthorized" }),
      );
    });
  });

  describe("start - EventSource creation", () => {
    it("should create EventSource with correct URL params", async () => {
      mockGetToken.mockResolvedValue("test-token-123");

      const { result } = renderHook(() => useMcpStream("my_tool"));

      await act(async () => {
        result.current.start({ query: "hello" });
      });

      const es = MockEventSource.lastInstance!;
      expect(es).toBeDefined();

      const url = new URL(es.url);
      expect(url.pathname).toBe("/api/mcp");
      expect(url.searchParams.get("method")).toBe("tools/call");
      expect(url.searchParams.get("name")).toBe("my_tool");
      expect(url.searchParams.get("arguments")).toBe(
        JSON.stringify({ query: "hello" }),
      );
      expect(url.searchParams.get("token")).toBe("test-token-123");
      expect(url.searchParams.get("stream")).toBe("true");
    });

    it("should use empty object as default args", async () => {
      mockGetToken.mockResolvedValue("token");

      const { result } = renderHook(() => useMcpStream("tool"));

      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;
      const url = new URL(es.url);
      expect(url.searchParams.get("arguments")).toBe(JSON.stringify({}));
    });

    it("should reset state before starting", async () => {
      mockGetToken.mockResolvedValue("token");

      const { result } = renderHook(() => useMcpStream("tool"));

      // First start + receive data
      await act(async () => {
        result.current.start();
      });

      const es1 = MockEventSource.lastInstance!;
      act(() => {
        es1.onmessage!({
          data: JSON.stringify({
            result: { content: [{ type: "text", text: "chunk1" }] },
          }),
        });
      });

      expect(result.current.chunks.length).toBe(1);

      // Second start - should reset
      await act(async () => {
        result.current.start();
      });

      expect(result.current.chunks).toEqual([]);
      expect(result.current.fullText).toBe("");
      expect(result.current.isDone).toBe(false);
      expect(result.current.error).toBeUndefined();
    });

    it("should return a cleanup function", async () => {
      mockGetToken.mockResolvedValue("token");

      const { result } = renderHook(() => useMcpStream("tool"));

      let cleanup: (() => void) | undefined;
      await act(async () => {
        cleanup = (await result.current.start()) as unknown as
          | (() => void)
          | undefined;
      });

      const es = MockEventSource.lastInstance!;
      expect(typeof cleanup).toBe("function");

      act(() => {
        cleanup!();
      });

      expect(es.close).toHaveBeenCalled();
    });
  });

  describe("onmessage - receiving chunks", () => {
    it("should accumulate text chunks", async () => {
      mockGetToken.mockResolvedValue("token");

      const { result } = renderHook(() => useMcpStream("tool"));

      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;

      act(() => {
        es.onmessage!({
          data: JSON.stringify({
            result: { content: [{ type: "text", text: "Hello " }] },
          }),
        });
      });

      expect(result.current.chunks).toEqual(["Hello "]);
      expect(result.current.fullText).toBe("Hello ");

      act(() => {
        es.onmessage!({
          data: JSON.stringify({
            result: { content: [{ type: "text", text: "World" }] },
          }),
        });
      });

      expect(result.current.chunks).toEqual(["Hello ", "World"]);
      expect(result.current.fullText).toBe("Hello World");
    });

    it("should call onChunk callback for each chunk", async () => {
      mockGetToken.mockResolvedValue("token");
      const onChunk = vi.fn();

      const { result } = renderHook(() => useMcpStream("tool", { onChunk }));

      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;

      act(() => {
        es.onmessage!({
          data: JSON.stringify({
            result: { content: [{ type: "text", text: "chunk1" }] },
          }),
        });
      });

      expect(onChunk).toHaveBeenCalledWith("chunk1");
    });

    it("should filter non-text content types", async () => {
      mockGetToken.mockResolvedValue("token");

      const { result } = renderHook(() => useMcpStream("tool"));

      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;

      act(() => {
        es.onmessage!({
          data: JSON.stringify({
            result: {
              content: [
                { type: "image", url: "http://example.com/img.png" },
                { type: "text", text: "visible" },
              ],
            },
          }),
        });
      });

      expect(result.current.chunks).toEqual(["visible"]);
    });

    it("should handle empty text content", async () => {
      mockGetToken.mockResolvedValue("token");
      const onChunk = vi.fn();

      const { result } = renderHook(() => useMcpStream("tool", { onChunk }));

      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;

      act(() => {
        es.onmessage!({
          data: JSON.stringify({
            result: { content: [{ type: "text", text: "" }] },
          }),
        });
      });

      // Empty text should not be added
      expect(result.current.chunks).toEqual([]);
      expect(onChunk).not.toHaveBeenCalled();
    });

    it("should handle messages without result.content", async () => {
      mockGetToken.mockResolvedValue("token");

      const { result } = renderHook(() => useMcpStream("tool"));

      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;

      act(() => {
        es.onmessage!({
          data: JSON.stringify({ someOtherField: true }),
        });
      });

      expect(result.current.chunks).toEqual([]);
    });

    it("should join multiple text content items in a single message", async () => {
      mockGetToken.mockResolvedValue("token");

      const { result } = renderHook(() => useMcpStream("tool"));

      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;

      act(() => {
        es.onmessage!({
          data: JSON.stringify({
            result: {
              content: [
                { type: "text", text: "part1" },
                { type: "text", text: "part2" },
              ],
            },
          }),
        });
      });

      expect(result.current.chunks).toEqual(["part1part2"]);
      expect(result.current.fullText).toBe("part1part2");
    });
  });

  describe("onmessage - isDone", () => {
    it("should close EventSource and set isDone on isDone message", async () => {
      mockGetToken.mockResolvedValue("token");

      const { result } = renderHook(() => useMcpStream("tool"));

      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;

      act(() => {
        es.onmessage!({
          data: JSON.stringify({
            result: { content: [{ type: "text", text: "final" }] },
          }),
        });
      });

      act(() => {
        es.onmessage!({
          data: JSON.stringify({ isDone: true }),
        });
      });

      expect(result.current.isDone).toBe(true);
      expect(es.close).toHaveBeenCalled();
    });

    it("should call onDone callback with full text", async () => {
      mockGetToken.mockResolvedValue("token");
      const onDone = vi.fn();

      const { result } = renderHook(() => useMcpStream("tool", { onDone }));

      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;

      act(() => {
        es.onmessage!({
          data: JSON.stringify({
            result: { content: [{ type: "text", text: "Hello " }] },
          }),
        });
      });

      act(() => {
        es.onmessage!({
          data: JSON.stringify({
            result: { content: [{ type: "text", text: "World" }] },
          }),
        });
      });

      act(() => {
        es.onmessage!({
          data: JSON.stringify({ isDone: true }),
        });
      });

      expect(onDone).toHaveBeenCalledWith("Hello World");
    });
  });

  describe("onmessage - JSON parse error", () => {
    it("should handle invalid JSON gracefully", async () => {
      mockGetToken.mockResolvedValue("token");
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useMcpStream("tool"));

      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;

      act(() => {
        es.onmessage!({ data: "not valid json{{{" });
      });

      // Should not crash, just log an error
      expect(result.current.chunks).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error parsing SSE message:",
        expect.any(SyntaxError),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("onerror", () => {
    it("should set error on EventSource error", async () => {
      mockGetToken.mockResolvedValue("token");
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useMcpStream("tool"));

      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;

      act(() => {
        es.onerror!(new Event("error"));
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("Stream connection failed");
      expect(es.close).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should call onError callback on EventSource error", async () => {
      mockGetToken.mockResolvedValue("token");
      const onError = vi.fn();
      vi.spyOn(console, "error").mockImplementation(() => {});

      const { result } = renderHook(() => useMcpStream("tool", { onError }));

      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;

      act(() => {
        es.onerror!(new Event("error"));
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Stream connection failed" }),
      );

      vi.restoreAllMocks();
    });
  });

  describe("stop", () => {
    it("should close EventSource and set isDone", async () => {
      mockGetToken.mockResolvedValue("token");

      const { result } = renderHook(() => useMcpStream("tool"));

      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;

      act(() => {
        result.current.stop();
      });

      expect(es.close).toHaveBeenCalled();
      expect(result.current.isDone).toBe(true);
    });

    it("should do nothing if no EventSource exists", () => {
      const { result } = renderHook(() => useMcpStream("tool"));

      // Should not throw
      act(() => {
        result.current.stop();
      });

      expect(result.current.isDone).toBe(false);
    });
  });

  describe("options ref stability", () => {
    it("should use the latest callbacks without re-creating start", async () => {
      mockGetToken.mockResolvedValue("token");
      const onDone1 = vi.fn();
      const onDone2 = vi.fn();

      const { result, rerender } = renderHook(
        ({ onDone }) => useMcpStream("tool", { onDone }),
        { initialProps: { onDone: onDone1 } },
      );

      const startRef = result.current.start;
      rerender({ onDone: onDone2 });

      // start reference should be stable
      expect(result.current.start).toBe(startRef);

      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;

      act(() => {
        es.onmessage!({
          data: JSON.stringify({ isDone: true }),
        });
      });

      expect(onDone1).not.toHaveBeenCalled();
      expect(onDone2).toHaveBeenCalled();
    });
  });

  describe("default options", () => {
    it("should work without options argument", async () => {
      mockGetToken.mockResolvedValue("token");

      const { result } = renderHook(() => useMcpStream("tool"));

      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;

      act(() => {
        es.onmessage!({
          data: JSON.stringify({
            result: { content: [{ type: "text", text: "data" }] },
          }),
        });
      });

      expect(result.current.chunks).toEqual(["data"]);
    });
  });

  describe("edge cases", () => {
    it("should handle error with specific McpErrorCode", async () => {
      mockGetToken.mockResolvedValue("token");
      const onError = vi.fn();
      vi.spyOn(console, "error").mockImplementation(() => {});

      const { result } = renderHook(() => useMcpStream("tool", { onError }));
      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;
      act(() => {
        // Construct an event that might look like it has a code
        const errorEvent = new Event("error") as any;
        errorEvent.data = "RATE_LIMITED";
        es.onerror!(errorEvent);
      });

      expect(onError).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it("should ignore content items without text property", async () => {
      mockGetToken.mockResolvedValue("token");
      const { result } = renderHook(() => useMcpStream("tool"));
      await act(async () => {
        result.current.start();
      });

      const es = MockEventSource.lastInstance!;
      act(() => {
        es.onmessage!({
          data: JSON.stringify({
            result: { content: [{ type: "text" /* no text */ }] },
          }),
        });
      });

      expect(result.current.chunks).toEqual([]);
    });
  });
});
