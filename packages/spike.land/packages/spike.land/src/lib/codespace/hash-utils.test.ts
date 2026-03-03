import { describe, expect, it } from "vitest";
import { computeSessionHash, md5 } from "./hash-utils";
import type { ICodeSession } from "./types";

describe("md5", () => {
  it("should return a hex string for string input", () => {
    const result = md5("hello world");
    expect(result).toMatch(/^[a-f0-9]+$/);
  });

  it("should return deterministic results", () => {
    expect(md5("test")).toBe(md5("test"));
  });

  it("should return different hashes for different inputs", () => {
    expect(md5("a")).not.toBe(md5("b"));
  });

  it("should handle empty string", () => {
    const result = md5("");
    expect(result).toMatch(/^[a-f0-9]+$/);
  });

  it("should handle object input", () => {
    const result = md5({ key: "value" });
    expect(result).toMatch(/^[a-f0-9]+$/);
  });

  it("should return 'empty' hash for falsy input", () => {
    const result = md5("" as unknown as string);
    // Empty string is falsy, so it becomes "empty"
    expect(result).toBe(md5("empty"));
  });
});

describe("computeSessionHash", () => {
  const baseSession: ICodeSession = {
    codeSpace: "test-space",
    code: "const x = 1;",
    html: "<div>hello</div>",
    css: ".test { color: red; }",
    transpiled: "var x = 1;",
    messages: [],
  };

  it("should return a hex string", () => {
    const result = computeSessionHash(baseSession);
    expect(result).toMatch(/^[a-f0-9]+$/);
  });

  it("should be deterministic", () => {
    expect(computeSessionHash(baseSession)).toBe(
      computeSessionHash(baseSession),
    );
  });

  it("should change when code changes", () => {
    const modified = { ...baseSession, code: "const y = 2;" };
    expect(computeSessionHash(baseSession)).not.toBe(
      computeSessionHash(modified),
    );
  });

  it("should change when html changes", () => {
    const modified = { ...baseSession, html: "<p>different</p>" };
    expect(computeSessionHash(baseSession)).not.toBe(
      computeSessionHash(modified),
    );
  });

  it("should change when css changes", () => {
    const modified = { ...baseSession, css: ".other { color: blue; }" };
    expect(computeSessionHash(baseSession)).not.toBe(
      computeSessionHash(modified),
    );
  });

  it("should change when transpiled changes", () => {
    const modified = { ...baseSession, transpiled: "var y = 2;" };
    expect(computeSessionHash(baseSession)).not.toBe(
      computeSessionHash(modified),
    );
  });

  it("should change when codeSpace changes", () => {
    const modified = { ...baseSession, codeSpace: "other-space" };
    expect(computeSessionHash(baseSession)).not.toBe(
      computeSessionHash(modified),
    );
  });

  it("should NOT change when messages change (messages are not part of hash)", () => {
    const modified = {
      ...baseSession,
      messages: [{ id: "1", role: "user" as const, content: "hello" }],
    };
    expect(computeSessionHash(baseSession)).toBe(
      computeSessionHash(modified),
    );
  });
});
