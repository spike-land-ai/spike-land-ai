import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isBot } from "@/lib/chat/bot-detection";
import { checkRateLimit } from "@/lib/rate-limiter";

// Mock dependencies
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/chat/bot-detection", () => ({
  isBot: vi.fn(),
  getScriptedResponse: vi.fn(() => "mock-scripted-response"),
}));

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/rate-limit-presets", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock dynamic imports
vi.mock("@/lib/upstash/client", () => ({
  isMcpAgentActive: vi.fn(async () => false),
}));

vi.mock("@/lib/ai/gemini-client", () => ({
  isGeminiConfigured: vi.fn(async () => true),
}));

vi.mock("@/lib/chat/gemini-chat-stream", () => ({
  createGeminiChatStream: vi.fn(() => new ReadableStream()),
}));

describe("agent-chat API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for empty question", async () => {
    const request = new NextRequest("http://localhost/api/agent-chat", {
      method: "POST",
      body: JSON.stringify({ question: "" }),
    });

    vi.mocked(isBot).mockReturnValue(false);
    vi.mocked(checkRateLimit).mockResolvedValue({ isLimited: false, remaining: 10 });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("question is required");
  });

  it("detects bots and returns scripted response", async () => {
    const request = new NextRequest("http://localhost/api/agent-chat", {
      method: "POST",
      headers: { "user-agent": "Googlebot" },
      body: JSON.stringify({ question: "hello", route: "/" }),
    });

    vi.mocked(isBot).mockReturnValue(true);

    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("scripted");
    expect(body.content).toBe("mock-scripted-response");
  });

  it("applies rate limits", async () => {
    const request = new NextRequest("http://localhost/api/agent-chat", {
      method: "POST",
      body: JSON.stringify({ question: "hello" }),
    });

    vi.mocked(isBot).mockReturnValue(false);
    vi.mocked(checkRateLimit).mockResolvedValue({ isLimited: true, remaining: 0 });

    const response = await POST(request);
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toContain("Too many requests");
  });
});
