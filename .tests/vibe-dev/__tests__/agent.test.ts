import { type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { existsSync, mkdirSync } from "fs";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs");
vi.mock("fs/promises");
vi.mock("../../../src/cli/docker-dev/core-logic/api.js");
vi.mock("../../../src/cli/docker-dev/core-logic/redis.js");
vi.mock("cross-spawn", () => ({ default: vi.fn() }));

import spawn from "cross-spawn";
import * as api from "../../../src/cli/docker-dev/core-logic/api.js";
import * as redis from "../../../src/cli/docker-dev/core-logic/redis.js";
import * as agent from "../../../src/cli/docker-dev/node-sys/agent.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockProcess(): ChildProcess & EventEmitter {
  const proc = new EventEmitter() as ChildProcess & EventEmitter;
  proc.stdin = { write: vi.fn(), end: vi.fn() } as unknown as typeof proc.stdin;
  proc.stdout = new EventEmitter() as unknown as typeof proc.stdout;
  proc.stderr = new EventEmitter() as unknown as typeof proc.stderr;
  proc.kill = vi.fn();
  return proc;
}

// ---------------------------------------------------------------------------
// TEST_KEYWORD_HANDLERS
// ---------------------------------------------------------------------------

describe("TEST_KEYWORD_HANDLERS", () => {
  it("E2E_TEST_ECHO handler returns echoed message", async () => {
    const handler = agent.TEST_KEYWORD_HANDLERS["E2E_TEST_ECHO:"]!;
    const result = await handler("E2E_TEST_ECHO:hello world", "app1");
    expect(result.response).toBe("ECHO: hello world");
    expect(result.codeUpdated).toBe(false);
  });

  it("E2E_TEST_CODE_UPDATE handler returns mock update", async () => {
    const handler = agent.TEST_KEYWORD_HANDLERS["E2E_TEST_CODE_UPDATE"]!;
    const result = await handler("E2E_TEST_CODE_UPDATE", "app1");
    expect(result.codeUpdated).toBe(true);
    expect(result.codespaceId).toBe("e2e-test-app1");
  });

  it("E2E_TEST_ERROR handler returns error result", async () => {
    const handler = agent.TEST_KEYWORD_HANDLERS["E2E_TEST_ERROR"]!;
    const result = await handler("E2E_TEST_ERROR", "app1");
    expect(result.error).toBe("E2E_TEST_ERROR triggered");
  });

  it("E2E_TEST_DELAY handler uses default 1000ms delay", async () => {
    vi.useFakeTimers();
    const handler = agent.TEST_KEYWORD_HANDLERS["E2E_TEST_DELAY:"]!;
    const promise = handler("E2E_TEST_DELAY:", "app1");
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;
    expect(result.response).toContain("1000ms");
    vi.useRealTimers();
  });

  it("E2E_TEST_DELAY handler clamps delay to 30000ms", async () => {
    vi.useFakeTimers();
    const handler = agent.TEST_KEYWORD_HANDLERS["E2E_TEST_DELAY:"]!;
    const promise = handler("E2E_TEST_DELAY:99999", "app1");
    await vi.advanceTimersByTimeAsync(30000);
    const result = await promise;
    expect(result.response).toContain("30000ms");
    vi.useRealTimers();
  });

  it("E2E_TEST_DELAY handler uses provided ms value", async () => {
    vi.useFakeTimers();
    const handler = agent.TEST_KEYWORD_HANDLERS["E2E_TEST_DELAY:"]!;
    const promise = handler("E2E_TEST_DELAY:500", "app1");
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;
    expect(result.response).toContain("500ms");
    vi.useRealTimers();
  });

  it("E2E_TEST_MCP handler uses content codespace id", async () => {
    const handler = agent.TEST_KEYWORD_HANDLERS["E2E_TEST_MCP:"]!;
    const result = await handler("E2E_TEST_MCP:my-space", "app1");
    expect(result.codespaceId).toBe("my-space");
    expect(result.codeUpdated).toBe(true);
  });

  it("E2E_TEST_MCP handler falls back to app id when no codespace given", async () => {
    const handler = agent.TEST_KEYWORD_HANDLERS["E2E_TEST_MCP:"]!;
    const result = await handler("E2E_TEST_MCP:", "app1");
    expect(result.codespaceId).toBe("e2e-mcp-app1");
  });
});

// ---------------------------------------------------------------------------
// findTestKeywordHandler
// ---------------------------------------------------------------------------

describe("findTestKeywordHandler", () => {
  it("returns handler for matching keyword prefix", () => {
    const result = agent.findTestKeywordHandler("E2E_TEST_ECHO:hi");
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe("E2E_TEST_ECHO:");
  });

  it("returns null when no keyword matches", () => {
    const result = agent.findTestKeywordHandler("regular user message");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getLocalFilePath
// ---------------------------------------------------------------------------

describe("getLocalFilePath", () => {
  it("sanitizes codespace id and returns tsx path", () => {
    const p = agent.getLocalFilePath("my/code space");
    expect(p).toContain("my-code-space.tsx");
  });

  it("passes clean ids through unchanged", () => {
    const p = agent.getLocalFilePath("clean-id");
    expect(p).toContain("clean-id.tsx");
  });
});

// ---------------------------------------------------------------------------
// downloadCodeToLocal
// ---------------------------------------------------------------------------

describe("downloadCodeToLocal", () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(writeFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it("saves code from session.code and returns local path", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ code: "const x = 1;" }),
    });

    const result = await agent.downloadCodeToLocal("myspace");
    expect(result).toContain("myspace.tsx");
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining("myspace.tsx"),
      "const x = 1;",
      "utf-8",
    );
  });

  it("saves code from cSess.code when session.code absent", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ cSess: { code: "const y = 2;" } }),
    });

    await agent.downloadCodeToLocal("myspace");
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining("myspace.tsx"),
      "const y = 2;",
      "utf-8",
    );
  });

  it("saves empty string when both code fields absent", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await agent.downloadCodeToLocal("myspace");
    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining("myspace.tsx"), "", "utf-8");
  });

  it("writes placeholder for 404 and returns path", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const result = await agent.downloadCodeToLocal("newspace");
    expect(result).toContain("newspace.tsx");
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining("newspace.tsx"),
      expect.stringContaining("New codespace: newspace"),
      "utf-8",
    );
  });

  it("throws on non-404 HTTP error", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(agent.downloadCodeToLocal("myspace")).rejects.toThrow(
      "Failed to fetch session: HTTP 500",
    );
  });

  it("creates live dir when it does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ code: "" }),
    });

    await agent.downloadCodeToLocal("myspace");
    expect(mkdirSync).toHaveBeenCalledWith(expect.any(String), {
      recursive: true,
    });
  });
});

// ---------------------------------------------------------------------------
// syncCodeToServer
// ---------------------------------------------------------------------------

describe("syncCodeToServer", () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it("sends PUT request with code to default URL", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await agent.syncCodeToServer("myspace", "const x = 1;");
    // TESTING_SPIKE_LAND_URL defaults to "https://testing.spike.land" at module load
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/live/myspace/api/code"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ code: "const x = 1;", run: true }),
      }),
    );
  });

  it("throws on failure response with error text", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    });

    await expect(agent.syncCodeToServer("myspace", "code")).rejects.toThrow(
      "Sync failed: 503 - Service Unavailable",
    );
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

describe("buildSystemPrompt", () => {
  it("includes codespace info when codespaceId provided", () => {
    const prompt = agent.buildSystemPrompt({
      name: "MyApp",
      codespaceId: "space1",
      codespaceUrl: "https://spike.land/live/space1",
    });
    expect(prompt).toContain("space1");
    expect(prompt).toContain("https://spike.land/live/space1");
  });

  it("uses fallback URL when codespaceUrl is null", () => {
    const prompt = agent.buildSystemPrompt({
      name: "MyApp",
      codespaceId: "space1",
      codespaceUrl: null,
    });
    expect(prompt).toContain("https://spike.land/live/space1");
  });

  it("mentions no codespace when codespaceId is null", () => {
    const prompt = agent.buildSystemPrompt({
      name: "MyApp",
      codespaceId: null,
      codespaceUrl: null,
    });
    expect(prompt).toContain("No codespace yet");
  });

  it("includes local file instructions when localFilePath provided", () => {
    const prompt = agent.buildSystemPrompt({
      name: "MyApp",
      codespaceId: "space1",
      codespaceUrl: null,
      localFilePath: "/app/live/space1.tsx",
    });
    expect(prompt).toContain("/app/live/space1.tsx");
    expect(prompt).toContain("LOCAL FILE MODE");
  });

  it("omits local file section when localFilePath not provided", () => {
    const prompt = agent.buildSystemPrompt({
      name: "MyApp",
      codespaceId: null,
      codespaceUrl: null,
    });
    expect(prompt).not.toContain("LOCAL FILE MODE");
  });
});

// ---------------------------------------------------------------------------
// formatPromptWithHistory
// ---------------------------------------------------------------------------

describe("formatPromptWithHistory", () => {
  const app = {
    name: "TestApp",
    description: "A test app",
    codespaceId: "space1",
    codespaceUrl: null,
  };

  it("includes app context and USER messages", () => {
    const messages = [
      {
        id: "m1",
        role: "USER" as const,
        content: "Hello",
        createdAt: "2024-01-01",
        isRead: false,
        attachments: [],
      },
    ];
    const prompt = agent.formatPromptWithHistory(messages, app);
    expect(prompt).toContain("TestApp");
    expect(prompt).toContain("Hello");
    expect(prompt).toContain("User");
  });

  it("uses 'No description yet' when description is null", () => {
    const prompt = agent.formatPromptWithHistory([], {
      ...app,
      description: null,
    });
    expect(prompt).toContain("No description yet");
  });

  it("uses 'Not yet created' when codespaceId is null", () => {
    const prompt = agent.formatPromptWithHistory([], {
      ...app,
      codespaceId: null,
    });
    expect(prompt).toContain("Not yet created");
  });

  it("includes AGENT role as Assistant", () => {
    const messages = [
      {
        id: "m2",
        role: "AGENT" as const,
        content: "I updated the code",
        createdAt: "2024-01-02",
        isRead: true,
        attachments: [],
      },
    ];
    const prompt = agent.formatPromptWithHistory(messages, app);
    expect(prompt).toContain("Assistant");
  });

  it("uses System label for non-USER non-AGENT roles", () => {
    const messages = [
      {
        id: "m3",
        role: "SYSTEM" as const,
        content: "System message",
        createdAt: "2024-01-03",
        isRead: true,
        attachments: [],
      },
    ];
    const prompt = agent.formatPromptWithHistory(messages, app);
    expect(prompt).toContain("System");
  });

  it("includes image attachments in prompt", () => {
    const messages = [
      {
        id: "m4",
        role: "USER" as const,
        content: "Check this",
        createdAt: "2024-01-04",
        isRead: false,
        attachments: [
          {
            image: {
              id: "img1",
              originalUrl: "https://example.com/img.png",
              aiDescription: "A screenshot",
              tags: [],
            },
          },
        ],
      },
    ];
    const prompt = agent.formatPromptWithHistory(messages, app);
    expect(prompt).toContain("https://example.com/img.png");
    expect(prompt).toContain("A screenshot");
  });

  it("skips aiDescription when absent", () => {
    const messages = [
      {
        id: "m5",
        role: "USER" as const,
        content: "Image here",
        createdAt: "2024-01-05",
        isRead: false,
        attachments: [
          {
            image: {
              id: "img2",
              originalUrl: "https://example.com/img.png",
              aiDescription: null,
              tags: [],
            },
          },
        ],
      },
    ];
    const prompt = agent.formatPromptWithHistory(messages, app);
    expect(prompt).toContain("https://example.com/img.png");
    // When aiDescription is null, the "  Description: " attachment line is absent
    expect(prompt).not.toContain("  Description:");
  });
});

// ---------------------------------------------------------------------------
// spawnClaudeCode
// ---------------------------------------------------------------------------

describe("spawnClaudeCode", () => {
  beforeEach(() => {
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("resolves with success when claude exits 0", async () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess);

    const promise = agent.spawnClaudeCode("do something", "system prompt", "/tmp/mcp.json");

    const resultLine = JSON.stringify({ type: "result", result: "done" });
    (proc.stdout as EventEmitter).emit("data", Buffer.from(resultLine + "\n"));
    proc.emit("close", 0);

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.response).toBe("done");
  });

  it("extracts assistant text from stream when no result event", async () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess);

    const promise = agent.spawnClaudeCode("prompt", "system", "/tmp/mcp.json");
    const assistantLine = JSON.stringify({
      type: "assistant",
      message: { content: [{ text: "assistant says hi" }] },
    });
    (proc.stdout as EventEmitter).emit("data", Buffer.from(assistantLine + "\n"));
    proc.emit("close", 0);

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.response).toBe("assistant says hi");
  });

  it("resolves with failure when claude exits non-zero", async () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess);

    const promise = agent.spawnClaudeCode("prompt", "system", "/tmp/mcp.json");
    (proc.stderr as EventEmitter).emit("data", Buffer.from("error text"));
    proc.emit("close", 1);

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.response).toContain("error text");
  });

  it("resolves with failure on spawn error", async () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess);

    const promise = agent.spawnClaudeCode("prompt", "system", "/tmp/mcp.json");
    proc.emit("error", new Error("ENOENT"));

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.response).toContain("ENOENT");
  });

  it("records tool_use events and sets codeUpdated for codespace_update", async () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess);

    const promise = agent.spawnClaudeCode("prompt", "system", "/tmp/mcp.json");
    const toolEvent = JSON.stringify({
      type: "tool_use",
      name: "mcp__spike-land__codespace_update",
      input: { codespace_id: "space-abc" },
    });
    (proc.stdout as EventEmitter).emit("data", Buffer.from(toolEvent + "\n"));
    proc.emit("close", 0);

    const result = await promise;
    expect(result.codeUpdated).toBe(true);
    expect(result.codespaceId).toBe("space-abc");
    expect(result.toolCalls).toContain("mcp__spike-land__codespace_update");
  });

  it("sets codeUpdated for codespace_run tool", async () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess);

    const promise = agent.spawnClaudeCode("prompt", "system", "/tmp/mcp.json");
    const toolEvent = JSON.stringify({
      type: "tool_use",
      name: "mcp__spike-land__codespace_run",
    });
    (proc.stdout as EventEmitter).emit("data", Buffer.from(toolEvent + "\n"));
    proc.emit("close", 0);

    const result = await promise;
    expect(result.codeUpdated).toBe(true);
  });

  it("sets codeUpdated for codespace_link tool", async () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess);

    const promise = agent.spawnClaudeCode("prompt", "system", "/tmp/mcp.json");
    const toolEvent = JSON.stringify({
      type: "tool_use",
      name: "mcp__spike-land__codespace_link",
    });
    (proc.stdout as EventEmitter).emit("data", Buffer.from(toolEvent + "\n"));
    proc.emit("close", 0);

    const result = await promise;
    expect(result.codeUpdated).toBe(true);
  });

  it("does not set codeUpdated for unrelated tool names", async () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess);

    const promise = agent.spawnClaudeCode("prompt", "system", "/tmp/mcp.json");
    const toolEvent = JSON.stringify({
      type: "tool_use",
      name: "some_other_tool",
    });
    (proc.stdout as EventEmitter).emit("data", Buffer.from(toolEvent + "\n"));
    proc.emit("close", 0);

    const result = await promise;
    expect(result.codeUpdated).toBe(false);
    expect(result.toolCalls).toContain("some_other_tool");
  });

  it("ignores malformed JSON lines in stdout", async () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess);

    const promise = agent.spawnClaudeCode("prompt", "system", "/tmp/mcp.json");
    (proc.stdout as EventEmitter).emit(
      "data",
      Buffer.from('not json\n{"type":"result","result":"ok"}\n'),
    );
    proc.emit("close", 0);

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.response).toBe("ok");
  });

  it("handles Claude CLI timeout", async () => {
    vi.useFakeTimers();
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess);

    const promise = agent.spawnClaudeCode("prompt", "system", "/tmp/mcp.json");

    // Advance time beyond CLAUDE_TIMEOUT_MS (300000)
    await vi.advanceTimersByTimeAsync(300001);

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toBe("timeout");
    expect(proc.kill).toHaveBeenCalledWith("SIGTERM");
    vi.useRealTimers();
  });

  it("handles error during spawnClaudeCode", async () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess);

    const promise = agent.spawnClaudeCode("prompt", "system", "/tmp/mcp.json");
    proc.emit("error", new Error("Spawn error"));

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toBe("Spawn error");
  });
});

// ---------------------------------------------------------------------------
// processMessage
// ---------------------------------------------------------------------------

describe("processMessage", () => {
  const mockApiConfig = { baseUrl: "https://api.example.com", apiKey: "key" };
  const baseContext = {
    app: {
      id: "app1",
      name: "TestApp",
      status: "active",
      codespaceId: null as string | null,
      codespaceUrl: null as string | null,
      description: "desc",
    },
    chatHistory: [
      {
        id: "msg1",
        role: "USER" as const,
        content: "Hello",
        createdAt: "2024-01-01",
        attachments: [],
      },
    ],
  };

  beforeEach(() => {
    vi.mocked(api.markMessageRead).mockResolvedValue(undefined as never);
    vi.mocked(api.postAgentResponse).mockResolvedValue({} as never);
    vi.mocked(api.updateApp).mockResolvedValue({} as never);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(rm).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns error when message id not found in context", async () => {
    const result = await agent.processMessage(
      mockApiConfig,
      "app1",
      "nonexistent",
      baseContext as never,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Message not found in context");
  });

  it("processes E2E_TEST_ECHO keyword and returns success", async () => {
    const context = {
      ...baseContext,
      chatHistory: [
        {
          id: "msg1",
          role: "USER" as const,
          content: "E2E_TEST_ECHO:ping",
          createdAt: "2024-01-01",
          attachments: [],
        },
      ],
    };

    const result = await agent.processMessage(mockApiConfig, "app1", "msg1", context as never);

    expect(result.success).toBe(true);
    expect(result.agentMessage).toBe("ECHO: ping");
    expect(api.postAgentResponse).toHaveBeenCalledWith(
      mockApiConfig,
      "app1",
      expect.objectContaining({ content: "ECHO: ping" }),
    );
  });

  it("processes E2E_TEST_ERROR keyword and returns failure without posting", async () => {
    const context = {
      ...baseContext,
      chatHistory: [
        {
          id: "msg1",
          role: "USER" as const,
          content: "E2E_TEST_ERROR",
          createdAt: "2024-01-01",
          attachments: [],
        },
      ],
    };

    const result = await agent.processMessage(mockApiConfig, "app1", "msg1", context as never);

    expect(result.success).toBe(false);
    expect(result.error).toBe("E2E_TEST_ERROR triggered");
  });

  it("updates app codespace when E2E keyword returns codespaceId", async () => {
    const context = {
      ...baseContext,
      chatHistory: [
        {
          id: "msg1",
          role: "USER" as const,
          content: "E2E_TEST_CODE_UPDATE",
          createdAt: "2024-01-01",
          attachments: [],
        },
      ],
    };

    await agent.processMessage(mockApiConfig, "app1", "msg1", context as never);

    expect(api.updateApp).toHaveBeenCalledWith(
      mockApiConfig,
      "app1",
      expect.objectContaining({ codespaceId: "e2e-test-app1" }),
    );
  });

  it("processes claude CLI path and resolves via spawn success", async () => {
    const proc = makeMockProcess();
    const resultLine = JSON.stringify({ type: "result", result: "code done" });
    // Use mockImplementation so close fires after spawnClaudeCode attaches its listeners
    vi.mocked(spawn).mockImplementation(() => {
      setImmediate(() => {
        (proc.stdout as EventEmitter).emit("data", Buffer.from(resultLine + "\n"));
        proc.emit("close", 0);
      });
      return proc as unknown as ChildProcess;
    });

    const context = {
      ...baseContext,
      app: { ...baseContext.app, codespaceId: null },
    };

    const result = await agent.processMessage(mockApiConfig, "app1", "msg1", context as never);
    expect(result.success).toBe(true);
    expect(result.agentMessage).toBe("code done");
  });

  it("handles cleanup error (non-Error value) in processMessage", async () => {
    // Force rm to throw a non-Error value — covers the String(err) branch in cleanupMcpConfig
    vi.mocked(rm).mockRejectedValue("plain cleanup error");

    const proc = makeMockProcess();
    vi.mocked(spawn).mockImplementation(() => {
      setImmediate(() => {
        (proc.stdout as EventEmitter).emit(
          "data",
          Buffer.from(JSON.stringify({ type: "result", result: "ok" }) + "\n"),
        );
        proc.emit("close", 0);
      });
      return proc as unknown as ChildProcess;
    });

    const result = await agent.processMessage(mockApiConfig, "app1", "msg1", baseContext as never);
    expect(result.success).toBe(true);
    expect(rm).toHaveBeenCalled();
  });

  it("handles cleanup error in processMessage", async () => {
    // Force rm to fail
    vi.mocked(rm).mockRejectedValue(new Error("RM failed"));

    const proc = makeMockProcess();
    vi.mocked(spawn).mockImplementation(() => {
      setImmediate(() => {
        (proc.stdout as EventEmitter).emit(
          "data",
          Buffer.from(JSON.stringify({ type: "result", result: "ok" }) + "\n"),
        );
        proc.emit("close", 0);
      });
      return proc as unknown as ChildProcess;
    });

    const result = await agent.processMessage(mockApiConfig, "app1", "msg1", baseContext as never);
    expect(result.success).toBe(true);
    // Even if cleanup fails, processMessage succeeds
    expect(rm).toHaveBeenCalled();
  });

  it("returns failure when claude exits non-zero", async () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockImplementation(() => {
      setImmediate(() => {
        (proc.stderr as EventEmitter).emit("data", Buffer.from("claude failed"));
        proc.emit("close", 2);
      });
      return proc as unknown as ChildProcess;
    });

    const context = {
      ...baseContext,
      app: { ...baseContext.app, codespaceId: null },
    };

    const result = await agent.processMessage(mockApiConfig, "app1", "msg1", context as never);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// processApp
// ---------------------------------------------------------------------------

describe("processApp", () => {
  const mockRedisConfig = { url: "redis://localhost" };
  const mockApiConfig = { baseUrl: "https://api.example.com", apiKey: "key" };

  beforeEach(() => {
    vi.mocked(redis.setAgentWorking).mockResolvedValue(undefined as never);
    vi.mocked(redis.getAppsWithPending).mockResolvedValue([]);
    vi.mocked(redis.dequeueMessage).mockResolvedValue(null as never);
    vi.mocked(api.getAppContext).mockResolvedValue({
      app: {
        id: "app1",
        name: "App",
        status: "active",
        codespaceId: null,
        codespaceUrl: null,
        description: null,
      },
      chatHistory: [],
    } as never);
    vi.mocked(api.postAgentResponse).mockResolvedValue({} as never);
    vi.mocked(api.markMessageRead).mockResolvedValue(undefined as never);
    vi.mocked(api.updateApp).mockResolvedValue({} as never);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(rm).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns 0 when no messages queued", async () => {
    const count = await agent.processApp(mockRedisConfig as never, mockApiConfig, "app1");
    expect(count).toBe(0);
    expect(redis.setAgentWorking).toHaveBeenCalledWith(mockRedisConfig, "app1", true);
    expect(redis.setAgentWorking).toHaveBeenCalledWith(mockRedisConfig, "app1", false);
  });

  it("processes E2E messages and returns correct count", async () => {
    vi.mocked(redis.dequeueMessage)
      .mockResolvedValueOnce("msg1" as never)
      .mockResolvedValueOnce(null as never);
    vi.mocked(api.getAppContext).mockResolvedValue({
      app: {
        id: "app1",
        name: "App",
        status: "active",
        codespaceId: null,
        codespaceUrl: null,
        description: null,
      },
      chatHistory: [
        {
          id: "msg1",
          role: "USER",
          content: "E2E_TEST_ECHO:hi",
          createdAt: "2024-01-01",
          attachments: [],
        },
      ],
    } as never);

    const count = await agent.processApp(mockRedisConfig as never, mockApiConfig, "app1");
    expect(count).toBe(1);
  });

  it("posts error message when processMessage returns failure and continues", async () => {
    vi.mocked(redis.dequeueMessage)
      .mockResolvedValueOnce("msg-missing" as never)
      .mockResolvedValueOnce(null as never);
    // empty chatHistory → message not found → success: false

    const count = await agent.processApp(mockRedisConfig as never, mockApiConfig, "app1");
    expect(count).toBe(0);
    expect(api.postAgentResponse).toHaveBeenCalledWith(
      mockApiConfig,
      "app1",
      expect.objectContaining({
        content: expect.stringContaining("Error processing message"),
      }),
    );
  });

  it("sets agent working false even when getAppContext throws", async () => {
    vi.mocked(api.getAppContext).mockRejectedValue(new Error("API down"));

    await expect(agent.processApp(mockRedisConfig as never, mockApiConfig, "app1")).rejects.toThrow(
      "API down",
    );

    expect(redis.setAgentWorking).toHaveBeenCalledWith(mockRedisConfig, "app1", false);
  });

  it("logs currentMessageId in error message when it was set before failure", async () => {
    vi.mocked(redis.dequeueMessage)
      .mockResolvedValueOnce("msg1" as never)
      .mockRejectedValueOnce(new Error("redis failed"));

    vi.mocked(api.getAppContext).mockResolvedValue({
      app: {
        id: "app1",
        name: "App",
        status: "active",
        codespaceId: null,
        codespaceUrl: null,
        description: null,
      },
      chatHistory: [
        {
          id: "msg1",
          role: "USER",
          content: "E2E_TEST_ECHO:hi",
          createdAt: "2024-01-01",
          attachments: [],
        },
      ],
    } as never);

    await expect(agent.processApp(mockRedisConfig as never, mockApiConfig, "app1")).rejects.toThrow(
      "redis failed",
    );

    expect(redis.setAgentWorking).toHaveBeenCalledWith(mockRedisConfig, "app1", false);
  });
});

// ---------------------------------------------------------------------------
// poll
// ---------------------------------------------------------------------------

describe("poll", () => {
  const mockRedisConfig = { url: "redis://localhost" };
  const mockApiConfig = { baseUrl: "https://api.example.com", apiKey: "key" };

  beforeEach(() => {
    vi.mocked(redis.getAppsWithPending).mockResolvedValue([]);
    vi.mocked(redis.setAgentWorking).mockResolvedValue(undefined as never);
    vi.mocked(redis.dequeueMessage).mockResolvedValue(null as never);
    vi.mocked(api.getAppContext).mockResolvedValue({
      app: {
        id: "app1",
        name: "App",
        status: "active",
        codespaceId: null,
        codespaceUrl: null,
        description: null,
      },
      chatHistory: [],
    } as never);
    vi.mocked(api.postAgentResponse).mockResolvedValue({} as never);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(rm).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns 0 when no apps have pending messages", async () => {
    const total = await agent.poll(mockRedisConfig as never, mockApiConfig);
    expect(total).toBe(0);
  });

  it("processes all apps and sums message counts", async () => {
    vi.mocked(redis.getAppsWithPending).mockResolvedValue(["app1", "app2"] as never);

    const total = await agent.poll(mockRedisConfig as never, mockApiConfig);
    expect(total).toBe(0); // both apps have empty queues
    expect(redis.setAgentWorking).toHaveBeenCalledTimes(4); // true+false x 2
  });

  it("continues processing remaining apps when one throws", async () => {
    vi.mocked(redis.getAppsWithPending).mockResolvedValue(["app-fail", "app2"] as never);
    vi.mocked(api.getAppContext)
      .mockRejectedValueOnce(new Error("Context error"))
      .mockResolvedValue({
        app: {
          id: "app2",
          name: "App2",
          status: "active",
          codespaceId: null,
          codespaceUrl: null,
          description: null,
        },
        chatHistory: [],
      } as never);

    const total = await agent.poll(mockRedisConfig as never, mockApiConfig);
    expect(total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// processMessage additional branches
// ---------------------------------------------------------------------------

describe("processMessage additional paths", () => {
  const mockApiConfig = { baseUrl: "https://api.example.com", apiKey: "key" };
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    vi.mocked(api.markMessageRead).mockResolvedValue(undefined as never);
    vi.mocked(api.postAgentResponse).mockResolvedValue({} as never);
    vi.mocked(api.updateApp).mockResolvedValue({} as never);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(rm).mockResolvedValue(undefined);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue("const x = 1;" as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it("catches downloadCodeToLocal error and continues processing", async () => {
    // downloadCodeToLocal will throw (fetch fails)
    mockFetch.mockRejectedValueOnce(new Error("Network error")); // for downloadCodeToLocal
    // createTempMcpConfig won't use fetch, spawnClaudeCode result

    const proc = makeMockProcess();
    vi.mocked(spawn).mockImplementation(() => {
      setImmediate(() => {
        (proc.stdout as EventEmitter).emit(
          "data",
          Buffer.from(JSON.stringify({ type: "result", result: "done" }) + "\n"),
        );
        proc.emit("close", 0);
      });
      return proc as unknown as ChildProcess;
    });

    const context = {
      app: {
        id: "app1",
        name: "App",
        status: "active",
        codespaceId: "existing-space",
        codespaceUrl: null,
        description: null,
      },
      chatHistory: [
        {
          id: "msg1",
          role: "USER" as const,
          content: "Hello",
          createdAt: "2024-01-01",
          attachments: [],
        },
      ],
    };

    const result = await agent.processMessage(mockApiConfig, "app1", "msg1", context as never);
    // Should still succeed even though local file download failed
    expect(result.success).toBe(true);
  });

  it("updates codespaceId when claude returns new codespaceId", async () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockImplementation(() => {
      setImmediate(() => {
        const toolEvent = JSON.stringify({
          type: "tool_use",
          name: "mcp__spike-land__codespace_update",
          input: { codespace_id: "new-space-123" },
        });
        const resultLine = JSON.stringify({ type: "result", result: "created codespace" });
        (proc.stdout as EventEmitter).emit(
          "data",
          Buffer.from(toolEvent + "\n" + resultLine + "\n"),
        );
        proc.emit("close", 0);
      });
      return proc as unknown as ChildProcess;
    });

    const context = {
      app: {
        id: "app1",
        name: "App",
        status: "active",
        codespaceId: null as string | null,
        codespaceUrl: null,
        description: null,
      },
      chatHistory: [
        {
          id: "msg1",
          role: "USER" as const,
          content: "Create a new app",
          createdAt: "2024-01-01",
          attachments: [],
        },
      ],
    };

    const result = await agent.processMessage(mockApiConfig, "app1", "msg1", context as never);
    expect(result.success).toBe(true);
    expect(api.updateApp).toHaveBeenCalledWith(
      mockApiConfig,
      "app1",
      expect.objectContaining({ codespaceId: "new-space-123" }),
    );
    expect(result.codespaceId).toBe("new-space-123");
  });

  it("syncs final code to server when localFilePath and codespaceId set", async () => {
    // Make download succeed so localFilePath is set
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: "const x = 1;" }),
    });

    const proc = makeMockProcess();
    vi.mocked(spawn).mockImplementation(() => {
      setImmediate(() => {
        const resultLine = JSON.stringify({ type: "result", result: "done" });
        (proc.stdout as EventEmitter).emit("data", Buffer.from(resultLine + "\n"));
        proc.emit("close", 0);
      });
      return proc as unknown as ChildProcess;
    });

    // Mock syncCodeToServer (it uses fetch internally)
    mockFetch.mockResolvedValue({ ok: true });

    const context = {
      app: {
        id: "app1",
        name: "App",
        status: "active",
        codespaceId: "existing-space",
        codespaceUrl: null,
        description: null,
      },
      chatHistory: [
        {
          id: "msg1",
          role: "USER" as const,
          content: "Update code",
          createdAt: "2024-01-01",
          attachments: [],
        },
      ],
    };

    const result = await agent.processMessage(mockApiConfig, "app1", "msg1", context as never);
    expect(result.success).toBe(true);
    // readFile should have been called for the final sync
    expect(readFile).toHaveBeenCalled();
  });

  it("handles final sync error gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: "const x = 1;" }),
    });

    const proc = makeMockProcess();
    vi.mocked(spawn).mockImplementation(() => {
      setImmediate(() => {
        const resultLine = JSON.stringify({ type: "result", result: "done" });
        (proc.stdout as EventEmitter).emit("data", Buffer.from(resultLine + "\n"));
        proc.emit("close", 0);
      });
      return proc as unknown as ChildProcess;
    });

    // Make readFile throw so the final sync try-catch catches it
    vi.mocked(readFile).mockRejectedValue(new Error("File read failed"));

    const context = {
      app: {
        id: "app1",
        name: "App",
        status: "active",
        codespaceId: "existing-space",
        codespaceUrl: null,
        description: null,
      },
      chatHistory: [
        {
          id: "msg1",
          role: "USER" as const,
          content: "Update code",
          createdAt: "2024-01-01",
          attachments: [],
        },
      ],
    };

    const result = await agent.processMessage(mockApiConfig, "app1", "msg1", context as never);
    // Should succeed even if final sync fails
    expect(result.success).toBe(true);
  });

  it("handles non-Error thrown in final sync (String fallback)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: "const x = 1;" }),
    });

    const proc = makeMockProcess();
    vi.mocked(spawn).mockImplementation(() => {
      setImmediate(() => {
        const resultLine = JSON.stringify({ type: "result", result: "done" });
        (proc.stdout as EventEmitter).emit("data", Buffer.from(resultLine + "\n"));
        proc.emit("close", 0);
      });
      return proc as unknown as ChildProcess;
    });

    // Make readFile throw a non-Error value
    vi.mocked(readFile).mockRejectedValue("plain string error");

    const context = {
      app: {
        id: "app1",
        name: "App",
        status: "active",
        codespaceId: "existing-space",
        codespaceUrl: null,
        description: null,
      },
      chatHistory: [
        {
          id: "msg1",
          role: "USER" as const,
          content: "Update code",
          createdAt: "2024-01-01",
          attachments: [],
        },
      ],
    };

    const result = await agent.processMessage(mockApiConfig, "app1", "msg1", context as never);
    expect(result.success).toBe(true);
  });

  it("handles result.error being undefined (uses response as error)", async () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockImplementation(() => {
      setImmediate(() => {
        // Exit non-zero with no stderr (so errorOutput is empty, error field is empty string)
        proc.emit("close", 1);
      });
      return proc as unknown as ChildProcess;
    });

    const context = {
      app: {
        id: "app1",
        name: "App",
        status: "active",
        codespaceId: null as string | null,
        codespaceUrl: null,
        description: null,
      },
      chatHistory: [
        {
          id: "msg1",
          role: "USER" as const,
          content: "Do something",
          createdAt: "2024-01-01",
          attachments: [],
        },
      ],
    };

    const result = await agent.processMessage(mockApiConfig, "app1", "msg1", context as never);
    expect(result.success).toBe(false);
    // When error is empty string, error || response gives response
    expect(result.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// cleanupMcpConfig non-Error branch and SKIP_PERMISSIONS branch
// ---------------------------------------------------------------------------

describe("spawnClaudeCode AGENT_REQUIRE_PERMISSIONS branch", () => {
  beforeEach(() => {
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(rm).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.AGENT_REQUIRE_PERMISSIONS;
  });

  it("includes --dangerously-skip-permissions when not required (default)", async () => {
    delete process.env.AGENT_REQUIRE_PERMISSIONS;
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as unknown as ReturnType<typeof spawn>);

    const promise = agent.spawnClaudeCode("prompt", "system", "/tmp/mcp.json");
    proc.emit("close", 0);
    await promise;

    expect(spawn).toHaveBeenCalledWith(
      "claude",
      expect.arrayContaining(["--dangerously-skip-permissions"]),
      expect.any(Object),
    );
  });

  it("omits --dangerously-skip-permissions when AGENT_REQUIRE_PERMISSIONS=true", async () => {
    // SKIP_PERMISSIONS is computed at module level, so we need a fresh module import
    vi.resetModules();
    process.env.AGENT_REQUIRE_PERMISSIONS = "true";

    const freshAgent = await import("../../../src/cli/docker-dev/node-sys/agent.js");
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as unknown as ReturnType<typeof spawn>);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const promise = freshAgent.spawnClaudeCode("prompt", "system", "/tmp/mcp.json");
    proc.emit("close", 0);
    await promise;

    const callArgs = vi.mocked(spawn).mock.calls[0]![1] as string[];
    expect(callArgs).not.toContain("--dangerously-skip-permissions");

    delete process.env.AGENT_REQUIRE_PERMISSIONS;
    vi.resetModules();
  });
});

describe("processMessage mcpConfigPath false branch and codespace_update without codespace_id", () => {
  const mockApiConfig = { baseUrl: "https://api.example.com", apiKey: "key" };

  beforeEach(() => {
    vi.mocked(api.markMessageRead).mockResolvedValue(undefined as never);
    vi.mocked(api.postAgentResponse).mockResolvedValue({} as never);
    vi.mocked(api.updateApp).mockResolvedValue({} as never);
    vi.mocked(rm).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("skips cleanup when mcpConfigPath is null (mkdir throws before assignment)", async () => {
    // When mkdir (used inside createTempMcpConfig) throws, mcpConfigPath stays null
    // The error propagates from processMessage (no try/catch wrapping createTempMcpConfig)
    vi.mocked(mkdir).mockRejectedValue(new Error("mkdir failed"));
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const context = {
      app: {
        id: "app1",
        name: "App",
        status: "active",
        codespaceId: null as string | null,
        codespaceUrl: null,
        description: null,
      },
      chatHistory: [
        {
          id: "msg1",
          role: "USER" as const,
          content: "Hello",
          createdAt: "2024-01-01",
          attachments: [],
        },
      ],
    };

    // createTempMcpConfig throws, so processMessage throws too (mcpConfigPath stays null)
    await expect(
      agent.processMessage(mockApiConfig, "app1", "msg1", context as never),
    ).rejects.toThrow("mkdir failed");
    // rm should NOT have been called since mcpConfigPath was never set
    expect(rm).not.toHaveBeenCalled();
  });

  it("sets codeUpdated when codespace_update called without codespace_id in input", async () => {
    const proc = makeMockProcess();
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(spawn).mockImplementation(() => {
      setImmediate(() => {
        // codespace_update without codespace_id field - covers the false branch of if(event.input?.codespace_id)
        const toolEvent = JSON.stringify({
          type: "tool_use",
          name: "mcp__spike-land__codespace_update",
          input: {},
        });
        const resultLine = JSON.stringify({ type: "result", result: "updated" });
        (proc.stdout as EventEmitter).emit(
          "data",
          Buffer.from(toolEvent + "\n" + resultLine + "\n"),
        );
        proc.emit("close", 0);
      });
      return proc as unknown as ReturnType<typeof spawn>;
    });

    const context = {
      app: {
        id: "app1",
        name: "App",
        status: "active",
        codespaceId: null as string | null,
        codespaceUrl: null,
        description: null,
      },
      chatHistory: [
        {
          id: "msg1",
          role: "USER" as const,
          content: "Update the app",
          createdAt: "2024-01-01",
          attachments: [],
        },
      ],
    };

    const result = await agent.processMessage(mockApiConfig, "app1", "msg1", context as never);
    expect(result.success).toBe(true);
    expect(result.codeUpdated).toBe(true);
    // codespaceId should be undefined since it wasn't provided
    expect(result.codespaceId).toBeUndefined();
  });
});

describe("processApp non-Error thrown branch", () => {
  const mockRedisConfig = { url: "redis://localhost" };
  const mockApiConfig = { baseUrl: "https://api.example.com", apiKey: "key" };

  beforeEach(() => {
    vi.mocked(redis.setAgentWorking).mockResolvedValue(undefined as never);
    vi.mocked(redis.dequeueMessage).mockResolvedValue(null as never);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(rm).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("uses 'Unknown error' string when non-Error is thrown", async () => {
    vi.mocked(api.getAppContext).mockRejectedValue("plain string, not Error");

    await expect(agent.processApp(mockRedisConfig as never, mockApiConfig, "app1")).rejects.toBe(
      "plain string, not Error",
    );

    expect(redis.setAgentWorking).toHaveBeenCalledWith(mockRedisConfig, "app1", false);
  });
});
