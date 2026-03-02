import { describe, expect, it } from "vitest";
import { applyLineEdits, safeRegExp } from "./line-edits";

describe("safeRegExp", () => {
  it("should create a valid regex from a simple pattern", () => {
    const regex = safeRegExp("hello", "g");
    expect(regex).toBeInstanceOf(RegExp);
    expect("hello world".match(regex)).toHaveLength(1);
  });

  it("should reject patterns exceeding max length", () => {
    const longPattern = "a".repeat(501);
    expect(() => safeRegExp(longPattern)).toThrow("too long");
  });

  it("should accept patterns at max length", () => {
    const maxPattern = "a".repeat(500);
    expect(() => safeRegExp(maxPattern)).not.toThrow();
  });

  it("should reject nested quantifiers (a+)+", () => {
    expect(() => safeRegExp("(a+)+")).toThrow("nested quantifiers");
  });

  it("should reject nested quantifiers (a*)*", () => {
    expect(() => safeRegExp("(a*)*")).toThrow("nested quantifiers");
  });

  it("should allow safe quantifiers", () => {
    const regex = safeRegExp("a+b*c?");
    expect(regex).toBeInstanceOf(RegExp);
  });

  it("should pass through flags", () => {
    const regex = safeRegExp("test", "gi");
    expect(regex.flags).toContain("g");
    expect(regex.flags).toContain("i");
  });
});

describe("applyLineEdits", () => {
  const sampleCode = "line 1\nline 2\nline 3\nline 4\nline 5";

  it("should replace a single line", () => {
    const result = applyLineEdits(sampleCode, [
      { startLine: 2, endLine: 2, newContent: "replaced line 2" },
    ]);
    expect(result.newCode).toBe("line 1\nreplaced line 2\nline 3\nline 4\nline 5");
    expect(result.diff).toContain("-line 2");
    expect(result.diff).toContain("+replaced line 2");
  });

  it("should replace multiple lines", () => {
    const result = applyLineEdits(sampleCode, [
      { startLine: 2, endLine: 3, newContent: "new line" },
    ]);
    expect(result.newCode).toBe("line 1\nnew line\nline 4\nline 5");
  });

  it("should handle multiple non-overlapping edits", () => {
    const result = applyLineEdits(sampleCode, [
      { startLine: 1, endLine: 1, newContent: "first" },
      { startLine: 5, endLine: 5, newContent: "last" },
    ]);
    expect(result.newCode).toBe("first\nline 2\nline 3\nline 4\nlast");
  });

  it("should handle empty newContent (deletion)", () => {
    const result = applyLineEdits(sampleCode, [{ startLine: 3, endLine: 3, newContent: "" }]);
    // Empty newContent produces no replacement lines, so the line is removed
    const lines = result.newCode.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines).toEqual(["line 1", "line 2", "line 4", "line 5"]);
  });

  it("should throw on line numbers less than 1", () => {
    expect(() =>
      applyLineEdits(sampleCode, [{ startLine: 0, endLine: 1, newContent: "x" }]),
    ).toThrow("1-based and positive");
  });

  it("should throw when startLine > endLine", () => {
    expect(() =>
      applyLineEdits(sampleCode, [{ startLine: 3, endLine: 2, newContent: "x" }]),
    ).toThrow("less than or equal to end line");
  });

  it("should throw when endLine exceeds code length", () => {
    expect(() =>
      applyLineEdits(sampleCode, [{ startLine: 1, endLine: 10, newContent: "x" }]),
    ).toThrow("exceeds code length");
  });

  it("should throw on overlapping edits", () => {
    expect(() =>
      applyLineEdits(sampleCode, [
        { startLine: 1, endLine: 3, newContent: "a" },
        { startLine: 2, endLine: 4, newContent: "b" },
      ]),
    ).toThrow("Overlapping edits");
  });

  it("should return 'No changes made' diff when edits array is empty", () => {
    const result = applyLineEdits(sampleCode, []);
    expect(result.newCode).toBe(sampleCode);
    expect(result.diff).toBe("No changes made");
  });

  it("should include context lines in diff output", () => {
    const result = applyLineEdits(sampleCode, [
      { startLine: 3, endLine: 3, newContent: "replaced" },
    ]);
    expect(result.diff).toContain("@@");
    expect(result.diff).toContain("-line 3");
    expect(result.diff).toContain("+replaced");
  });
});
