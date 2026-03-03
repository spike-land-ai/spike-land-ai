import { describe, expect, it } from "vitest";
import { CORS_HEADERS, corsOptions } from "./cors";

describe("cors", () => {
  describe("CORS_HEADERS", () => {
    it("should allow all origins", () => {
      expect(CORS_HEADERS["Access-Control-Allow-Origin"]).toBe("*");
    });

    it("should allow expected methods", () => {
      expect(CORS_HEADERS["Access-Control-Allow-Methods"]).toBe(
        "GET, POST, PUT, OPTIONS",
      );
    });

    it("should allow Content-Type header", () => {
      expect(CORS_HEADERS["Access-Control-Allow-Headers"]).toBe("Content-Type");
    });
  });

  describe("corsOptions", () => {
    it("should return 204 response", () => {
      const response = corsOptions();
      expect(response.status).toBe(204);
    });

    it("should include CORS headers", () => {
      const response = corsOptions();
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
        "GET, POST, PUT, OPTIONS",
      );
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
        "Content-Type",
      );
    });

    it("should have null body", () => {
      const response = corsOptions();
      expect(response.body).toBeNull();
    });
  });
});
