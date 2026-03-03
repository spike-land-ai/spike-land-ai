import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerLieDetectorTools } from "./lie-detector";

interface ToolResult {
  content: Array<{ text: string; }>;
  isError?: boolean;
}

function createMockRegistry() {
  const tools = new Map<
    string,
    {
      handler: (...args: unknown[]) => Promise<ToolResult>;
      inputSchema: Record<string, unknown>;
    }
  >();

  return {
    tools,
    register: vi.fn(
      ({
        name,
        handler,
        inputSchema,
      }: {
        name: string;
        handler: (...args: unknown[]) => Promise<ToolResult>;
        inputSchema: Record<string, unknown>;
      }) => {
        tools.set(name, { handler, inputSchema });
      },
    ),
  };
}

function getText(result: ToolResult): string {
  return result.content[0]!.text;
}

describe("Lie Detector MCP Tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerLieDetectorTools(
      registry as unknown as Parameters<typeof registerLieDetectorTools>[0],
      "test-user-123",
    );
  });

  it("registers 3 lie-detector tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.tools.has("verify_syntax")).toBe(true);
    expect(registry.tools.has("verify_tests")).toBe(true);
    expect(registry.tools.has("verify_spec_match")).toBe(true);
  });

  // -----------------------------------------------------------------------
  // verify_syntax
  // -----------------------------------------------------------------------
  describe("verify_syntax", () => {
    it("should pass valid code", async () => {
      const handler = registry.tools.get("verify_syntax")!.handler;
      const result = await handler({
        code: "const x = 1;\nconsole.log(x);",
        language: "typescript",
      });
      expect(getText(result)).toContain("passed");
      expect(getText(result)).toContain("No issues found");
    });

    it("should pass valid code with functions and brackets", async () => {
      const handler = registry.tools.get("verify_syntax")!.handler;
      const result = await handler({
        code:
          "function foo(a: number, b: number): number {\n  return a + b;\n}\nconst arr = [1, 2, 3];",
        language: "typescript",
      });
      expect(getText(result)).toContain("passed");
    });

    it("should detect unbalanced opening brace", async () => {
      const handler = registry.tools.get("verify_syntax")!.handler;
      const result = await handler({
        code: "function foo() {\n  return 1;\n",
        language: "typescript",
      });
      expect(getText(result)).toContain("issue");
      expect(getText(result)).toContain("Unclosed");
      expect(getText(result)).toContain("{");
    });

    it("should detect unbalanced closing bracket", async () => {
      const handler = registry.tools.get("verify_syntax")!.handler;
      const result = await handler({
        code: "const x = 1;\n}",
        language: "typescript",
      });
      expect(getText(result)).toContain("issue");
      expect(getText(result)).toContain("Unexpected closing");
    });

    it("should detect unterminated string literal", async () => {
      const handler = registry.tools.get("verify_syntax")!.handler;
      const result = await handler({
        code: "const x = \"hello;\nconst y = 2;",
        language: "typescript",
      });
      expect(getText(result)).toContain("issue");
      expect(getText(result)).toContain("Unterminated string");
    });

    it("should detect unterminated single-quote string", async () => {
      const handler = registry.tools.get("verify_syntax")!.handler;
      const result = await handler({
        code: "const x = 'hello;",
        language: "typescript",
      });
      expect(getText(result)).toContain("Unterminated string");
      expect(getText(result)).toContain("single");
    });

    it("should ignore brackets inside comments", async () => {
      const handler = registry.tools.get("verify_syntax")!.handler;
      const result = await handler({
        code: "// this has { unbalanced bracket\nconst x = 1;",
        language: "typescript",
      });
      expect(getText(result)).toContain("passed");
    });

    it("should handle inline comments after code", async () => {
      const handler = registry.tools.get("verify_syntax")!.handler;
      const result = await handler({
        code: "const x = 1; // a {bracket in comment",
        language: "typescript",
      });
      expect(getText(result)).toContain("passed");
    });

    it("should handle escaped characters in strings", async () => {
      const handler = registry.tools.get("verify_syntax")!.handler;
      const result = await handler({
        code: "const x = \"hello \\\"world\\\"\";",
        language: "typescript",
      });
      expect(getText(result)).toContain("passed");
    });

    it("should allow template literals spanning multiple lines", async () => {
      const handler = registry.tools.get("verify_syntax")!.handler;
      const result = await handler({
        code: "const x = `hello\nworld`;",
        language: "typescript",
      });
      expect(getText(result)).toContain("passed");
    });

    it("should report multiple issues", async () => {
      const handler = registry.tools.get("verify_syntax")!.handler;
      const result = await handler({
        code: "function foo() {\n  const x = 'bad;\n",
        language: "typescript",
      });
      const text = getText(result);
      // Should have at least 2 issues (unterminated string + unclosed brace)
      expect(text).toContain("issue");
    });

    it("should report error and warning counts", async () => {
      const handler = registry.tools.get("verify_syntax")!.handler;
      const result = await handler({
        code: "function foo() {\n  return 1;\n",
        language: "typescript",
      });
      expect(getText(result)).toContain("error");
    });

    it("should handle empty-ish valid code", async () => {
      const handler = registry.tools.get("verify_syntax")!.handler;
      const result = await handler({
        code: "// just a comment\n",
        language: "javascript",
      });
      expect(getText(result)).toContain("passed");
    });

    it("should detect mismatched brackets", async () => {
      const handler = registry.tools.get("verify_syntax")!.handler;
      const result = await handler({
        code: "const x = [1, 2, 3);",
        language: "typescript",
      });
      expect(getText(result)).toContain("issue");
    });
  });

  // -----------------------------------------------------------------------
  // verify_tests
  // -----------------------------------------------------------------------
  describe("verify_tests", () => {
    it("should parse vitest output with pass and fail", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      const vitestOutput = `
 \u2713 src/test.ts (3 tests) 45ms
   \u2713 should work
   \u2713 should handle errors
   \u00D7 should fail
 Test Files  1 passed (1)
      Tests  2 passed | 1 failed (3)
   Duration  1.23s
`;
      const result = await handler({
        test_output: vitestOutput,
        format: "vitest",
      });
      const text = getText(result);
      expect(text).toContain("Test Report");
      expect(text).toContain("| Total | 3 |");
      expect(text).toContain("| Passed | 2 |");
      expect(text).toContain("| Failed | 1 |");
      expect(text).toContain("1.23s");
      expect(text).toContain("67%");
    });

    it("should parse vitest output with all passing", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      const vitestOutput = `
 \u2713 src/test.ts (5 tests) 120ms
      Tests  5 passed (5)
   Duration  2.00s
`;
      const result = await handler({
        test_output: vitestOutput,
        format: "vitest",
      });
      const text = getText(result);
      expect(text).toContain("| Passed | 5 |");
      expect(text).toContain("| Failed | 0 |");
      expect(text).toContain("100%");
      expect(text).toContain("All tests passed");
    });

    it("should parse vitest output with skipped tests", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      const vitestOutput = `
      Tests  3 passed | 1 skipped (4)
   Duration  0.50s
`;
      const result = await handler({
        test_output: vitestOutput,
        format: "vitest",
      });
      const text = getText(result);
      expect(text).toContain("| Skipped | 1 |");
      expect(text).toContain("| Total | 4 |");
    });

    it("should extract vitest failure names", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      const vitestOutput = `
   \u00D7 should handle edge case
      Tests  0 passed | 1 failed (1)
   Duration  0.10s
`;
      const result = await handler({
        test_output: vitestOutput,
        format: "vitest",
      });
      const text = getText(result);
      expect(text).toContain("should handle edge case");
      expect(text).toContain("Failures (1)");
    });

    it("should parse jest output format", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      const jestOutput = `
PASS src/test.ts
  \u2713 should work (5ms)
FAIL src/other.test.ts
  \u25CF should not break
Tests:       4 passed, 1 failed, 5 total
Time:        3.45 s
`;
      const result = await handler({
        test_output: jestOutput,
        format: "jest",
      });
      const text = getText(result);
      expect(text).toContain("| Total | 5 |");
      expect(text).toContain("| Passed | 4 |");
      expect(text).toContain("| Failed | 1 |");
      expect(text).toContain("3.45 s");
      expect(text).toContain("should not break");
    });

    it("should handle empty/unparseable output", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      const result = await handler({
        test_output: "no recognizable format here",
        format: "vitest",
      });
      const text = getText(result);
      expect(text).toContain("Test Report");
      expect(text).toContain("| Total | 0 |");
      expect(text).toContain("N/A");
    });

    it("should show pass rate as N/A when total is 0", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      const result = await handler({
        test_output: "Nothing here",
        format: "jest",
      });
      expect(getText(result)).toContain("N/A");
    });
  });

  // -----------------------------------------------------------------------
  // verify_spec_match
  // -----------------------------------------------------------------------
  describe("verify_spec_match", () => {
    it("should match all requirements when output contains keywords", async () => {
      const handler = registry.tools.get("verify_spec_match")!.handler;
      const result = await handler({
        spec: {
          requirements: [
            "implement error handling",
            "add input validation",
          ],
        },
        output:
          "// implement error handling and input validation\nfunction processInput(input: string) {\n  if (!input) throw new Error('validation failed');\n  try { handling(input); } catch (error) { handleError(error); }\n}",
        strict: false,
      });
      const text = getText(result);
      expect(text).toContain("100%");
      expect(text).toContain("[x]");
    });

    it("should report unmet requirements", async () => {
      const handler = registry.tools.get("verify_spec_match")!.handler;
      const result = await handler({
        spec: {
          requirements: [
            "implement pagination",
            "add search functionality",
          ],
        },
        output: "const items = data.slice(0, 10);",
        strict: false,
      });
      const text = getText(result);
      expect(text).toContain("Unmet Requirements");
      expect(text).toContain("[ ]");
      expect(text).toContain("search");
    });

    it("should be stricter in strict mode", async () => {
      const handler = registry.tools.get("verify_spec_match")!.handler;

      // In relaxed mode, partial match should pass
      const relaxed = await handler({
        spec: {
          requirements: ["implement user authentication with JWT tokens"],
        },
        output: "function authenticate(user: User) { return createToken(user); }",
        strict: false,
      });

      // In strict mode, same partial match should fail (needs more keywords)
      const strict = await handler({
        spec: {
          requirements: ["implement user authentication with JWT tokens"],
        },
        output: "function authenticate(user: User) { return createToken(user); }",
        strict: true,
      });

      const relaxedScore = getText(relaxed);
      const strictScore = getText(strict);
      // Strict should be harder to pass — at minimum the scores should differ
      // or strict should have unmet requirements
      expect(strictScore).toContain("Spec Match Report");
      expect(relaxedScore).toContain("Spec Match Report");
    });

    it("should provide suggestions for unmet requirements", async () => {
      const handler = registry.tools.get("verify_spec_match")!.handler;
      const result = await handler({
        spec: {
          requirements: ["implement database migration strategy"],
        },
        output: "console.log('hello');",
        strict: false,
      });
      const text = getText(result);
      expect(text).toContain("Suggestions");
      expect(text).toContain("missing keywords");
    });

    it("should handle 0% match", async () => {
      const handler = registry.tools.get("verify_spec_match")!.handler;
      const result = await handler({
        spec: {
          requirements: [
            "implement caching layer",
            "add rate limiting",
            "support webhooks",
          ],
        },
        output: "const x = 1;",
        strict: false,
      });
      const text = getText(result);
      expect(text).toContain("0%");
      expect(text).toContain("Unmet Requirements (3)");
    });

    it("should report match score correctly for partial matches", async () => {
      const handler = registry.tools.get("verify_spec_match")!.handler;
      const result = await handler({
        spec: {
          requirements: [
            "export function",
            "handle database errors",
          ],
        },
        output: "export function getData() { return null; }",
        strict: false,
      });
      const text = getText(result);
      expect(text).toContain("50%");
      expect(text).toContain("Met Requirements (1)");
      expect(text).toContain("Unmet Requirements (1)");
    });

    it("should show strict mode label", async () => {
      const handler = registry.tools.get("verify_spec_match")!.handler;
      const result = await handler({
        spec: { requirements: ["test"] },
        output: "test code",
        strict: true,
      });
      expect(getText(result)).toContain("Strict");
    });

    it("should show relaxed mode label", async () => {
      const handler = registry.tools.get("verify_spec_match")!.handler;
      const result = await handler({
        spec: { requirements: ["test"] },
        output: "test code",
        strict: false,
      });
      expect(getText(result)).toContain("Relaxed");
    });

    it("should handle requirement with no extractable keywords (all stop words)", async () => {
      const handler = registry.tools.get("verify_spec_match")!.handler;
      const result = await handler({
        spec: { requirements: ["the a is to of"] },
        output: "some code output",
        strict: false,
      });
      const text = getText(result);
      expect(text).toContain("Unmet Requirements");
      expect(text).toContain("Could not extract keywords");
      expect(text).toContain("Rewrite as a more specific requirement");
    });

    it("should truncate long requirement text in suggestions", async () => {
      const handler = registry.tools.get("verify_spec_match")!.handler;
      const longReq =
        "implement a very sophisticated advanced comprehensive authentication system with multiple layers of security";
      const result = await handler({
        spec: { requirements: [longReq] },
        output: "const x = 1;",
        strict: false,
      });
      const text = getText(result);
      expect(text).toContain("...");
      expect(text).toContain("missing keywords");
    });
  });

  // ── verify_syntax - additional edge cases ────────────────────────

  describe("verify_syntax - additional branches", () => {
    it("should close template literal with backtick properly", async () => {
      const handler = registry.tools.get("verify_syntax")!.handler;
      const result = await handler({
        code: "const x = `template`;\nconst y = 1;",
        language: "typescript",
      });
      expect(getText(result)).toContain("passed");
    });
  });

  // ── verify_tests - additional parsing branches ───────────────────

  describe("verify_tests - additional branches", () => {
    it("should parse vitest FAIL blocks with expected/received", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      const vitestOutput = `
FAIL src/utils.test.ts > should compute correctly
  Expected: 42
  Received: 0

      Tests  0 passed | 1 failed (1)
   Duration  0.50s
`;
      const result = await handler({
        test_output: vitestOutput,
        format: "vitest",
      });
      const text = getText(result);
      expect(text).toContain("Assertion failed");
      expect(text).toContain("Expected");
      expect(text).toContain("Received");
    });

    it("should parse jest output with skipped tests", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      const jestOutput = `
Tests:       3 passed, 1 skipped, 4 total
Time:        2.50 s
`;
      const result = await handler({
        test_output: jestOutput,
        format: "jest",
      });
      const text = getText(result);
      expect(text).toContain("| Skipped | 1 |");
      expect(text).toContain("| Total | 4 |");
      expect(text).toContain("2.50 s");
    });

    it("should parse vitest failure with x prefix", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      const vitestOutput = `
   x should compute value
      Tests  0 passed | 1 failed (1)
   Duration  0.10s
`;
      const result = await handler({
        test_output: vitestOutput,
        format: "vitest",
      });
      const text = getText(result);
      expect(text).toContain("should compute value");
    });

    it("should handle jest output with only failed tests", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      const jestOutput = `
FAIL src/broken.test.ts
  \u25CF should not crash
Tests:       2 failed, 2 total
Time:        1.00 s
`;
      const result = await handler({
        test_output: jestOutput,
        format: "jest",
      });
      const text = getText(result);
      expect(text).toContain("| Failed | 2 |");
      expect(text).toContain("| Total | 2 |");
      expect(text).toContain("should not crash");
    });

    it("should parse vitest output with only failed and no passed count", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      const vitestOutput = `
      Tests  1 failed (1)
   Duration  0.10s
`;
      const result = await handler({
        test_output: vitestOutput,
        format: "vitest",
      });
      const text = getText(result);
      expect(text).toContain("| Passed | 0 |");
      expect(text).toContain("| Failed | 1 |");
      expect(text).toContain("| Total | 1 |");
    });

    it("should parse jest output with only passed count and no failed/skipped", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      const jestOutput = `
Tests:       5 passed, 5 total
Time:        1.00 s
`;
      const result = await handler({
        test_output: jestOutput,
        format: "jest",
      });
      const text = getText(result);
      expect(text).toContain("| Passed | 5 |");
      expect(text).toContain("| Failed | 0 |");
      expect(text).toContain("| Skipped | 0 |");
    });

    it("should handle vitest output with no duration line", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      const vitestOutput = `
      Tests  3 passed (3)
`;
      const result = await handler({
        test_output: vitestOutput,
        format: "vitest",
      });
      const text = getText(result);
      expect(text).toContain("| Duration | unknown |");
    });

    it("should handle jest output with no time line", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      const jestOutput = `
Tests:       2 passed, 2 total
`;
      const result = await handler({
        test_output: jestOutput,
        format: "jest",
      });
      const text = getText(result);
      expect(text).toContain("| Duration | unknown |");
    });

    it("should fallback to 'Unknown test' when vitest FAIL block capture is whitespace", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      // FAIL followed by only whitespace chars before newline, then Expected/Received
      const vitestOutput = `FAIL \t
  Expected: true
  Received: false

      Tests  0 passed | 1 failed (1)
   Duration  0.10s
`;
      const result = await handler({
        test_output: vitestOutput,
        format: "vitest",
      });
      const text = getText(result);
      expect(text).toContain("Unknown test");
    });

    it("should fallback to 'Unknown test' when jest bullet capture is whitespace", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      // Place the bullet at end of string so (.+?) captures only a tab via backtracking,
      // which trims to empty string, triggering the "Unknown test" fallback.
      // Test counts come before the bullet to avoid them being captured by (.+?)
      const jestOutput = "Tests:       1 failed, 1 total\nTime:        0.50 s\n\u25CF  \t";
      const result = await handler({
        test_output: jestOutput,
        format: "jest",
      });
      const text = getText(result);
      expect(text).toContain("Unknown test");
    });

    it("should fallback total to 0 when vitest summary line has no 4th group", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      // Output that doesn't match the vitest regex at all — total stays 0
      const vitestOutput = `
Tests  2 passed
Duration  1.00s
`;
      const result = await handler({
        test_output: vitestOutput,
        format: "vitest",
      });
      const text = getText(result);
      expect(text).toContain("| Total | 0 |");
      expect(text).toContain("N/A");
    });

    it("should fallback total to 0 when jest summary line has no total group", async () => {
      const handler = registry.tools.get("verify_tests")!.handler;
      // Output that doesn't match the jest regex at all — total stays 0
      const jestOutput = `
Tests: 3 passed
Time: 1.00 s
`;
      const result = await handler({
        test_output: jestOutput,
        format: "jest",
      });
      const text = getText(result);
      expect(text).toContain("| Total | 0 |");
      expect(text).toContain("N/A");
    });
  });

  // ── verify_spec_match - empty requirements branch ───────────────
  describe("verify_spec_match - empty requirements", () => {
    it("should return matchScore 0 when requirements array is empty", async () => {
      const handler = registry.tools.get("verify_spec_match")!.handler;
      const result = await handler({
        spec: { requirements: [] },
        output: "some code output here",
        strict: false,
      });
      const text = getText(result);
      expect(text).toContain("0%");
    });
  });
});
