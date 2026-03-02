import { describe, expect, it } from "vitest";
import { parseTranspileErrors } from "./transpile";

describe("parseTranspileErrors", () => {
  it("should parse line:col:error format", () => {
    const errors = parseTranspileErrors('<stdin>:5:10: error: Expected ";" but found "}"');
    expect(errors).toEqual([{ line: 5, column: 10, message: 'Expected ";" but found "}"' }]);
  });

  it("should parse warning format", () => {
    const errors = parseTranspileErrors("<stdin>:3:1: warning: Unused variable x");
    expect(errors).toEqual([{ line: 3, column: 1, message: "Unused variable x" }]);
  });

  it("should parse line N format", () => {
    const errors = parseTranspileErrors("line 42: Unexpected token");
    expect(errors).toEqual([{ line: 42, message: "Unexpected token" }]);
  });

  it("should handle multiple errors", () => {
    const input = [
      "<stdin>:1:5: error: Missing import",
      "<stdin>:10:3: error: Unexpected EOF",
    ].join("\n");
    const errors = parseTranspileErrors(input);
    expect(errors).toHaveLength(2);
    expect(errors[0]!.line).toBe(1);
    expect(errors[1]!.line).toBe(10);
  });

  it("should skip error count summary lines", () => {
    const input = "<stdin>:1:1: error: bad\n2 error(s)";
    const errors = parseTranspileErrors(input);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe("bad");
  });

  it("should handle unstructured error text", () => {
    const errors = parseTranspileErrors("Something went wrong");
    expect(errors).toEqual([{ message: "Something went wrong" }]);
  });

  it("should return single error for plain text", () => {
    const errors = parseTranspileErrors("  Syntax error  ");
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe("Syntax error");
  });

  it("should deduplicate identical unstructured messages", () => {
    const errors = parseTranspileErrors("foo\nfoo");
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe("foo");
  });

  it("should return empty for blank input with whitespace", () => {
    const errors = parseTranspileErrors("   ");
    expect(errors).toHaveLength(0);
  });

  it("should handle empty string", () => {
    const errors = parseTranspileErrors("");
    expect(errors).toHaveLength(0);
  });
});

describe("transpileCode and transpileCodeWorkerDom", () => {
  it("should be exported as functions", async () => {
    // These functions require esbuild-wasm to be available so we only
    // verify they're exported correctly here. Full integration tests
    // require the actual wasm binary.
    const mod = await import("./transpile");
    expect(typeof mod.transpileCode).toBe("function");
    expect(typeof mod.transpileCodeWorkerDom).toBe("function");
  });
});
