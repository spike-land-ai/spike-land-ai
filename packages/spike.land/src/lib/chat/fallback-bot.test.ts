import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFallbackBotStream, detectIntent } from "./fallback-bot";

// Mock prisma
const mockPrisma = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
  },
  directMessage: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("detectIntent", () => {
  it("detects bug reports", () => {
    expect(detectIntent("I found a bug in the login page")).toBe("bug");
    expect(detectIntent("The button is broken")).toBe("bug");
    expect(detectIntent("Getting an error when I click submit")).toBe("bug");
    expect(detectIntent("This page doesn't work")).toBe("bug");
  });

  it("detects feedback", () => {
    expect(detectIntent("I have some feedback about the UI")).toBe("feedback");
    expect(detectIntent("I'd suggest adding dark mode")).toBe("feedback");
    expect(detectIntent("It would be nice to have search")).toBe("feedback");
    expect(detectIntent("Feature request: export to PDF")).toBe("feedback");
  });

  it("detects messages", () => {
    expect(detectIntent("Can I send a message to the team?")).toBe("message");
    expect(detectIntent("I want to contact support")).toBe("message");
    expect(detectIntent("Please tell the dev about this")).toBe("message");
  });

  it("detects help requests", () => {
    expect(detectIntent("How do I create an app?")).toBe("help");
    expect(detectIntent("Help me get started")).toBe("help");
    expect(detectIntent("Where can I find the settings?")).toBe("help");
  });

  it("defaults to general", () => {
    expect(detectIntent("Hello there")).toBe("general");
    expect(detectIntent("What's spike.land?")).toBe("general");
  });
});

describe("createFallbackBotStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findFirst.mockResolvedValue({ id: "owner-123" });
    mockPrisma.directMessage.create.mockResolvedValue({ id: "dm-1" });
  });

  async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
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

  it("returns a valid SSE stream with text_delta and done events", async () => {
    const stream = createFallbackBotStream({
      question: "Hello",
      sessionId: "test-session",
      promptContext: { route: "/", isAuthenticated: false },
    });

    const output = await readStream(stream);
    expect(output).toContain('"type":"text_delta"');
    expect(output).toContain('"type":"done"');
    expect(output).toContain("Thanks for reaching out");
  });

  it("returns bug-specific response for bug reports", async () => {
    const stream = createFallbackBotStream({
      question: "I found a bug in the login",
      sessionId: "test-session",
      promptContext: { route: "/login", isAuthenticated: false },
    });

    const output = await readStream(stream);
    expect(output).toContain("Thanks for reporting");
  });

  it("returns help-specific response for help requests", async () => {
    const stream = createFallbackBotStream({
      question: "How do I get started?",
      sessionId: "test-session",
      promptContext: { route: "/", isAuthenticated: false },
    });

    const output = await readStream(stream);
    expect(output).toContain("Welcome to spike.land");
  });

  it("saves the message as a DirectMessage", async () => {
    const stream = createFallbackBotStream({
      question: "I found a bug",
      sessionId: "test-session-123",
      promptContext: { route: "/dashboard", isAuthenticated: true },
    });

    await readStream(stream);

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: "zoltan@spike.land" },
      select: { id: true },
    });

    expect(mockPrisma.directMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromSessionId: "test-session-123",
        toUserId: "owner-123",
        subject: expect.stringContaining("[BUG]"),
        message: "I found a bug",
        priority: "HIGH",
      }),
    });
  });

  it("uses MEDIUM priority for non-bug messages", async () => {
    const stream = createFallbackBotStream({
      question: "I have some feedback",
      sessionId: "test-session",
      promptContext: { route: "/", isAuthenticated: false },
    });

    await readStream(stream);

    expect(mockPrisma.directMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        priority: "MEDIUM",
      }),
    });
  });

  it("handles missing site owner gracefully", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const stream = createFallbackBotStream({
      question: "Hello",
      sessionId: "test-session",
      promptContext: { route: "/", isAuthenticated: false },
    });

    const output = await readStream(stream);
    // Should still return a response even if DM save fails
    expect(output).toContain('"type":"text_delta"');
    expect(output).toContain('"type":"done"');
    expect(mockPrisma.directMessage.create).not.toHaveBeenCalled();
  });
});
