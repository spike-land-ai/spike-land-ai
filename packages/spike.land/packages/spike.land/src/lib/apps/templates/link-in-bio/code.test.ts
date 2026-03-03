import { describe, expect, it } from "vitest";
import { linkInBioCode } from "./code";

describe("link-in-bio/code", () => {
  it("should export a non-empty string template", () => {
    expect(typeof linkInBioCode).toBe("string");
    expect(linkInBioCode.length).toBeGreaterThan(0);
  });

  it("should contain a React component", () => {
    expect(linkInBioCode).toContain("export default function");
  });

  it("should include LinkItem interface", () => {
    expect(linkInBioCode).toContain("LinkItem");
  });

  it("should use useState hook", () => {
    expect(linkInBioCode).toContain("useState");
  });
});
