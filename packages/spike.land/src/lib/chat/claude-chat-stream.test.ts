import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock withClaudeClient to invoke the operation with a fake Anthropic client
const mockStream = vi.hoisted(() => vi.fn());
const mockFinalMessage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/claude-client", () => ({
  withClaudeClient: vi.fn(
    async (
      operation: (anthropic: { messages: { stream: typeof mockStream } }) => Promise<void>,
    ) => {
      const fakeAnthropic = {
        messages: {
          stream: mockStream,
        },
      };
      return operation(fakeAnthropic);
    },
  ),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { createClaudeChatStream } from "./claude-chat-stream";

/** Helper to collect all chunks from a ReadableStream as text. */
async function collectStream(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

/** Create an async iterable of events for the mock stream. */
function createMockMessageStream(
  events: Array<{ type: string; delta?: { type: string; text?: string } }>,
  finalUsage = { input_tokens: 10, output_tokens: 20 },
) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const event of events) {
        yield event;
      }
    },
    finalMessage: mockFinalMessage.mockResolvedValue({
      usage: finalUsage,
    }),
  };
}

describe("createClaudeChatStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("streams text deltas as SSE events", async () => {
    const events = [
      { type: "content_block_delta", delta: { type: "text_delta", text: "Hello" } },
      { type: "content_block_delta", delta: { type: "text_delta", text: " world" } },
    ];
    mockStream.mockReturnValue(createMockMessageStream(events));

    const stream = createClaudeChatStream({
      question: "Hi",
      systemPrompt: "You are helpful",
    });

    const output = await collectStream(stream);

    expect(output).toContain('"type":"text"');
    expect(output).toContain('"text":"Hello"');
    expect(output).toContain('"text":" world"');
    expect(output).toContain('"type":"done"');
  });

  it("ignores non-text-delta events", async () => {
    const events = [
      { type: "message_start" },
      { type: "content_block_start" },
      { type: "content_block_delta", delta: { type: "text_delta", text: "Ok" } },
      { type: "content_block_stop" },
    ];
    mockStream.mockReturnValue(createMockMessageStream(events));

    const stream = createClaudeChatStream({
      question: "test",
      systemPrompt: "test",
    });

    const output = await collectStream(stream);
    const dataLines = output.split("\n").filter((l) => l.startsWith("data:"));
    // One text event + one done event
    expect(dataLines).toHaveLength(2);
  });

  it("calls onComplete with full answer and usage", async () => {
    const events = [{ type: "content_block_delta", delta: { type: "text_delta", text: "Answer" } }];
    const usage = { input_tokens: 5, output_tokens: 15 };
    mockStream.mockReturnValue(createMockMessageStream(events, usage));

    const onComplete = vi.fn();
    const stream = createClaudeChatStream({
      question: "q",
      systemPrompt: "s",
      onComplete,
    });

    await collectStream(stream);

    expect(onComplete).toHaveBeenCalledWith("Answer", usage);
  });

  it("passes maxTokens to the stream call", async () => {
    mockStream.mockReturnValue(createMockMessageStream([]));

    const stream = createClaudeChatStream({
      question: "q",
      systemPrompt: "s",
      maxTokens: 1024,
    });

    await collectStream(stream);

    expect(mockStream).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 1024 }));
  });

  it("uses 512 as default maxTokens", async () => {
    mockStream.mockReturnValue(createMockMessageStream([]));

    const stream = createClaudeChatStream({
      question: "q",
      systemPrompt: "s",
    });

    await collectStream(stream);

    expect(mockStream).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 512 }));
  });

  it("emits error event on non-abort failure", async () => {
    const { withClaudeClient } = await import("@/lib/ai/claude-client");
    vi.mocked(withClaudeClient).mockRejectedValueOnce(new Error("API down"));

    const stream = createClaudeChatStream({
      question: "q",
      systemPrompt: "s",
    });

    const output = await collectStream(stream);

    expect(output).toContain('"type":"error"');
    expect(output).toContain("trouble right now");
  });

  it("handles cancel gracefully", async () => {
    // Use a stream that yields indefinitely
    const infiniteStream = {
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "chunk" },
        };
        // Wait long enough for cancel to fire
        await new Promise((resolve) => setTimeout(resolve, 1000));
      },
      finalMessage: mockFinalMessage.mockResolvedValue({
        usage: { input_tokens: 0, output_tokens: 0 },
      }),
    };
    mockStream.mockReturnValue(infiniteStream);

    const stream = createClaudeChatStream({
      question: "q",
      systemPrompt: "s",
    });

    const reader = stream.getReader();
    // Read one chunk
    await reader.read();
    // Cancel the stream
    await reader.cancel();
    // Should not throw
  });
});
