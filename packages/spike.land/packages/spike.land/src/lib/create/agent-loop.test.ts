import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/create/agent-client", () => ({
  callClaude: vi.fn(),
  extractCodeFromResponse: vi.fn(),
  isAuthError: vi.fn().mockReturnValue(false),
  parseGenerationResponse: vi.fn(),
}));

vi.mock("@/lib/create/agent-memory", () => ({
  batchExtractAndSaveNotes: vi.fn().mockResolvedValue(undefined),
  recordFailure: vi.fn().mockResolvedValue(undefined),
  recordGenerationAttempt: vi.fn().mockResolvedValue(undefined),
  recordSuccess: vi.fn().mockResolvedValue(undefined),
  retrieveNotesForError: vi.fn().mockResolvedValue([]),
  retrieveRelevantNotes: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/create/agent-prompts", () => ({
  buildAgentSystemPrompt: vi.fn().mockReturnValue({
    full: "system prompt",
    stablePrefix: "prefix",
    dynamicSuffix: "",
  }),
  buildAgentUserPrompt: vi.fn().mockReturnValue("user prompt"),
  buildFixSystemPrompt: vi.fn().mockReturnValue({
    full: "fix system",
    stablePrefix: "fix prefix",
    dynamicSuffix: "",
  }),
  buildFixUserPrompt: vi.fn().mockReturnValue("fix prompt"),
}));

vi.mock("@/lib/create/codespace-service", () => ({
  generateCodespaceId: vi.fn().mockReturnValue("test-cs-id"),
  updateCodespace: vi.fn(),
}));

vi.mock("@/lib/create/content-generator", () => ({
  cleanCode: vi.fn((code: string) => code),
}));

vi.mock("@/lib/create/content-service", () => ({
  getCreatedApp: vi.fn().mockResolvedValue({ id: "app-1", slug: "test" }),
  markAsGenerating: vi.fn().mockResolvedValue(undefined),
  updateAppContent: vi.fn().mockResolvedValue(undefined),
  updateAppStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/create/error-parser", () => ({
  isUnrecoverableError: vi.fn().mockReturnValue(false),
  parseTranspileError: vi.fn().mockReturnValue({
    type: "syntax",
    severity: "error",
    message: "test error",
  }),
}));

vi.mock("@/lib/create/auto-reviewer", () => ({
  runAutoReview: vi.fn().mockResolvedValue({ passed: true, score: 1.0, checks: {} }),
}));

vi.mock("@/lib/create/ai-reviewer", () => ({
  runAiReview: vi.fn().mockResolvedValue({
    passed: true,
    averageScore: 0.9,
    feedback: "Good",
    reviews: [],
  }),
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { callClaude, parseGenerationResponse } = await import(
  "@/lib/create/agent-client"
);
const { updateCodespace } = await import("@/lib/create/codespace-service");

const mockCallClaude = vi.mocked(callClaude);
const mockParseGeneration = vi.mocked(parseGenerationResponse);
const mockUpdateCodespace = vi.mocked(updateCodespace);

beforeEach(() => {
  vi.clearAllMocks();
});

async function collectEvents(
  gen: AsyncGenerator<{ type: string; [key: string]: unknown; }>,
) {
  const events: Array<{ type: string; [key: string]: unknown; }> = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

describe("agentGenerateApp", () => {
  it("calls callClaude with model sonnet for generation", async () => {
    mockCallClaude.mockResolvedValue({
      text: "generated code",
      inputTokens: 500,
      outputTokens: 300,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      truncated: false,
    });

    mockParseGeneration.mockReturnValue({
      title: "Test App",
      description: "A test",
      code: "import React from \"react\";\nexport default function App() { return <div />; }",
      relatedApps: [],
    });

    mockUpdateCodespace.mockResolvedValue({ success: true });

    const { agentGenerateApp } = await import("./agent-loop");
    const events = await collectEvents(
      agentGenerateApp("test-app", ["test-app"], "user-1"),
    );

    // Verify callClaude was called with "sonnet" for generation
    expect(mockCallClaude).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "sonnet",
      }),
    );

    // Verify generation phase mentions Sonnet
    const genPhase = events.find(
      e => e.type === "phase" && e.phase === "GENERATING",
    );
    expect(genPhase?.message).toContain("Sonnet");

    // Verify completion
    const complete = events.find(e => e.type === "complete");
    expect(complete).toBeDefined();
    expect(complete?.title).toBe("Test App");
  });

  it("uses sonnet for fix calls", async () => {
    // First call: generation succeeds
    mockCallClaude
      .mockResolvedValueOnce({
        text: "generated code",
        inputTokens: 500,
        outputTokens: 300,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        truncated: false,
      })
      // Second call: fix succeeds
      .mockResolvedValueOnce({
        text: "fixed code",
        inputTokens: 500,
        outputTokens: 300,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        truncated: false,
      });

    mockParseGeneration.mockReturnValue({
      title: "Test App",
      description: "A test",
      code: "import React from \"react\";\nexport default function App() { return <div />; }",
      relatedApps: [],
    });

    const { extractCodeFromResponse } = await import(
      "@/lib/create/agent-client"
    );
    vi.mocked(extractCodeFromResponse).mockReturnValue(
      "import React from \"react\";\nexport default function App() { return <div>fixed</div>; }",
    );

    // First transpile fails, second succeeds
    mockUpdateCodespace
      .mockResolvedValueOnce({
        success: false,
        error: "SyntaxError: unexpected token",
      })
      .mockResolvedValueOnce({ success: true });

    const { agentGenerateApp } = await import("./agent-loop");
    const events = await collectEvents(
      agentGenerateApp("test-app", ["test-app"], "user-1"),
    );

    // The fix call should use sonnet
    expect(mockCallClaude).toHaveBeenCalledTimes(2);
    expect(mockCallClaude.mock.calls[1]![0]).toMatchObject({
      model: "sonnet",
    });

    const complete = events.find(e => e.type === "complete");
    expect(complete).toBeDefined();
  });

  it("enforces token budget", async () => {
    mockCallClaude.mockResolvedValue({
      text: "generated code",
      inputTokens: 100_000,
      outputTokens: 60_000,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      truncated: false,
    });

    mockParseGeneration.mockReturnValue({
      title: "Test App",
      description: "A test",
      code: "import React from \"react\";\nexport default function App() { return <div />; }",
      relatedApps: [],
    });

    const { agentGenerateApp } = await import("./agent-loop");

    await expect(async () => {
      await collectEvents(
        agentGenerateApp("test-app", ["test-app"], "user-1"),
      );
    }).rejects.toThrow("Token budget exceeded");
  });
});
