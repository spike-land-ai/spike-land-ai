import { describe, expect, it } from "vitest";
import { interactivePollCode } from "./code";

describe("interactive-poll/code", () => {
  it("should export a non-empty string template", () => {
    expect(typeof interactivePollCode).toBe("string");
    expect(interactivePollCode.length).toBeGreaterThan(0);
  });

  it("should contain a React component", () => {
    expect(interactivePollCode).toContain("export default function");
  });

  it("should include PollOption interface", () => {
    expect(interactivePollCode).toContain("PollOption");
  });

  it("should use useState hook", () => {
    expect(interactivePollCode).toContain("useState");
  });
});
