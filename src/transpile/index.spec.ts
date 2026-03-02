import { describe, expect, it, vi } from "vitest";
import worker from "./index";

// Mock the external dependencies
vi.mock("@spike-land-ai/code/src/@/lib/transpile", () => ({
  build: vi.fn(),
  transpile: vi.fn(),
  wasmFile: "mock-wasm",
}));

describe("js.spike.land worker", () => {
  describe("fetch handler", () => {
    it("should return 405 for unsupported HTTP methods", async () => {
      const request = new Request("https://js.spike.land/", {
        method: "DELETE",
      });

      const response = await worker.fetch(request);

      expect(response.status).toBe(405);
      const text = await response.text();
      expect(text).toContain("Method not allowed");
    });

    it("should include CORS headers in 405 response", async () => {
      const request = new Request("https://js.spike.land/", {
        method: "PUT",
      });

      const response = await worker.fetch(request);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://js.spike.land");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("*");
    });

    it("should parse codeSpace from query params", async () => {
      const request = new Request("https://js.spike.land/?codeSpace=test-space", {
        method: "DELETE",
      });

      const response = await worker.fetch(request);

      expect(response.status).toBe(405);
    });

    it("should use default codeSpace when not provided", async () => {
      const request = new Request("https://js.spike.land/", {
        method: "DELETE",
      });

      const response = await worker.fetch(request);

      expect(response.status).toBe(405);
    });

    it("should set origin to testing.spike.land when origin param is testing", async () => {
      const request = new Request("https://js.spike.land/?origin=testing", {
        method: "DELETE",
      });

      const response = await worker.fetch(request);

      expect(response.status).toBe(405);
    });
  });
});
