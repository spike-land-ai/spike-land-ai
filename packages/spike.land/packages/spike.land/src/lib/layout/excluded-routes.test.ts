import { describe, expect, it } from "vitest";

import {
  FOOTER_EXCLUDED_PATHS,
  shouldHideChrome,
  shouldHideFooter,
} from "./excluded-routes";

describe("FOOTER_EXCLUDED_PATHS", () => {
  it("is a non-empty array of strings", () => {
    expect(FOOTER_EXCLUDED_PATHS.length).toBeGreaterThan(0);
    for (const path of FOOTER_EXCLUDED_PATHS) {
      expect(typeof path).toBe("string");
      expect(path.startsWith("/")).toBe(true);
    }
  });
});

describe("shouldHideFooter", () => {
  it("returns true for exact excluded paths", () => {
    expect(shouldHideFooter("/canvas")).toBe(true);
    expect(shouldHideFooter("/storybook")).toBe(true);
    expect(shouldHideFooter("/admin")).toBe(true);
    expect(shouldHideFooter("/auth")).toBe(true);
  });

  it("returns true for sub-paths of excluded routes", () => {
    expect(shouldHideFooter("/canvas/editor")).toBe(true);
    expect(shouldHideFooter("/admin/dashboard")).toBe(true);
    expect(shouldHideFooter("/auth/login")).toBe(true);
  });

  it("returns false for non-excluded paths", () => {
    expect(shouldHideFooter("/")).toBe(false);
    expect(shouldHideFooter("/blog")).toBe(false);
    expect(shouldHideFooter("/about")).toBe(false);
    expect(shouldHideFooter("/pricing")).toBe(false);
  });

  it("returns false for null pathname", () => {
    expect(shouldHideFooter(null)).toBe(false);
  });
});

describe("shouldHideChrome", () => {
  it("is an alias for shouldHideFooter", () => {
    expect(shouldHideChrome).toBe(shouldHideFooter);
  });
});
