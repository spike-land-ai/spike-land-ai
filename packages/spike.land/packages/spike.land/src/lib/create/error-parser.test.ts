import { describe, expect, it } from "vitest";

import {
  categorizeErrorForNote,
  isUnrecoverableError,
  parseTranspileError,
} from "./error-parser";

describe("parseTranspileError", () => {
  it("detects import errors", () => {
    const result = parseTranspileError(
      "Cannot find module 'nonexistent-lib'",
    );
    expect(result.type).toBe("import");
    expect(result.library).toBe("nonexistent-lib");
  });

  it("detects Module not found errors", () => {
    const result = parseTranspileError(
      "Module not found: 'some-module'",
    );
    expect(result.type).toBe("import");
  });

  it("detects type errors", () => {
    const result = parseTranspileError(
      "Type 'string' is not assignable to type 'number'",
    );
    expect(result.type).toBe("type");
  });

  it("detects Property does not exist", () => {
    const result = parseTranspileError(
      "Property 'foo' does not exist on type 'Bar'",
    );
    expect(result.type).toBe("type");
  });

  it("detects transpile/syntax errors", () => {
    const result = parseTranspileError("Unexpected token '<'");
    expect(result.type).toBe("transpile");
  });

  it("detects Parse error", () => {
    const result = parseTranspileError("Parse error at line 5");
    expect(result.type).toBe("transpile");
  });

  it("detects runtime errors", () => {
    const result = parseTranspileError("'MyComponent' is not defined");
    expect(result.type).toBe("runtime");
    expect(result.component).toBe("MyComponent");
  });

  it("extracts line numbers", () => {
    const result = parseTranspileError("Error at line 42: something wrong");
    expect(result.lineNumber).toBe(42);
  });

  it("extracts line numbers from colon format", () => {
    const result = parseTranspileError("file.tsx:15: unexpected token");
    expect(result.lineNumber).toBe(15);
  });

  it("extracts component name from JSX context", () => {
    const result = parseTranspileError(
      "Unexpected token in <Header> component",
    );
    expect(result.component).toBe("Header");
  });

  it("extracts suggestions", () => {
    const result = parseTranspileError(
      "Error: unknown prop. Did you mean 'className'?",
    );
    expect(result.suggestion).toBe("'className'?");
  });

  it("truncates message to 500 chars", () => {
    const longError = "x".repeat(1000);
    const result = parseTranspileError(longError);
    expect(result.message.length).toBe(500);
  });

  it("returns unknown type for unrecognized errors", () => {
    const result = parseTranspileError("Something went very wrong");
    expect(result.type).toBe("unknown");
  });

  it("classifies import of unknown CDN lib as environmental", () => {
    const result = parseTranspileError(
      "Cannot find module 'totally-unknown-lib'",
    );
    expect(result.severity).toBe("environmental");
    expect(result.fixStrategy).toBe("regenerate");
  });

  it("classifies import of known CDN lib as fixable", () => {
    const result = parseTranspileError("Cannot find module 'react'");
    expect(result.severity).toBe("fixable");
    expect(result.fixStrategy).toBe("patch");
  });

  it("classifies internal import as fixable", () => {
    const result = parseTranspileError(
      "Cannot find module '@/components/ui/button'",
    );
    expect(result.severity).toBe("fixable");
    expect(result.fixStrategy).toBe("patch");
  });

  it("classifies runtime error with component as structural", () => {
    const result = parseTranspileError("'Sidebar' is not defined");
    expect(result.severity).toBe("structural");
    expect(result.fixStrategy).toBe("rewrite-section");
  });
});

describe("isUnrecoverableError", () => {
  it("returns true for environmental errors", () => {
    const error = parseTranspileError(
      "Cannot find module 'unknown-thing'",
    );
    expect(isUnrecoverableError(error, [])).toBe(true);
  });

  it("returns true for 2+ identical consecutive errors", () => {
    const error = parseTranspileError("some error");
    const previousErrors = [
      { error: "same message" },
      { error: "same message" },
    ];
    expect(isUnrecoverableError(error, previousErrors)).toBe(true);
  });

  it("returns false for different consecutive errors", () => {
    const error = parseTranspileError("some error");
    const previousErrors = [
      { error: "first error" },
      { error: "second error" },
    ];
    expect(isUnrecoverableError(error, previousErrors)).toBe(false);
  });

  it("returns false for fixable error with no history", () => {
    const error = parseTranspileError("Unexpected token '<'");
    expect(isUnrecoverableError(error, [])).toBe(false);
  });
});

describe("categorizeErrorForNote", () => {
  it("categorizes import errors", () => {
    const error = parseTranspileError(
      "Cannot find module 'recharts'",
    );
    const note = categorizeErrorForNote(error);
    expect(note.triggerType).toBe("library");
    expect(note.tags).toContain("imports");
    expect(note.tags).toContain("recharts");
  });

  it("categorizes type errors", () => {
    const error = parseTranspileError(
      "Type 'string' is not assignable to type 'number'",
    );
    const note = categorizeErrorForNote(error);
    expect(note.triggerType).toBe("pattern");
    expect(note.tags).toContain("types");
    expect(note.tags).toContain("typescript");
  });

  it("categorizes transpile errors", () => {
    const error = parseTranspileError("Unexpected token '}'");
    const note = categorizeErrorForNote(error);
    expect(note.triggerType).toBe("error_class");
    expect(note.tags).toContain("syntax");
  });

  it("categorizes runtime errors", () => {
    const error = parseTranspileError("'foo' is not defined");
    const note = categorizeErrorForNote(error);
    expect(note.triggerType).toBe("pattern");
    expect(note.tags).toContain("runtime");
  });

  it("categorizes unknown errors", () => {
    const error = parseTranspileError("Something completely different");
    const note = categorizeErrorForNote(error);
    expect(note.triggerType).toBe("error_class");
    expect(note.tags).toContain("unknown");
  });
});
