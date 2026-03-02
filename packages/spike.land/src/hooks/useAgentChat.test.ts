import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAgentChat } from "./useAgentChat";
import { encodeSSE } from "@/lib/chat/agent-sse-protocol";

function createMockSSEResponse(events: Parameters<typeof encodeSSE>[0][]) {
  const body = events.map(encodeSSE).join("");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("useAgentChat", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("initializes with empty state", () => {
    const { result } = renderHook(() => useAgentChat("session-1"));
    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sends a message and processes text_delta events", async () => {
    fetchSpy.mockResolvedValueOnce(
      createMockSSEResponse([
        { type: "turn_start", turn: 1, maxTurns: 10 },
        { type: "text_delta", text: "Hello " },
        { type: "text_delta", text: "world" },
        { type: "turn_end" },
        { type: "done" },
      ]),
    );

    const { result } = renderHook(() => useAgentChat("session-1"));

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    // Should have user message + assistant message
    expect(result.current.messages).toHaveLength(2);
    const [msg0, msg1] = result.current.messages;
    expect(msg0?.role).toBe("user");
    expect(msg1?.role).toBe("assistant");

    // Assistant should have text content
    const assistantBlocks = msg1?.blocks ?? [];
    expect(assistantBlocks).toHaveLength(1);
    expect(assistantBlocks?.[0]).toEqual({
      type: "text",
      content: "Hello world",
    });
  });

  it("handles tool call events", async () => {
    fetchSpy.mockResolvedValueOnce(
      createMockSSEResponse([
        { type: "turn_start", turn: 1, maxTurns: 10 },
        {
          type: "tool_call_start",
          id: "tc-1",
          name: "github__search",
          serverName: "github",
          input: { query: "bugs" },
        },
        {
          type: "tool_call_end",
          id: "tc-1",
          result: "Found 3 issues",
          isError: false,
        },
        { type: "text_delta", text: "I found 3 issues." },
        { type: "turn_end" },
        { type: "done" },
      ]),
    );

    const { result } = renderHook(() => useAgentChat("session-2"));

    await act(async () => {
      await result.current.sendMessage("find bugs");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    const [, assistantMsg] = result.current.messages;
    const blocks = assistantMsg?.blocks ?? [];
    // Should have tool_call block and text block
    expect(blocks?.length).toBeGreaterThanOrEqual(2);

    const toolBlock = blocks?.find((b) => b.type === "tool_call");
    expect(toolBlock).toBeDefined();
    if (toolBlock && toolBlock.type === "tool_call") {
      expect(toolBlock.name).toBe("github__search");
      expect(toolBlock.status).toBe("done");
      expect(toolBlock.result).toBe("Found 3 issues");
    }
  });

  it("handles error events", async () => {
    fetchSpy.mockResolvedValueOnce(
      createMockSSEResponse([{ type: "error", message: "Rate limited" }]),
    );

    const { result } = renderHook(() => useAgentChat("session-3"));

    await act(async () => {
      await result.current.sendMessage("test");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.error).toBe("Rate limited");
  });

  it("handles HTTP errors", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
      }),
    );

    const { result } = renderHook(() => useAgentChat("session-4"));

    await act(async () => {
      await result.current.sendMessage("test");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.error).toBe("Too many requests");
  });

  it("clears messages", async () => {
    fetchSpy.mockResolvedValueOnce(
      createMockSSEResponse([{ type: "text_delta", text: "response" }, { type: "done" }]),
    );

    const { result } = renderHook(() => useAgentChat("session-5"));

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });
});
