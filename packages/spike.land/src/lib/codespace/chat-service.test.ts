import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/claude-client", () => ({
  getClaudeClient: vi.fn(),
}));

vi.mock("@/lib/codespace/session-service", () => ({
  getOrCreateSession: vi.fn(),
  upsertSession: vi.fn(),
}));

vi.mock("@/lib/codespace/transpile", () => ({
  transpileCode: vi.fn(),
}));

import {
  buildSystemPrompt,
  CODESPACE_TOOLS,
  DEFAULT_MODEL,
  executeTool,
  MAX_MESSAGES_COUNT,
  MAX_TOKENS,
  MAX_TOOL_ITERATIONS,
  sseEvent,
  SYSTEM_PROMPT,
  VALID_ROLES,
  validateMessages,
} from "./chat-service";

describe("chat-service constants", () => {
  it("should export MAX_MESSAGES_COUNT as 100", () => {
    expect(MAX_MESSAGES_COUNT).toBe(100);
  });

  it("should export MAX_TOOL_ITERATIONS as 10", () => {
    expect(MAX_TOOL_ITERATIONS).toBe(10);
  });

  it("should export a valid default model", () => {
    expect(DEFAULT_MODEL).toBe("claude-sonnet-4-6");
  });

  it("should export MAX_TOKENS as 16384", () => {
    expect(MAX_TOKENS).toBe(16384);
  });

  it("should have user and assistant as valid roles", () => {
    expect(VALID_ROLES.has("user")).toBe(true);
    expect(VALID_ROLES.has("assistant")).toBe(true);
    expect(VALID_ROLES.has("system")).toBe(false);
  });
});

describe("CODESPACE_TOOLS", () => {
  it("should define 5 tools", () => {
    expect(CODESPACE_TOOLS).toHaveLength(5);
  });

  it("should include all expected tool names", () => {
    const names = CODESPACE_TOOLS.map((t) => t.name);
    expect(names).toContain("read_code");
    expect(names).toContain("update_code");
    expect(names).toContain("edit_code");
    expect(names).toContain("search_and_replace");
    expect(names).toContain("find_lines");
  });

  it("should have input_schema for each tool", () => {
    for (const tool of CODESPACE_TOOLS) {
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe("object");
    }
  });
});

describe("validateMessages", () => {
  it("should accept valid user messages", () => {
    const result = validateMessages([{ role: "user", content: "Hello" }]);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]!.role).toBe("user");
      expect(result.messages[0]!.content).toBe("Hello");
    }
  });

  it("should accept mixed user and assistant messages", () => {
    const result = validateMessages([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
    ]);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.messages).toHaveLength(2);
    }
  });

  it("should reject null input", () => {
    const result = validateMessages(null);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("non-empty array");
    }
  });

  it("should reject empty array", () => {
    const result = validateMessages([]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("empty");
    }
  });

  it("should reject too many messages", () => {
    const messages = Array.from({ length: 101 }, (_, i) => ({
      role: "user",
      content: `Message ${i}`,
    }));
    const result = validateMessages(messages);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("Too many messages");
    }
  });

  it("should reject invalid role", () => {
    const result = validateMessages([{ role: "system", content: "test" }]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("invalid role");
    }
  });

  it("should reject non-object message", () => {
    const result = validateMessages(["hello"]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("must be an object");
    }
  });

  it("should reject message without content or parts", () => {
    const result = validateMessages([{ role: "user" }]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("string 'content' or 'parts' array");
    }
  });

  it("should extract text from parts array", () => {
    const result = validateMessages([
      {
        role: "user",
        parts: [
          { type: "text", text: "Hello " },
          { type: "text", text: "world" },
        ],
      },
    ]);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.messages[0]!.content).toBe("Hello world");
    }
  });
});

describe("buildSystemPrompt", () => {
  it("should include the base system prompt", () => {
    const prompt = buildSystemPrompt("my-space", "const x = 1;");
    expect(prompt).toContain(SYSTEM_PROMPT.slice(0, 50));
  });

  it("should include the codeSpace name", () => {
    const prompt = buildSystemPrompt("my-space", "const x = 1;");
    expect(prompt).toContain("my-space");
  });

  it("should include the current code", () => {
    const prompt = buildSystemPrompt("test", "function hello() {}");
    expect(prompt).toContain("function hello() {}");
  });
});

describe("sseEvent", () => {
  it("should produce valid SSE format", () => {
    const encoded = sseEvent("chunk", { content: "hello" });
    const text = new TextDecoder().decode(encoded);
    expect(text).toMatch(/^data: /);
    expect(text.endsWith("\n\n")).toBe(true);
    const parsed = JSON.parse(text.replace("data: ", "").trim());
    expect(parsed.type).toBe("chunk");
    expect(parsed.content).toBe("hello");
  });

  it("should merge type with data object", () => {
    const encoded = sseEvent("stage", { stage: "processing" });
    const text = new TextDecoder().decode(encoded);
    const parsed = JSON.parse(text.replace("data: ", "").trim());
    expect(parsed.type).toBe("stage");
    expect(parsed.stage).toBe("processing");
  });
});

describe("executeTool", () => {
  it("should return error for unknown tool", async () => {
    const result = await executeTool("nonexistent_tool", {}, "test-space");
    expect(result).toContain("Unknown tool");
    expect(result).toContain("nonexistent_tool");
  });

  it("should read code from session", async () => {
    const { getOrCreateSession } = await import("./session-service");
    vi.mocked(getOrCreateSession).mockResolvedValue({
      code: "const x = 42;",
      codeSpace: "test",
      html: "",
      css: "",
      transpiled: "",
      messages: [],
    });

    const result = await executeTool("read_code", {}, "test");
    expect(result).toBe("const x = 42;");
  });

  it("should return error when update_code has no code param", async () => {
    const result = await executeTool("update_code", {}, "test");
    expect(result).toContain("'code' parameter is required");
  });

  it("should return error when edit_code has no edits param", async () => {
    const result = await executeTool("edit_code", {}, "test");
    expect(result).toContain("'edits' parameter must be an array");
  });

  it("should return error when search_and_replace has no search", async () => {
    const result = await executeTool("search_and_replace", { replace: "x" }, "test");
    expect(result).toContain("'search' parameter is required");
  });

  it("should return error when search_and_replace has no replace", async () => {
    const result = await executeTool("search_and_replace", { search: "x" }, "test");
    expect(result).toContain("'replace' parameter is required");
  });

  it("should return error when find_lines has no search", async () => {
    const result = await executeTool("find_lines", {}, "test");
    expect(result).toContain("'search' parameter is required");
  });

  it("should find matching lines", async () => {
    const { getOrCreateSession } = await import("./session-service");
    vi.mocked(getOrCreateSession).mockResolvedValue({
      code: "line one\nline two\nline one again",
      codeSpace: "test",
      html: "",
      css: "",
      transpiled: "",
      messages: [],
    });

    const result = await executeTool("find_lines", { search: "one" }, "test");
    expect(result).toContain("lines: 1, 3");
  });

  it("should report no matches for find_lines", async () => {
    const { getOrCreateSession } = await import("./session-service");
    vi.mocked(getOrCreateSession).mockResolvedValue({
      code: "hello world",
      codeSpace: "test",
      html: "",
      css: "",
      transpiled: "",
      messages: [],
    });

    const result = await executeTool("find_lines", { search: "xyz" }, "test");
    expect(result).toContain("No lines found");
  });

  it("should update code successfully", async () => {
    const { getOrCreateSession } = await import("./session-service");
    const { transpileCode } = await import("./transpile");
    vi.mocked(getOrCreateSession).mockResolvedValue({
      code: "old code",
      codeSpace: "test",
      html: "",
      css: "",
      transpiled: "",
      messages: [],
    });
    vi.mocked(transpileCode).mockResolvedValue("transpiled new code");

    const result = await executeTool("update_code", { code: "new code" }, "test");
    expect(result).toBe("success");
  });

  it("should return transpilation error on update_code", async () => {
    const { getOrCreateSession } = await import("./session-service");
    const { transpileCode } = await import("./transpile");
    vi.mocked(getOrCreateSession).mockResolvedValue({
      code: "old code",
      codeSpace: "test",
      html: "",
      css: "",
      transpiled: "",
      messages: [],
    });
    vi.mocked(transpileCode).mockRejectedValue(new Error("Syntax error at line 1"));

    const result = await executeTool("update_code", { code: "bad code{{{" }, "test");
    expect(result).toContain("Transpilation error");
    expect(result).toContain("Syntax error");
  });

  it("should edit code with line edits", async () => {
    const { getOrCreateSession } = await import("./session-service");
    const { transpileCode } = await import("./transpile");
    vi.mocked(getOrCreateSession).mockResolvedValue({
      code: "line1\nline2\nline3",
      codeSpace: "test",
      html: "",
      css: "",
      transpiled: "",
      messages: [],
    });
    vi.mocked(transpileCode).mockResolvedValue("transpiled");

    const result = await executeTool(
      "edit_code",
      { edits: [{ startLine: 2, endLine: 2, content: "replaced" }] },
      "test",
    );
    expect(result).toBe("success");
  });

  it("should return transpilation error on edit_code", async () => {
    const { getOrCreateSession } = await import("./session-service");
    const { transpileCode } = await import("./transpile");
    vi.mocked(getOrCreateSession).mockResolvedValue({
      code: "line1\nline2",
      codeSpace: "test",
      html: "",
      css: "",
      transpiled: "",
      messages: [],
    });
    vi.mocked(transpileCode).mockRejectedValue(new Error("Edit transpile error"));

    const result = await executeTool(
      "edit_code",
      { edits: [{ startLine: 1, endLine: 1, content: "bad{{{" }] },
      "test",
    );
    expect(result).toContain("Transpilation error");
  });

  it("should search and replace with string pattern", async () => {
    const { getOrCreateSession } = await import("./session-service");
    const { transpileCode } = await import("./transpile");
    vi.mocked(getOrCreateSession).mockResolvedValue({
      code: "const x = 1;",
      codeSpace: "test",
      html: "",
      css: "",
      transpiled: "",
      messages: [],
    });
    vi.mocked(transpileCode).mockResolvedValue("transpiled");

    const result = await executeTool("search_and_replace", { search: "x", replace: "y" }, "test");
    expect(result).toBe("success");
  });

  it("should search and replace with regex", async () => {
    const { getOrCreateSession } = await import("./session-service");
    const { transpileCode } = await import("./transpile");
    vi.mocked(getOrCreateSession).mockResolvedValue({
      code: "const abc = 1; const def = 2;",
      codeSpace: "test",
      html: "",
      css: "",
      transpiled: "",
      messages: [],
    });
    vi.mocked(transpileCode).mockResolvedValue("transpiled");

    const result = await executeTool(
      "search_and_replace",
      { search: "\\bconst\\b", replace: "let", isRegex: true },
      "test",
    );
    expect(result).toBe("success");
  });

  it("should return error for invalid regex in search_and_replace", async () => {
    const { getOrCreateSession } = await import("./session-service");
    vi.mocked(getOrCreateSession).mockResolvedValue({
      code: "test code",
      codeSpace: "test",
      html: "",
      css: "",
      transpiled: "",
      messages: [],
    });

    const result = await executeTool(
      "search_and_replace",
      { search: "[invalid", replace: "x", isRegex: true },
      "test",
    );
    expect(result).toContain("Error: Invalid regex");
  });

  it("should return transpilation error on search_and_replace", async () => {
    const { getOrCreateSession } = await import("./session-service");
    const { transpileCode } = await import("./transpile");
    vi.mocked(getOrCreateSession).mockResolvedValue({
      code: "const x = 1;",
      codeSpace: "test",
      html: "",
      css: "",
      transpiled: "",
      messages: [],
    });
    vi.mocked(transpileCode).mockRejectedValue(new Error("Transpile fail"));

    const result = await executeTool("search_and_replace", { search: "x", replace: "y" }, "test");
    expect(result).toContain("Transpilation error");
  });
});

describe("streamCodespaceChat", () => {
  it("should be exported as a function", async () => {
    const mod = await import("./chat-service");
    expect(typeof mod.streamCodespaceChat).toBe("function");
  });

  it("should return a ReadableStream", async () => {
    const { streamCodespaceChat } = await import("./chat-service");
    const stream = streamCodespaceChat(
      "test-space",
      DEFAULT_MODEL,
      [{ role: "user", content: "hello" }],
      "req-123",
      "system prompt",
    );
    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it("should emit error when claude client is null", async () => {
    const { getClaudeClient } = await import("@/lib/ai/claude-client");
    vi.mocked(getClaudeClient).mockResolvedValue(null as unknown as Anthropic);

    const { streamCodespaceChat } = await import("./chat-service");
    const stream = streamCodespaceChat(
      "test-space",
      DEFAULT_MODEL,
      [{ role: "user", content: "hello" }],
      "req-456",
      "system prompt",
    );

    const reader = stream.getReader();
    const chunks: string[] = [];

    let done = false;
    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) {
        chunks.push(new TextDecoder().decode(value));
      }
    }

    const allText = chunks.join("");
    // Should contain an initialize stage and then an error
    expect(allText).toContain("initialize");
    expect(allText).toContain("error");
  });
});
