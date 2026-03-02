import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock getGeminiClient before importing the module under test
const mockGenerateContentStream = vi.fn();

vi.mock("@/lib/ai/gemini-client", () => ({
  getGeminiClient: vi.fn().mockResolvedValue({
    models: {
      generateContentStream: (...args: unknown[]) => mockGenerateContentStream(...args),
    },
  }),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { createGeminiChatStream } from "./gemini-chat-stream";

/** Helper: collect all SSE events from a ReadableStream */
async function collectEvents(stream: ReadableStream): Promise<Array<Record<string, unknown>>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const events: Array<Record<string, unknown>> = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        events.push(JSON.parse(line.slice(6)) as Record<string, unknown>);
      }
    }
  }

  return events;
}

/** Create an async generator that yields Gemini-style chunks */
async function* makeChunks(texts: string[]): AsyncGenerator<{
  candidates: Array<{
    content: { parts: Array<{ text: string }> };
  }>;
}> {
  for (const text of texts) {
    yield {
      candidates: [{ content: { parts: [{ text }] } }],
    };
  }
}

describe("createGeminiChatStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("streams text chunks and emits done event", async () => {
    mockGenerateContentStream.mockResolvedValue(makeChunks(["Hello", " world", "!"]));

    const stream = createGeminiChatStream({
      question: "Hi",
      systemPrompt: "You are helpful.",
    });

    const events = await collectEvents(stream);

    expect(events).toHaveLength(4); // 3 text + 1 done
    expect(events[0]).toEqual({ type: "text", text: "Hello" });
    expect(events[1]).toEqual({ type: "text", text: " world" });
    expect(events[2]).toEqual({ type: "text", text: "!" });
    expect(events[3]).toEqual({
      type: "done",
      usage: { model: "gemini-3-flash-preview" },
    });
  });

  it("calls onComplete with the full concatenated answer", async () => {
    mockGenerateContentStream.mockResolvedValue(makeChunks(["abc", "def"]));

    const onComplete = vi.fn();

    const stream = createGeminiChatStream({
      question: "test",
      systemPrompt: "sys",
      onComplete,
    });

    await collectEvents(stream);

    expect(onComplete).toHaveBeenCalledWith("abcdef");
  });

  it("emits a friendly error on failure, not the raw message", async () => {
    mockGenerateContentStream.mockRejectedValue(new Error("GEMINI_API_KEY invalid"));

    const stream = createGeminiChatStream({
      question: "test",
      systemPrompt: "sys",
    });

    const events = await collectEvents(stream);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "error",
      error: "I'm having a bit of trouble right now. Please try again in a moment.",
    });
    // Must NOT contain the raw error
    expect(JSON.stringify(events)).not.toContain("GEMINI_API_KEY");
  });

  it("emits done even when response is empty", async () => {
    mockGenerateContentStream.mockResolvedValue(makeChunks([]));

    const stream = createGeminiChatStream({
      question: "test",
      systemPrompt: "sys",
    });

    const events = await collectEvents(stream);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "done",
      usage: { model: "gemini-3-flash-preview" },
    });
  });

  it("passes systemInstruction and maxOutputTokens to Gemini", async () => {
    mockGenerateContentStream.mockResolvedValue(makeChunks(["ok"]));

    const stream = createGeminiChatStream({
      question: "hello",
      systemPrompt: "Be brief.",
      maxTokens: 256,
    });

    await collectEvents(stream);

    expect(mockGenerateContentStream).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-3-flash-preview",
        config: expect.objectContaining({
          systemInstruction: "Be brief.",
          maxOutputTokens: 256,
        }),
      }),
    );
  });

  it("does not throw if onComplete callback throws", async () => {
    mockGenerateContentStream.mockResolvedValue(makeChunks(["x"]));

    const onComplete = vi.fn().mockImplementation(() => {
      throw new Error("callback boom");
    });

    const stream = createGeminiChatStream({
      question: "test",
      systemPrompt: "sys",
      onComplete,
    });

    // Should not throw
    const events = await collectEvents(stream);
    expect(events.some((e) => e.type === "done")).toBe(true);
  });
});
