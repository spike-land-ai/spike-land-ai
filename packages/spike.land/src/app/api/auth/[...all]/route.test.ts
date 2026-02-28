import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/headers so better-auth's nextCookies plugin doesn't fail
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Must use vi.hoisted so the variable is available when vi.mock factory runs
const mockHandler = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  authInstance: {
    handler: mockHandler,
  },
  handlers: {
    GET: mockHandler,
    POST: mockHandler,
  },
}));

import { GET, POST } from "./route";

describe("Auth route /api/auth/[...all]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandler.mockResolvedValue(new Response("ok", { status: 200 }));
  });

  describe("exports", () => {
    it("exports GET handler", () => {
      expect(GET).toBeDefined();
      expect(GET).toBe(mockHandler);
    });

    it("exports POST handler", () => {
      expect(POST).toBeDefined();
      expect(POST).toBe(mockHandler);
    });
  });

  describe("GET", () => {
    it("calls the auth handler for GET requests", async () => {
      const request = new Request(
        "http://localhost:3000/api/auth/get-session",
        { method: "GET" },
      );
      const response = await GET(request);
      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("POST", () => {
    it("calls the auth handler for POST requests", async () => {
      const request = new Request(
        "http://localhost:3000/api/auth/sign-in/email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@example.com" }),
        },
      );
      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });
  });
});
