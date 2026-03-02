import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ICodeSession } from "@/lib/codespace/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpsertSession = vi.fn();
const mockTranspileCode = vi.fn();

vi.mock("@/lib/codespace/session-service", () => ({
  upsertSession: (...args: unknown[]) => mockUpsertSession(...args),
}));

vi.mock("@/lib/codespace/transpile", () => ({
  transpileCode: (...args: unknown[]) => mockTranspileCode(...args),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const {
  executeReadCode,
  executeReadHtml,
  executeReadSession,
  executeUpdateCode,
  executeEditCode,
  executeFindLines,
  executeSearchAndReplace,
} = await import("./executors");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<ICodeSession> = {}): ICodeSession {
  return {
    codeSpace: "test-cs",
    code: 'const hello = "world";\nconst foo = "bar";\nexport default () => <div>Hello</div>;',
    transpiled: "var hello = 'world';",
    html: "<div>Hello</div>",
    css: ".test { color: red; }",
    messages: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCP Tool Executors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTranspileCode.mockResolvedValue("transpiled output");
    mockUpsertSession.mockResolvedValue(undefined);
  });

  // -----------------------------------------------------------------------
  // Read Tools
  // -----------------------------------------------------------------------

  describe("executeReadCode", () => {
    it("should return code and codeSpace", () => {
      const session = makeSession();
      const result = executeReadCode(session, "test-cs");

      expect(result.code).toBe(session.code);
      expect(result.codeSpace).toBe("test-cs");
    });
  });

  describe("executeReadHtml", () => {
    it("should return html and codeSpace", () => {
      const session = makeSession();
      const result = executeReadHtml(session, "test-cs");

      expect(result.html).toBe("<div>Hello</div>");
      expect(result.codeSpace).toBe("test-cs");
    });
  });

  describe("executeReadSession", () => {
    it("should return code, html, css, and codeSpace", () => {
      const session = makeSession();
      const result = executeReadSession(session, "test-cs");

      expect(result.code).toBe(session.code);
      expect(result.html).toBe("<div>Hello</div>");
      expect(result.css).toBe(".test { color: red; }");
      expect(result.codeSpace).toBe("test-cs");
    });
  });

  // -----------------------------------------------------------------------
  // Write Tools
  // -----------------------------------------------------------------------

  describe("executeUpdateCode", () => {
    it("should update code and transpile", async () => {
      const session = makeSession();
      const newCode = "const updated = true;";

      const result = await executeUpdateCode(session, "test-cs", newCode, "https://spike.land");

      expect(result.success).toBe(true);
      expect(result.codeSpace).toBe("test-cs");
      expect(result.requiresTranspilation).toBe(false);
      expect(mockTranspileCode).toHaveBeenCalledWith(newCode, "https://spike.land");
      expect(mockUpsertSession).toHaveBeenCalledWith(
        expect.objectContaining({
          code: newCode,
          transpiled: "transpiled output",
          codeSpace: "test-cs",
        }),
      );
    });

    it("should handle transpilation failure gracefully", async () => {
      mockTranspileCode.mockRejectedValue(new Error("Syntax error"));
      const session = makeSession();

      const result = await executeUpdateCode(
        session,
        "test-cs",
        "broken code (",
        "https://spike.land",
      );

      expect(result.success).toBe(true);
      expect(result.requiresTranspilation).toBe(true);
      expect(result.message).toContain("Transpilation failed");
    });
  });

  describe("executeEditCode", () => {
    it("should apply line edits and transpile", async () => {
      const session = makeSession({
        code: "line1\nline2\nline3",
      });

      const edits = [{ startLine: 2, endLine: 2, newContent: "modified" }];

      const result = await executeEditCode(session, "test-cs", edits, "https://spike.land");

      expect(result.success).toBe(true);
      expect(result.linesChanged).toBe(1);
      expect(mockUpsertSession).toHaveBeenCalledWith(
        expect.objectContaining({
          code: expect.stringContaining("modified"),
        }),
      );
    });
  });

  describe("executeSearchAndReplace", () => {
    it("should replace literal string matches", async () => {
      const session = makeSession({
        code: 'const color = "red";',
      });

      const result = await executeSearchAndReplace(
        session,
        "test-cs",
        "red",
        "blue",
        false,
        true,
        "https://spike.land",
      );

      expect(result.success).toBe(true);
      expect(result.replacements).toBe(1);
      expect(mockUpsertSession).toHaveBeenCalledWith(
        expect.objectContaining({
          code: expect.stringContaining("blue"),
        }),
      );
    });

    it("should replace regex matches", async () => {
      const session = makeSession({
        code: "const a = 1;\nconst b = 2;",
      });

      const result = await executeSearchAndReplace(
        session,
        "test-cs",
        "const (\\w+)",
        "let $1",
        true,
        true,
        "https://spike.land",
      );

      expect(result.success).toBe(true);
      expect(result.replacements).toBe(2);
      expect(result.isRegex).toBe(true);
    });

    it("should report no matches when pattern not found", async () => {
      const session = makeSession({
        code: "const x = 1;",
      });

      const result = await executeSearchAndReplace(
        session,
        "test-cs",
        "nonexistent",
        "replacement",
        false,
        true,
        "https://spike.land",
      );

      expect(result.success).toBe(true);
      expect(result.replacements).toBe(0);
      expect(result.message).toContain("No matches");
      // Should NOT call upsertSession when nothing changed
      expect(mockUpsertSession).not.toHaveBeenCalled();
    });

    it("should handle single (non-global) replacement", async () => {
      const session = makeSession({
        code: "aaa",
      });

      const result = await executeSearchAndReplace(
        session,
        "test-cs",
        "a",
        "b",
        false,
        false,
        "https://spike.land",
      );

      expect(result.success).toBe(true);
      expect(result.replacements).toBe(1);
      expect(mockUpsertSession).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "baa",
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Search Tools
  // -----------------------------------------------------------------------

  describe("executeFindLines", () => {
    it("should find matching lines by literal string", () => {
      const session = makeSession({
        code: "const x = 1;\nlet y = 2;\nconst z = 3;",
      });

      const result = executeFindLines(session, "test-cs", "const", false);

      expect(result.totalMatches).toBe(2);
      expect(result.matches[0]!.lineNumber).toBe(1);
      expect(result.matches[1]!.lineNumber).toBe(3);
    });

    it("should find matching lines by regex", () => {
      const session = makeSession({
        code: "const x = 1;\nlet y = 2;\nvar z = 3;",
      });

      const result = executeFindLines(session, "test-cs", "^(const|var)", true);

      expect(result.totalMatches).toBe(2);
      expect(result.isRegex).toBe(true);
    });

    it("should return zero matches when pattern not found", () => {
      const session = makeSession({
        code: "hello world",
      });

      const result = executeFindLines(session, "test-cs", "nonexistent", false);

      expect(result.totalMatches).toBe(0);
      expect(result.matches).toEqual([]);
    });

    it("should handle empty code", () => {
      const session = makeSession({ code: "" });

      const result = executeFindLines(session, "test-cs", "anything", false);

      expect(result.totalMatches).toBe(0);
    });

    it("should throw on invalid regex", () => {
      const session = makeSession();

      expect(() => executeFindLines(session, "test-cs", "[invalid", true)).toThrow("Invalid regex");
    });
  });
});
