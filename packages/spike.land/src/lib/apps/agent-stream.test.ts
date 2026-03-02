import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseAgentStreamLine, streamAgentResponse } from "./agent-stream";
import type { AgentStreamEvent } from "./agent-stream";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("parseAgentStreamLine", () => {
  it("parses a chunk event", () => {
    const result = parseAgentStreamLine('data: {"type":"chunk","content":"Hello"}');
    expect(result).toEqual({ type: "chunk", content: "Hello" });
  });

  it("parses a stage event", () => {
    const result = parseAgentStreamLine('data: {"type":"stage","stage":"processing"}');
    expect(result).toEqual({ type: "stage", stage: "processing" });
  });

  it("parses a stage event with tool", () => {
    const result = parseAgentStreamLine(
      'data: {"type":"stage","stage":"tool_use","tool":"code_edit"}',
    );
    expect(result).toEqual({
      type: "stage",
      stage: "tool_use",
      tool: "code_edit",
    });
  });

  it("parses a status event", () => {
    const result = parseAgentStreamLine('data: {"type":"status","content":"queued"}');
    expect(result).toEqual({ type: "status", content: "queued" });
  });

  it("parses an error event", () => {
    const result = parseAgentStreamLine('data: {"type":"error","content":"Something failed"}');
    expect(result).toEqual({ type: "error", content: "Something failed" });
  });

  it("returns null for non-data lines", () => {
    expect(parseAgentStreamLine("")).toBeNull();
    expect(parseAgentStreamLine("event: message")).toBeNull();
    expect(parseAgentStreamLine(": comment")).toBeNull();
  });

  it("returns null for malformed JSON after data:", () => {
    expect(parseAgentStreamLine("data: not-json")).toBeNull();
  });

  it("returns null for unknown event type", () => {
    expect(parseAgentStreamLine('data: {"type":"unknown","content":"x"}')).toBeNull();
  });
});

describe("streamAgentResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("yields events from a streaming response", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"type":"stage","stage":"initialize"}\n\n',
      'data: {"type":"chunk","content":"Hello "}\n\n',
      'data: {"type":"chunk","content":"world"}\n\n',
    ];

    let chunkIndex = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (chunkIndex < chunks.length) {
          controller.enqueue(encoder.encode(chunks[chunkIndex]!));
          chunkIndex++;
        } else {
          controller.close();
        }
      },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      body: stream,
    });

    const events: AgentStreamEvent[] = [];
    for await (const event of streamAgentResponse("app-1", "Hello")) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: "stage", stage: "initialize" });
    expect(events[1]).toEqual({ type: "chunk", content: "Hello " });
    expect(events[2]).toEqual({ type: "chunk", content: "world" });
  });

  it("throws when response is not ok", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const gen = streamAgentResponse("app-1", "test");
    await expect(gen.next()).rejects.toThrow("Failed to send message to agent");
  });

  it("throws when no body available", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: null,
    });

    const gen = streamAgentResponse("app-1", "test");
    await expect(gen.next()).rejects.toThrow("No reader available");
  });

  it("processes remaining buffer after stream ends", async () => {
    const encoder = new TextEncoder();
    // Send a chunk that doesn't end with \n, so it stays in buffer
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"chunk","content":"buffered"}'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({ ok: true, body: stream });

    const events: AgentStreamEvent[] = [];
    for await (const event of streamAgentResponse("app-1", "test")) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "chunk", content: "buffered" });
  });

  it("handles empty remaining buffer after stream ends", async () => {
    const encoder = new TextEncoder();
    // Send data that ends with \n so buffer is empty after processing
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"chunk","content":"done"}\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({ ok: true, body: stream });

    const events: AgentStreamEvent[] = [];
    for await (const event of streamAgentResponse("app-1", "test")) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "chunk", content: "done" });
  });

  it("passes image IDs and abort signal to fetch", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({ ok: true, body: stream });

    const controller = new AbortController();
    const gen = streamAgentResponse("app-1", "test", ["img-1", "img-2"], controller.signal);

    // Exhaust the generator
    const results = [];
    for await (const event of gen) {
      results.push(event);
    }

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/apps/app-1/agent/chat",
      expect.objectContaining({
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          content: "test",
          imageIds: ["img-1", "img-2"],
        }),
      }),
    );
  });
});
