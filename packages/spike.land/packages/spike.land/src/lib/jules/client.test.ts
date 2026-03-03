import { describe, expect, it } from "vitest";
import { isJulesAvailable, julesRequest } from "./client";

describe("jules/client", () => {
  describe("isJulesAvailable", () => {
    it("should return false when JULES_API_KEY is not set", () => {
      const original = process.env["JULES_API_KEY"];
      delete process.env["JULES_API_KEY"];
      expect(isJulesAvailable()).toBe(false);
      if (original) process.env["JULES_API_KEY"] = original;
    });

    it("should return true when JULES_API_KEY is set", () => {
      const original = process.env["JULES_API_KEY"];
      process.env["JULES_API_KEY"] = "test-key";
      expect(isJulesAvailable()).toBe(true);
      if (original) {
        process.env["JULES_API_KEY"] = original;
      } else {
        delete process.env["JULES_API_KEY"];
      }
    });
  });

  describe("julesRequest", () => {
    it("should return error when JULES_API_KEY is not set", async () => {
      const original = process.env["JULES_API_KEY"];
      delete process.env["JULES_API_KEY"];
      const result = await julesRequest("/test");
      expect(result.data).toBeNull();
      expect(result.error).toContain("not configured");
      if (original) process.env["JULES_API_KEY"] = original;
    });
  });
});
