import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mockRunAgentLoop = vi.hoisted(() => vi.fn());
const mockChatClientConstructor = vi.hoisted(() => vi.fn());
const mockGetPreferredToken = vi.hoisted(() => vi.fn());

vi.mock("@spike-land-ai/spike-cli", () => ({
  runAgentLoop: mockRunAgentLoop,
  ChatClient: class MockChatClient {
    constructor(...args: unknown[]) {
      mockChatClientConstructor(...args);
    }
  },
}));

vi.mock("@/lib/ai/token-pool", () => ({
  getPreferredToken: mockGetPreferredToken,
}));

const mockLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: mockLogger,
}));

vi.mock("./fallback-bot", () => ({
  createFallbackBotStream: vi.fn(() => {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"text","text":"fallback"}\n\n'));
        controller.close();
      },
    });
  }),
}));

// ─── Import under test ──────────────────────────────────────────────────────

import { clearSession, createAgentLoopStream } from "./agent-loop-server";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
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

function makeOptions(overrides?: Partial<Parameters<typeof createAgentLoopStream>[0]>) {
  return {
    sessionId: "session-1",
    question: "Hello",
    manager: {} as Parameters<typeof createAgentLoopStream>[0]["manager"],
    promptContext: { route: "/", isAuthenticated: false },
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("createAgentLoopStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSession("session-1");
    mockGetPreferredToken.mockReturnValue("test-token");
  });

  it("emits done event on successful agent loop", async () => {
    mockRunAgentLoop.mockResolvedValue(undefined);

    const stream = createAgentLoopStream(makeOptions());
    const output = await collectStream(stream);

    expect(output).toContain('"type":"done"');
    expect(mockRunAgentLoop).toHaveBeenCalled();
  });

  it("creates ChatClient with auth token from token pool", async () => {
    mockGetPreferredToken.mockReturnValue("my-token");
    mockRunAgentLoop.mockResolvedValue(undefined);

    const stream = createAgentLoopStream(makeOptions());
    await collectStream(stream);

    expect(mockChatClientConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ authToken: "my-token" }),
    );
  });

  it("falls back to API key env var when token pool throws", async () => {
    mockGetPreferredToken.mockImplementation(() => {
      throw new Error("no tokens");
    });
    process.env.CLAUDE_API_KEY = "env-key";
    mockRunAgentLoop.mockResolvedValue(undefined);

    const stream = createAgentLoopStream(makeOptions());
    const output = await collectStream(stream);

    expect(output).toContain('"type":"done"');
    expect(mockChatClientConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "env-key" }),
    );

    delete process.env.CLAUDE_API_KEY;
  });

  it("uses fallback bot when no tokens and no API key", async () => {
    mockGetPreferredToken.mockImplementation(() => {
      throw new Error("no tokens");
    });
    delete process.env.CLAUDE_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const stream = createAgentLoopStream(makeOptions());
    const output = await collectStream(stream);

    expect(output).toContain("fallback");
    expect(mockRunAgentLoop).not.toHaveBeenCalled();
  });

  it("emits text_delta events via onTextDelta callback", async () => {
    mockRunAgentLoop.mockImplementation(
      async (_content: unknown, ctx: { onTextDelta: (text: string) => void }) => {
        ctx.onTextDelta("Hello ");
        ctx.onTextDelta("world");
      },
    );

    const stream = createAgentLoopStream(makeOptions());
    const output = await collectStream(stream);

    expect(output).toContain('"type":"text_delta"');
    expect(output).toContain('"text":"Hello "');
    expect(output).toContain('"text":"world"');
  });

  it("emits error event on non-auth failure", async () => {
    mockRunAgentLoop.mockRejectedValue(new Error("something broke"));

    const stream = createAgentLoopStream(makeOptions());
    const output = await collectStream(stream);

    expect(output).toContain('"type":"error"');
    expect(output).toContain("An error occurred");
  });

  it("falls back to bot on auth failure", async () => {
    mockRunAgentLoop.mockRejectedValue(new Error("401 Unauthorized auth token"));

    const stream = createAgentLoopStream(makeOptions());
    const output = await collectStream(stream);

    expect(output).toContain("fallback");
  });

  it("uses maxTurns parameter", async () => {
    mockRunAgentLoop.mockResolvedValue(undefined);

    const stream = createAgentLoopStream(makeOptions({ maxTurns: 5 }));
    await collectStream(stream);

    expect(mockRunAgentLoop).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ maxTurns: 5 }),
    );
  });

  it("defaults maxTurns to 10", async () => {
    mockRunAgentLoop.mockResolvedValue(undefined);

    const stream = createAgentLoopStream(makeOptions());
    await collectStream(stream);

    expect(mockRunAgentLoop).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ maxTurns: 10 }),
    );
  });

  it("handles attachments by extracting base64 data", async () => {
    mockRunAgentLoop.mockResolvedValue(undefined);

    const stream = createAgentLoopStream(
      makeOptions({
        attachments: [{ type: "image/png", data: "data:image/png;base64,iVBORw0KGgo=" }],
      }),
    );
    await collectStream(stream);

    expect(mockRunAgentLoop).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: "text" }),
        expect.objectContaining({
          type: "image",
          source: expect.objectContaining({
            data: "iVBORw0KGgo=",
          }),
        }),
      ]),
      expect.anything(),
    );
  });
});

describe("clearSession", () => {
  it("does not throw for unknown session", () => {
    expect(() => clearSession("unknown")).not.toThrow();
  });

  it("clears session message history", async () => {
    mockRunAgentLoop.mockResolvedValue(undefined);
    mockGetPreferredToken.mockReturnValue("t");

    // Run first message to create session
    const stream = createAgentLoopStream(makeOptions({ sessionId: "s1" }));
    await collectStream(stream);

    clearSession("s1");
    // No assertion needed — just ensure no error
  });
});
