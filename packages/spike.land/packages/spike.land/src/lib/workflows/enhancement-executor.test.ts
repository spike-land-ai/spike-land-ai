import { describe, expect, it } from "vitest";
import { getExecutionMode, isVercelEnvironment } from "./enhancement-executor";

describe("enhancement-executor", () => {
  describe("getExecutionMode", () => {
    it("should always return 'direct'", () => {
      expect(getExecutionMode()).toBe("direct");
    });
  });

  describe("isVercelEnvironment", () => {
    it("should always return false", () => {
      expect(isVercelEnvironment()).toBe(false);
    });
  });
});
