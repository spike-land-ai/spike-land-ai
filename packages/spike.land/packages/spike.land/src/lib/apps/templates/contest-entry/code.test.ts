import { describe, expect, it } from "vitest";
import { contestEntryCode } from "./code";

describe("contest-entry/code", () => {
  it("should export a non-empty string template", () => {
    expect(typeof contestEntryCode).toBe("string");
    expect(contestEntryCode.length).toBeGreaterThan(0);
  });

  it("should contain a React component", () => {
    expect(contestEntryCode).toContain("export default function");
  });

  it("should include form elements", () => {
    expect(contestEntryCode).toContain("FormData");
  });

  it("should use useState hook", () => {
    expect(contestEntryCode).toContain("useState");
  });
});
