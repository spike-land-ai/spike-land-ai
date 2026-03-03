import { describe, expect, it } from "vitest";
import { DEFAULT_CONVERSION_VALUE_USD } from "./types";

describe("boost-detector/types", () => {
  it("should export DEFAULT_CONVERSION_VALUE_USD as 50", () => {
    expect(DEFAULT_CONVERSION_VALUE_USD).toBe(50);
  });

  it("should be a positive number", () => {
    expect(DEFAULT_CONVERSION_VALUE_USD).toBeGreaterThan(0);
  });
});
