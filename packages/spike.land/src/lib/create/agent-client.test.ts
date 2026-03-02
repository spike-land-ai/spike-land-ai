import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/claude-client", () => ({
  getClaudeClient: vi.fn(),
  resetClaudeClient: vi.fn(),
}));

vi.mock("@/lib/ai/gemini-client", () => ({
  generateAgentResponse: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { getClaudeClient } = await import("@/lib/ai/claude-client");
const { generateAgentResponse } = await import("@/lib/ai/gemini-client");

const mockGetClaudeClient = vi.mocked(getClaudeClient);
const mockGenerateAgentResponse = vi.mocked(generateAgentResponse);

function makeFinalMessage(
  overrides?: Partial<{
    text: string;
    stop_reason: string;
    input_tokens: number;
    output_tokens: number;
  }>,
) {
  const text = overrides?.text ?? "Hello world";
  return {
    content: [{ type: "text" as const, text }],
    stop_reason: overrides?.stop_reason ?? "end_turn",
    usage: {
      input_tokens: overrides?.input_tokens ?? 100,
      output_tokens: overrides?.output_tokens ?? 50,
    },
  };
}

function makeStreamMock(finalMsg = makeFinalMessage()) {
  return {
    finalMessage: vi.fn().mockResolvedValue(finalMsg),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("callClaude", () => {
  it("uses streaming API (messages.stream + finalMessage)", async () => {
    const streamMock = makeStreamMock();
    const mockClient = {
      messages: {
        stream: vi.fn().mockReturnValue(streamMock),
        create: vi.fn(),
      },
    };
    mockGetClaudeClient.mockResolvedValue(
      mockClient as unknown as Awaited<ReturnType<typeof mockGetClaudeClient>>,
    );

    const { callClaude } = await import("./agent-client");
    const result = await callClaude({
      systemPrompt: "You are helpful",
      userPrompt: "Say hi",
    });

    expect(mockClient.messages.stream).toHaveBeenCalledTimes(1);
    expect(mockClient.messages.create).not.toHaveBeenCalled();
    expect(streamMock.finalMessage).toHaveBeenCalledTimes(1);
    expect(result.text).toBe("Hello world");
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
  });

  it("defaults to sonnet model", async () => {
    const streamMock = makeStreamMock();
    const mockClient = {
      messages: {
        stream: vi.fn().mockReturnValue(streamMock),
      },
    };
    mockGetClaudeClient.mockResolvedValue(
      mockClient as unknown as Awaited<ReturnType<typeof mockGetClaudeClient>>,
    );

    const { callClaude } = await import("./agent-client");
    await callClaude({
      systemPrompt: "test",
      userPrompt: "test",
    });

    expect(mockClient.messages.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-6",
      }),
    );
  });

  it("passes opus model when explicitly specified", async () => {
    const streamMock = makeStreamMock();
    const mockClient = {
      messages: {
        stream: vi.fn().mockReturnValue(streamMock),
      },
    };
    mockGetClaudeClient.mockResolvedValue(
      mockClient as unknown as Awaited<ReturnType<typeof mockGetClaudeClient>>,
    );

    const { callClaude } = await import("./agent-client");
    await callClaude({
      systemPrompt: "test",
      userPrompt: "test",
      model: "opus",
    });

    expect(mockClient.messages.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-opus-4-6",
      }),
    );
  });

  it("detects truncated responses", async () => {
    const streamMock = makeStreamMock(makeFinalMessage({ stop_reason: "max_tokens" }));
    const mockClient = {
      messages: {
        stream: vi.fn().mockReturnValue(streamMock),
      },
    };
    mockGetClaudeClient.mockResolvedValue(
      mockClient as unknown as Awaited<ReturnType<typeof mockGetClaudeClient>>,
    );

    const { callClaude } = await import("./agent-client");
    const result = await callClaude({
      systemPrompt: "test",
      userPrompt: "test",
    });

    expect(result.truncated).toBe(true);
  });

  it("falls back to Gemini for sonnet model on failure", async () => {
    const mockClient = {
      messages: {
        stream: vi.fn().mockReturnValue({
          finalMessage: vi
            .fn()
            .mockRejectedValue(Object.assign(new Error("Server error"), { status: 500 })),
        }),
      },
    };
    mockGetClaudeClient.mockResolvedValue(
      mockClient as unknown as Awaited<ReturnType<typeof mockGetClaudeClient>>,
    );
    mockGenerateAgentResponse.mockResolvedValue("Gemini response");

    const { callClaude } = await import("./agent-client");
    const result = await callClaude({
      systemPrompt: "test",
      userPrompt: "test",
      model: "sonnet",
    });

    expect(result.text).toBe("Gemini response");
    expect(mockGenerateAgentResponse).toHaveBeenCalledTimes(1);
  });

  it("falls back to Gemini for opus model on failure", async () => {
    const mockClient = {
      messages: {
        stream: vi.fn().mockReturnValue({
          finalMessage: vi
            .fn()
            .mockRejectedValue(Object.assign(new Error("Server error"), { status: 500 })),
        }),
      },
    };
    mockGetClaudeClient.mockResolvedValue(
      mockClient as unknown as Awaited<ReturnType<typeof mockGetClaudeClient>>,
    );
    mockGenerateAgentResponse.mockResolvedValue("Gemini fallback");

    const { callClaude } = await import("./agent-client");
    const result = await callClaude({
      systemPrompt: "test",
      userPrompt: "test",
      model: "opus",
    });

    expect(result.text).toBe("Gemini fallback");
  });

  it("does NOT fall back to Gemini for haiku model", async () => {
    const mockClient = {
      messages: {
        stream: vi.fn().mockReturnValue({
          finalMessage: vi
            .fn()
            .mockRejectedValue(Object.assign(new Error("Server error"), { status: 500 })),
        }),
      },
    };
    mockGetClaudeClient.mockResolvedValue(
      mockClient as unknown as Awaited<ReturnType<typeof mockGetClaudeClient>>,
    );

    const { callClaude } = await import("./agent-client");

    await expect(
      callClaude({
        systemPrompt: "test",
        userPrompt: "test",
        model: "haiku",
      }),
    ).rejects.toThrow("Server error");

    expect(mockGenerateAgentResponse).not.toHaveBeenCalled();
  });
});
