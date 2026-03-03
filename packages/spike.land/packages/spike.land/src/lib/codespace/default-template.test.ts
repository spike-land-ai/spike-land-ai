import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE } from "./default-template";

describe("DEFAULT_TEMPLATE", () => {
  it("should have a non-empty code string", () => {
    expect(typeof DEFAULT_TEMPLATE.code).toBe("string");
    expect(DEFAULT_TEMPLATE.code.length).toBeGreaterThan(0);
  });

  it("should export a default function component", () => {
    expect(DEFAULT_TEMPLATE.code).toContain("export default function");
  });

  it("should have empty transpiled string", () => {
    expect(DEFAULT_TEMPLATE.transpiled).toBe("");
  });

  it("should have html property", () => {
    expect(typeof DEFAULT_TEMPLATE.html).toBe("string");
  });

  it("should have empty css", () => {
    expect(DEFAULT_TEMPLATE.css).toBe("");
  });

  it("should have empty messages array", () => {
    expect(DEFAULT_TEMPLATE.messages).toEqual([]);
  });

  it("should not have codeSpace property", () => {
    expect("codeSpace" in DEFAULT_TEMPLATE).toBe(false);
  });
});
