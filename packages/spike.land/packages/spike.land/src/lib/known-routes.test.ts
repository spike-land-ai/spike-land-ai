import { describe, expect, it } from "vitest";
import { KNOWN_ROUTE_SEGMENTS } from "./known-routes";

describe("KNOWN_ROUTE_SEGMENTS", () => {
  it("should be a Set", () => {
    expect(KNOWN_ROUTE_SEGMENTS).toBeInstanceOf(Set);
  });

  it("should contain common route segments", () => {
    expect(KNOWN_ROUTE_SEGMENTS.has("api")).toBe(true);
    expect(KNOWN_ROUTE_SEGMENTS.has("blog")).toBe(true);
    expect(KNOWN_ROUTE_SEGMENTS.has("auth")).toBe(true);
    expect(KNOWN_ROUTE_SEGMENTS.has("store")).toBe(true);
    expect(KNOWN_ROUTE_SEGMENTS.has("settings")).toBe(true);
    expect(KNOWN_ROUTE_SEGMENTS.has("gallery")).toBe(true);
  });

  it("should not contain internal Next.js routes", () => {
    expect(KNOWN_ROUTE_SEGMENTS.has("_next")).toBe(false);
    expect(KNOWN_ROUTE_SEGMENTS.has("_error")).toBe(false);
  });

  it("should not contain file extensions", () => {
    for (const segment of KNOWN_ROUTE_SEGMENTS) {
      expect(segment).not.toContain(".");
    }
  });

  it("should have a reasonable size (>10 segments)", () => {
    expect(KNOWN_ROUTE_SEGMENTS.size).toBeGreaterThan(10);
  });

  it("should contain all lowercase segments", () => {
    for (const segment of KNOWN_ROUTE_SEGMENTS) {
      expect(segment).toBe(segment.toLowerCase());
    }
  });
});
