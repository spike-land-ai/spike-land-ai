import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rate-limiter", () => ({ checkRateLimit: mockCheckRateLimit }));

const mockSignUpEmail = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({
  authInstance: {
    api: {
      signUpEmail: mockSignUpEmail,
    },
  },
}));

vi.mock(
  "@/lib/try-catch",
  () => ({
    tryCatch: vi.fn(async (p: Promise<unknown>) => {
      try {
        return { data: await p, error: null };
      } catch (e) {
        return { data: null, error: e };
      }
    }),
  }),
);
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/security/ip", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { POST } from "./route";

function makeRequest(
  body: Record<string, unknown>,
  options: { contentLength?: string } = {},
) {
  const headers = new Headers({
    "content-length": options.contentLength ?? "100",
  });
  return {
    headers,
    json: () => Promise.resolve(body),
  } as unknown as import("next/server").NextRequest;
}

function setupOpenRegistration() {
  vi.stubEnv("REGISTRATION_OPEN", "true");
}

function mockSuccessfulSignup(email = "user@example.com") {
  mockSignUpEmail.mockResolvedValue({
    user: { id: "new-user-id", email, name: "" },
    session: { id: "sess-1", token: "tok-1" },
  });
}

describe("signup route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockCheckRateLimit.mockResolvedValue({
      isLimited: false,
      remaining: 4,
      resetAt: 0,
    });
  });

  describe("REGISTRATION_OPEN gate", () => {
    it("returns 503 when REGISTRATION_OPEN env var is not set", async () => {
      delete process.env.REGISTRATION_OPEN;
      const res = await POST(
        makeRequest({ email: "a@b.com", password: "12345678" }),
      );
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toMatch(/registration is temporarily closed/i);
      expect(data.waitlistUrl).toBe("/waitlist");
    });

    it("returns 503 when REGISTRATION_OPEN is set to 'false'", async () => {
      vi.stubEnv("REGISTRATION_OPEN", "false");
      const res = await POST(
        makeRequest({ email: "a@b.com", password: "12345678" }),
      );
      expect(res.status).toBe(503);
    });

    it("returns 503 when REGISTRATION_OPEN is set to '1' (not exactly 'true')", async () => {
      vi.stubEnv("REGISTRATION_OPEN", "1");
      const res = await POST(
        makeRequest({ email: "a@b.com", password: "12345678" }),
      );
      expect(res.status).toBe(503);
    });

    it("does not call rate limiter when registration is closed", async () => {
      delete process.env.REGISTRATION_OPEN;
      await POST(makeRequest({ email: "a@b.com", password: "12345678" }));
      expect(mockCheckRateLimit).not.toHaveBeenCalled();
    });
  });

  describe("request size limit", () => {
    it("returns 413 when content-length exceeds 2048 bytes", async () => {
      setupOpenRegistration();
      const res = await POST(
        makeRequest(
          { email: "a@b.com", password: "12345678" },
          { contentLength: "9999" },
        ),
      );
      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error).toMatch(/too large/i);
    });

    it("allows requests at exactly the 2048 byte limit", async () => {
      setupOpenRegistration();
      mockSuccessfulSignup();
      const res = await POST(
        makeRequest(
          { email: "user@example.com", password: "12345678" },
          { contentLength: "2048" },
        ),
      );
      expect(res.status).toBe(200);
    });
  });

  describe("rate limiting", () => {
    it("returns 429 when rate limit is exceeded", async () => {
      setupOpenRegistration();
      mockCheckRateLimit.mockResolvedValue({
        isLimited: true,
        remaining: 0,
        resetAt: Date.now() + 60_000,
      });

      const res = await POST(
        makeRequest({ email: "a@b.com", password: "12345678" }),
      );
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toMatch(/too many signup attempts/i);
    });

    it("includes Retry-After header when rate limited", async () => {
      setupOpenRegistration();
      mockCheckRateLimit.mockResolvedValue({
        isLimited: true,
        remaining: 0,
        resetAt: Date.now() + 30_000,
      });

      const res = await POST(
        makeRequest({ email: "a@b.com", password: "12345678" }),
      );
      expect(res.status).toBe(429);
      const retryAfter = res.headers.get("Retry-After");
      expect(retryAfter).toBeDefined();
      expect(Number(retryAfter)).toBeGreaterThan(0);
    });

    it("includes X-RateLimit-Remaining header when rate limited", async () => {
      setupOpenRegistration();
      mockCheckRateLimit.mockResolvedValue({
        isLimited: true,
        remaining: 0,
        resetAt: Date.now() + 10_000,
      });

      const res = await POST(
        makeRequest({ email: "a@b.com", password: "12345678" }),
      );
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    });
  });

  describe("email validation", () => {
    it("returns 400 when email is missing", async () => {
      setupOpenRegistration();
      const res = await POST(makeRequest({ password: "12345678" }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/email is required/i);
    });

    it("returns 400 when email is not a string", async () => {
      setupOpenRegistration();
      const res = await POST(
        makeRequest({ email: 12345, password: "12345678" }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid email format", async () => {
      setupOpenRegistration();
      const res = await POST(
        makeRequest({ email: "notanemail", password: "12345678" }),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/invalid email format/i);
    });

    it("accepts valid email with subdomains", async () => {
      setupOpenRegistration();
      mockSignUpEmail.mockResolvedValue({
        user: { id: "new-id", email: "user@mail.example.co.uk", name: "" },
        session: { id: "s1", token: "t1" },
      });
      const res = await POST(
        makeRequest({ email: "user@mail.example.co.uk", password: "12345678" }),
      );
      expect(res.status).toBe(200);
    });
  });

  describe("password validation", () => {
    it("returns 400 when password is missing", async () => {
      setupOpenRegistration();
      const res = await POST(makeRequest({ email: "a@b.com" }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/password is required/i);
    });

    it("returns 400 when password is not a string", async () => {
      setupOpenRegistration();
      const res = await POST(
        makeRequest({ email: "a@b.com", password: 12345678 }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when password is shorter than 8 characters", async () => {
      setupOpenRegistration();
      const res = await POST(
        makeRequest({ email: "a@b.com", password: "short" }),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/at least 8 characters/i);
    });

    it("accepts an 8-character password (minimum boundary)", async () => {
      setupOpenRegistration();
      mockSuccessfulSignup();
      const res = await POST(
        makeRequest({ email: "user@example.com", password: "12345678" }),
      );
      expect(res.status).toBe(200);
    });
  });

  describe("success flow", () => {
    beforeEach(() => {
      setupOpenRegistration();
      mockSuccessfulSignup();
    });

    it("returns 200 with success payload on valid signup", async () => {
      const res = await POST(
        makeRequest({ email: "user@example.com", password: "12345678" }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toMatch(/account created/i);
      expect(data.user.email).toBe("user@example.com");
      expect(data.user.id).toBe("new-user-id");
    });

    it("does not expose password in the response", async () => {
      const res = await POST(
        makeRequest({ email: "user@example.com", password: "12345678" }),
      );
      const data = await res.json();
      expect(data.user).not.toHaveProperty("passwordHash");
      expect(data.user).not.toHaveProperty("password");
    });

    it("calls authInstance.api.signUpEmail with correct params", async () => {
      await POST(
        makeRequest({ email: "  USER@EXAMPLE.COM  ", password: "12345678" }),
      );
      expect(mockSignUpEmail).toHaveBeenCalledWith({
        body: { email: "user@example.com", password: "12345678", name: "" },
      });
    });
  });

  describe("error handling", () => {
    it("returns 500 when authInstance.api.signUpEmail throws", async () => {
      setupOpenRegistration();
      mockSignUpEmail.mockRejectedValue(new Error("Auth service error"));

      const res = await POST(
        makeRequest({ email: "user@example.com", password: "12345678" }),
      );
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toMatch(/failed to create account/i);
    });

    it("returns 500 when signUpEmail returns no user", async () => {
      setupOpenRegistration();
      mockSignUpEmail.mockResolvedValue({ user: null });

      const res = await POST(
        makeRequest({ email: "user@example.com", password: "12345678" }),
      );
      expect(res.status).toBe(500);
    });
  });
});
