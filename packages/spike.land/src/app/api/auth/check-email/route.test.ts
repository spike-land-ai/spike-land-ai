import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rate-limiter", () => ({ checkRateLimit: mockCheckRateLimit }));

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  account: { findFirst: vi.fn() },
  default: undefined as unknown,
}));
mockPrisma.default = mockPrisma;
vi.mock("@/lib/prisma", () => mockPrisma);

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

import { POST } from "./route";

function makeRequest(body: Record<string, unknown>, contentLength = "100") {
  return {
    headers: new Headers({ "content-length": contentLength }),
    json: () => Promise.resolve(body),
  } as unknown as import("next/server").NextRequest;
}

describe("check-email route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({
      isLimited: false,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    });
  });

  it("returns 413 when content-length exceeds limit", async () => {
    const res = await POST(makeRequest({ email: "a@b.com" }, "9999"));
    expect(res.status).toBe(413);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({
      isLimited: true,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    });
    const res = await POST(makeRequest({ email: "a@b.com" }));
    expect(res.status).toBe(429);
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/required/i);
  });

  it("returns 400 when email format is invalid", async () => {
    const res = await POST(makeRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid/i);
  });

  it("returns exists:false when user not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ email: "new@example.com" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ exists: false, hasPassword: false });
  });

  it("returns exists:true, hasPassword:false for user without credential account", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "1" });
    mockPrisma.account.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest({ email: "existing@example.com" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ exists: true, hasPassword: false });
  });

  it("returns exists:true, hasPassword:true for user with credential account", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "1" });
    mockPrisma.account.findFirst.mockResolvedValue({ id: "acc-1" });
    const res = await POST(makeRequest({ email: "withpass@example.com" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ exists: true, hasPassword: true });
  });

  it("returns 500 when rate limiter times out", async () => {
    mockCheckRateLimit.mockImplementation(
      () => new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error("Operation timed out after 3000ms")), 0)
      ),
    );
    const res = await POST(makeRequest({ email: "a@b.com" }));
    expect(res.status).toBe(500);
  });

  it("returns 500 when DB query times out", async () => {
    mockPrisma.user.findUnique.mockImplementation(
      () => new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error("Operation timed out after 8000ms")), 0)
      ),
    );
    const res = await POST(makeRequest({ email: "a@b.com" }));
    expect(res.status).toBe(500);
  });
});
