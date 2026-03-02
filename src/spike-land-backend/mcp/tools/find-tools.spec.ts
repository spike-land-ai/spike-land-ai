import { describe, expect, it } from "vitest";
import type { ICodeSession } from "@spike-land-ai/code";
import { executeFindLines, findLinesTool, findTools } from "./find-tools";

const createMockSession = (code: string): ICodeSession =>
  ({
    code,
    codeSpace: "test-space",
    html: "",
    css: "",
  }) as unknown as ICodeSession;

describe("find-tools", () => {
  describe("findLinesTool definition", () => {
    it("should have correct name", () => {
      expect(findLinesTool.name).toBe("find_lines");
    });

    it("should have a description", () => {
      expect(findLinesTool.description).toBeTruthy();
    });

    it("should have required codeSpace and pattern fields in inputSchema", () => {
      expect(findLinesTool.inputSchema.required).toContain("codeSpace");
      expect(findLinesTool.inputSchema.required).toContain("pattern");
    });

    it("should export findTools array containing findLinesTool", () => {
      expect(findTools).toContain(findLinesTool);
      expect(findTools.length).toBe(1);
    });
  });

  describe("executeFindLines", () => {
    describe("literal string search", () => {
      it("should find lines containing the literal pattern", () => {
        const session = createMockSession("const foo = 1;\nconst bar = 2;\nconst foo2 = 3;");

        const result = executeFindLines(session, "test-space", "foo", false);

        expect(result.totalMatches).toBe(2);
        expect(result.matches[0].lineNumber).toBe(1);
        expect(result.matches[0].content).toBe("const foo = 1;");
        expect(result.matches[0].matchText).toBe("foo");
        expect(result.matches[1].lineNumber).toBe(3);
      });

      it("should return empty matches when pattern not found", () => {
        const session = createMockSession("const x = 1;\nconst y = 2;");

        const result = executeFindLines(session, "test-space", "notFound", false);

        expect(result.totalMatches).toBe(0);
        expect(result.matches).toHaveLength(0);
      });

      it("should return correct pattern and codeSpace in result", () => {
        const session = createMockSession("hello world");

        const result = executeFindLines(session, "my-space", "hello", false);

        expect(result.pattern).toBe("hello");
        expect(result.codeSpace).toBe("my-space");
        expect(result.isRegex).toBe(false);
      });

      it("should handle empty code", () => {
        const session = createMockSession("");

        const result = executeFindLines(session, "test-space", "foo", false);

        expect(result.totalMatches).toBe(0);
        expect(result.matches).toHaveLength(0);
      });
    });

    describe("regex search", () => {
      it("should find lines matching a regex pattern", () => {
        const session = createMockSession("function foo() {}\nconst bar = 1;\nclass Baz {}");

        const result = executeFindLines(session, "test-space", "^(function|class)", true);

        expect(result.totalMatches).toBe(2);
        expect(result.matches[0].lineNumber).toBe(1);
        expect(result.matches[1].lineNumber).toBe(3);
      });

      it("should capture first match text in regex mode", () => {
        const session = createMockSession("const foo = 42;\nconst bar = 99;");

        const result = executeFindLines(session, "test-space", "\\d+", true);

        expect(result.matches[0].matchText).toBe("42");
        expect(result.matches[1].matchText).toBe("99");
      });

      it("should set isRegex to true in result", () => {
        const session = createMockSession("test line");

        const result = executeFindLines(session, "test-space", "test", true);

        expect(result.isRegex).toBe(true);
      });

      it("should throw an error for invalid regex patterns", () => {
        const session = createMockSession("test line");

        expect(() => executeFindLines(session, "test-space", "[invalid", true)).toThrow(
          "Invalid regex pattern",
        );
      });

      it("should handle multiline code with regex", () => {
        const code = Array.from({ length: 10 }, (_, i) => `line ${i + 1}: value = ${i * 10}`).join(
          "\n",
        );
        const session = createMockSession(code);

        const result = executeFindLines(session, "test-space", "value = [0-9]+0", true);

        // Should match lines 2-10 (value = 10, 20, 30... 90)
        expect(result.totalMatches).toBeGreaterThan(0);
      });
    });

    describe("edge cases", () => {
      it("should handle code with only whitespace lines", () => {
        const session = createMockSession("   \n\t\n  ");

        const result = executeFindLines(session, "test-space", " ", false);

        expect(result.totalMatches).toBeGreaterThan(0);
      });

      it("should handle null/undefined code in session gracefully", () => {
        const session = { code: null } as unknown as ICodeSession;

        const result = executeFindLines(session, "test-space", "anything", false);

        expect(result.totalMatches).toBe(0);
      });
    });
  });
});
