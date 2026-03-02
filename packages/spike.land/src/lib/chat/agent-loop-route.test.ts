import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Mocks
const mockAuth = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ user: { id: "user-1", name: "Test" } }),
);
const mockIsBot = vi.hoisted(() => vi.fn().mockReturnValue(false));
const mockGetScriptedResponse = vi.hoisted(() => vi.fn().mockReturnValue("bot response"));
const mockCheckRateLimit = vi.hoisted(() => vi.fn().mockResolvedValue({ isLimited: false }));
const mockGetClientIp = vi.hoisted(() => vi.fn().mockReturnValue("127.0.0.1"));
const mockGetServerManager = vi.hoisted(() => vi.fn().mockResolvedValue({ getAllTools: () => [] }));
const mockCreateAgentLoopStream = vi.hoisted(() =>
  vi.fn().mockReturnValue(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    }),
  ),
);

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/chat/bot-detection", () => ({
  isBot: mockIsBot,
  getScriptedResponse: mockGetScriptedResponse,
}));
vi.mock("@/lib/chat/agent-loop-server", () => ({
  createAgentLoopStream: mockCreateAgentLoopStream,
}));
vi.mock("@/lib/chat/server-manager-pool", () => ({
  getServerManager: mockGetServerManager,
}));
vi.mock("@/lib/rate-limit-presets", () => ({ getClientIp: mockGetClientIp }));
vi.mock("@/lib/rate-limiter", () => ({ checkRateLimit: mockCheckRateLimit }));
vi.mock("@/lib/try-catch", () => ({
  tryCatch: async (p: Promise<unknown>) => {
    try {
      return { data: await p, error: undefined };
    } catch (e) {
      return { data: undefined, error: e };
    }
  },
}));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { POST } = await import("@/app/api/agent-loop/route");

function createRequest(body: Record<string, unknown>): NextRequest {
  return {
    headers: {
      get: (name: string) => (name === "user-agent" ? "Mozilla/5.0" : null),
    },
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

describe("POST /api/agent-loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1", name: "Test" } });
    mockIsBot.mockReturnValue(false);
    mockCheckRateLimit.mockResolvedValue({ isLimited: false });
    mockGetServerManager.mockResolvedValue({ getAllTools: () => [] });
  });

  it("returns 400 when question is missing", async () => {
    const response = await POST(createRequest({}));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("question is required");
  });

  it("returns 400 when question is too long", async () => {
    const response = await POST(createRequest({ question: "a".repeat(4001) }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("too long");
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ isLimited: true });
    const response = await POST(createRequest({ question: "hello" }));
    expect(response.status).toBe(429);
  });

  it("returns scripted response for bots", async () => {
    mockIsBot.mockReturnValue(true);
    const response = await POST(createRequest({ question: "hi", route: "/" }));
    const body = await response.json();
    expect(body.type).toBe("scripted");
  });

  it("returns SSE stream for valid request", async () => {
    const response = await POST(createRequest({ question: "hello" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(mockCreateAgentLoopStream).toHaveBeenCalledOnce();
  });

  it("returns 503 when ServerManager fails", async () => {
    mockGetServerManager.mockRejectedValue(new Error("Connection failed"));
    const response = await POST(createRequest({ question: "hello" }));
    expect(response.status).toBe(503);
  });
});
